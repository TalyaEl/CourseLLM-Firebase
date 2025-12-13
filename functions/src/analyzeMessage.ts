import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore } from './firebaseAdmin';
import type { AnalyzeMessageRequest } from './types/analyzeMessage';
import type { MessageAnalysis, IntentLabel } from './types/messageAnalysis';
import { loadIstContextFromJson } from './istContextFromJson';
import { loadIstContextFromDataConnect } from './istContextFromDataConnect';
import { saveIstEventToDataConnect } from './dataconnect/istEventsClient';

/**
 * DSPy service response format
 */
interface DSPyISTResponse {
  intent: string;
  skills: string[];
  trajectory: string[];
}

/**
 * Call the DSPy microservice to extract real IST data.
 */
async function callDspyService(
  utterance: string,
  courseContext?: string | null,
  chatHistory?: Array<{ role: 'student' | 'tutor' | 'system'; content: string; created_at: string | null }>,
  istHistory?: Array<{ intent: string; skills: string[]; trajectory: string[]; created_at: string | null }>
): Promise<DSPyISTResponse> {
  const dspyBaseUrl = process.env.DSPY_SERVICE_URL ?? 'http://127.0.0.1:8000';
  const dspyUrl = `${dspyBaseUrl}/api/intent-skill-trajectory`;

  console.log('[analyzeMessage] Calling DSPy service at:', dspyUrl);
  if (istHistory && istHistory.length > 0) {
    console.log(`[analyzeMessage] Enriching DSPy request with ${istHistory.length} IST history items`);
  }
  if (chatHistory && chatHistory.length > 0) {
    console.log(`[analyzeMessage] Enriching DSPy request with ${chatHistory.length} chat history items`);
  }

  const response = await fetch(dspyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      utterance: utterance.trim(),
      course_context: courseContext ?? null,
      chat_history: chatHistory ?? [],
      ist_history: istHistory ?? [],
      student_profile: null,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `DSPy service returned ${response.status}: ${errorText}`
    );
  }

  const data = (await response.json()) as DSPyISTResponse;
  console.log('[analyzeMessage] DSPy response received:', {
    intent: data.intent?.substring(0, 50),
    skillsCount: data.skills?.length ?? 0,
    trajectoryCount: data.trajectory?.length ?? 0,
  });

  return data;
}

/**
 * Map DSPy IST response to MessageAnalysis format.
 */
function mapDspyToMessageAnalysis(
  dspyResponse: DSPyISTResponse,
  input: AnalyzeMessageRequest & { uid: string; messageId: string }
): MessageAnalysis {
  const now = new Date().toISOString();

  // Map intent string to IntentLabel (simplified mapping)
  // Try to infer intent from the string, default to ASK_EXPLANATION
  const intentLower = dspyResponse.intent?.toLowerCase() ?? '';
  let primaryIntent: IntentLabel = 'ASK_EXPLANATION';
  
  if (intentLower.includes('example') || intentLower.includes('demonstrate')) {
    primaryIntent = 'ASK_EXAMPLES';
  } else if (intentLower.includes('step') || intentLower.includes('how to')) {
    primaryIntent = 'ASK_STEP_BY_STEP_HELP';
  } else if (intentLower.includes('quiz') || intentLower.includes('test')) {
    primaryIntent = 'ASK_QUIZ';
  } else if (intentLower.includes('summary') || intentLower.includes('summarize')) {
    primaryIntent = 'ASK_SUMMARY';
  } else if (intentLower.includes('next') || intentLower.includes('what to learn')) {
    primaryIntent = 'ASK_WHAT_TO_LEARN_NEXT';
  } else if (intentLower.includes('help') || intentLower.includes('system')) {
    primaryIntent = 'META_SYSTEM_HELP';
  } else if (intentLower.includes('off topic') || intentLower.includes('unrelated')) {
    primaryIntent = 'OFF_TOPIC';
  }

  // Map skills array to MessageAnalysis skills.items format
  const skillsItems = (dspyResponse.skills ?? []).map((skill, index) => ({
    id: skill.toLowerCase().replace(/\s+/g, '-'),
    displayName: skill,
    confidence: 0.8, // Default confidence, can be enhanced later
    role: index === 0 ? ('FOCUS' as const) : ('SECONDARY' as const),
  }));

  // Map trajectory array to MessageAnalysis trajectory format
  const suggestedNextNodes = (dspyResponse.trajectory ?? []).map((step, index) => ({
    id: `step-${index + 1}`,
    reason: step,
    priority: index + 1,
  }));

  return {
    intent: {
      labels: [primaryIntent],
      primary: primaryIntent,
      confidence: 0.85, // Default confidence
    },
    skills: {
      items: skillsItems,
    },
    trajectory: {
      currentNodes: [], // Can be enriched later based on course context
      suggestedNextNodes,
      status: 'ON_TRACK', // Default status, can be enhanced based on analysis
    },
    metadata: {
      processedAt: now,
      modelVersion: 'ist-v1-dspy',
      threadId: input.threadId,
      messageId: input.messageId,
      uid: input.uid,
    },
  };
}

async function runIstAnalysis(
  input: AnalyzeMessageRequest & { uid: string; messageId: string }
): Promise<MessageAnalysis> {
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
  
  // Load IST context when running in emulator
  let chatHistory: Array<{ role: 'student' | 'tutor' | 'system'; content: string; created_at: string | null }> = [];
  let istHistory: Array<{ intent: string; skills: string[]; trajectory: string[]; created_at: string | null }> = [];
  
  if (isEmulator) {
    try {
      console.log('[analyzeMessage] Attempting to load IST context from Data Connect');
      const context = await loadIstContextFromDataConnect({
        userId: input.uid, // Use the uid (demo-user in emulator)
        courseId: input.courseId ?? undefined,
        maxHistory: 5,
      });
      chatHistory = context.chatHistory;
      istHistory = context.istHistory;
      console.log(
        '[analyzeMessage] Loaded IST context from Data Connect, events:',
        istHistory.length
      );
    } catch (err) {
      console.warn(
        '[analyzeMessage] Failed to load IST context from Data Connect, falling back to JSON:',
        err
      );
    }

    // If Data Connect returned no history, optionally fall back to JSON (for early runs)
    if (istHistory.length === 0) {
      try {
        console.log('[analyzeMessage] Falling back to JSON IST context loader');
        const context = await loadIstContextFromJson({
          userId: input.uid, // Use the uid (demo-user in emulator)
          courseId: input.courseId ?? undefined,
          maxHistory: 5,
        });
        chatHistory = context.chatHistory;
        istHistory = context.istHistory;
        console.log(
          '[analyzeMessage] Loaded IST context from JSON, events:',
          istHistory.length
        );
      } catch (err) {
        // Log but don't fail - context loading is optional
        console.warn('[analyzeMessage] Failed to load IST context from JSON:', err);
      }
    }
  }

  // Call the real DSPy service with enriched context
  const dspyResponse = await callDspyService(
    input.messageText,
    input.courseId ? `Course: ${input.courseId}` : null,
    chatHistory,
    istHistory
  );

  // --- Non-blocking Data Connect Write (Best Effort) ---
  console.log('[analyzeMessage] About to save IST event to DataConnect for messageId', input.messageId);

  try {
    await saveIstEventToDataConnect({
      userId: input.uid,
      courseId: input.courseId ?? 'unknown-course',
      threadId: input.threadId,
      messageId: input.messageId,
      utterance: input.messageText,
      intent: dspyResponse.intent,
      skills: dspyResponse.skills,
      trajectory: dspyResponse.trajectory,
    });
    console.log('[analyzeMessage] DataConnect save completed for messageId', input.messageId);
  } catch (err) {
    console.error('[analyzeMessage] Non-fatal: failed to write IstEvent to DataConnect', err);
  }
  // -----------------------------------------------------

  // Map DSPy response to MessageAnalysis format
  return mapDspyToMessageAnalysis(dspyResponse, input);
}

export const analyzeMessage = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 180,
  },
  async (
    request: CallableRequest<AnalyzeMessageRequest>
  ): Promise<MessageAnalysis> => {
    try {
      const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
      const uid = request.auth?.uid ?? (isEmulator ? 'demo-user' : undefined);
      
      if (isEmulator && !request.auth?.uid) {
        console.log('[analyzeMessage] No auth in emulator, using demo UID "demo-user"');
      }
      
      if (!uid) {
        throw new HttpsError(
          'unauthenticated',
          'User must be authenticated to call analyzeMessage.'
        );
      }

      const data = request.data;

      if (!data || typeof data !== 'object') {
        throw new HttpsError(
          'invalid-argument',
          'Request data must be an object.'
        );
      }

      if (!data.threadId || !data.messageText) {
        throw new HttpsError(
          'invalid-argument',
          'threadId and messageText are required.'
        );
      }

      const messageId = data.messageId || 'auto-generated';

      console.log('[analyzeMessage] Running IST analysis for threadId:', data.threadId, 'messageId:', messageId);
      const analysis = await runIstAnalysis({ ...data, messageId, uid });

      console.log('[analyzeMessage] IST analysis complete, writing to Firestore...');
      const db = getFirestore();
      const ref = db
        .collection('threads')
        .doc(data.threadId)
        .collection('analysis')
        .doc(messageId);

      await ref.set(analysis, { merge: true });
      console.log('[analyzeMessage] Successfully wrote analysis to Firestore');

      return analysis;
    } catch (err) {
      console.error('[analyzeMessage] Unhandled error:', err);
      
      if (err instanceof HttpsError) {
        throw err;
      }
      
      throw new HttpsError(
        'internal',
        (err as any)?.message || 'Internal error in analyzeMessage'
      );
    }
  }
);
