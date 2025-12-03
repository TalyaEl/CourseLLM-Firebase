import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore } from './firebaseAdmin';
import type { AnalyzeMessageRequest } from './types/analyzeMessage';
import type { MessageAnalysis } from './types/messageAnalysis';

async function runIstAnalysis(
  input: AnalyzeMessageRequest & { uid: string; messageId: string }
): Promise<MessageAnalysis> {
  const now = new Date().toISOString();

  return {
    intent: {
      labels: ['ASK_EXPLANATION'],
      primary: 'ASK_EXPLANATION',
      confidence: 0.95,
    },
    skills: {
      items: [
        {
          id: 'bayes-theorem',
          displayName: 'Bayes Theorem',
          confidence: 0.9,
          role: 'FOCUS',
        },
        {
          id: 'probability',
          displayName: 'Probability',
          confidence: 0.98,
          role: 'PREREQUISITE',
        },
      ],
    },
    trajectory: {
      currentNodes: ['introduction-to-probability'],
      suggestedNextNodes: [
        {
          id: 'bayes-theorem-explained',
          reason: 'The user is asking a direct question about this topic.',
          priority: 1,
        },
      ],
      status: 'ON_TRACK',
    },
    metadata: {
      processedAt: now,
      modelVersion: 'ist-v1',
      threadId: input.threadId,
      messageId: input.messageId,
      uid: input.uid,
    },
  };
}

export const analyzeMessage = onCall(
  async (
    request: CallableRequest<AnalyzeMessageRequest>
  ): Promise<MessageAnalysis> => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated to call analyzeMessage.'
      );
    }

    const data = request.data;

    if (!data.threadId || !data.messageText) {
      throw new HttpsError(
        'invalid-argument',
        'threadId and messageText are required.'
      );
    }

    const messageId = data.messageId || 'auto-generated';

    const analysis = await runIstAnalysis({ ...data, messageId, uid });

    const db = getFirestore();
    const ref = db
      .collection('threads')
      .doc(data.threadId)
      .collection('analysis')
      .doc(messageId);

    await ref.set(analysis, { merge: true });

    return analysis;
  }
);
