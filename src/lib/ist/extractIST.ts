/**
 * Helper function to extract Intent-Skill-Trajectory from a student utterance.
 * This is a best-effort function that doesn't throw errors - it just logs them.
 * 
 * IST events are stored using a repository abstraction (currently JSON-based).
 * Storage failures are non-fatal and only logged - they won't block the chat flow.
 */

import { getIstEventRepository } from './repositories';
import { getIstContextForIstExtraction } from './istContextService';
import type { IstContext } from './types';

interface ISTResult {
  intent: string;
  skills: string[];
  trajectory: string[];
}

export type ExtractISTParams = {
  utterance: string;
  courseContext?: string | null;
  userId?: string | null;
  courseId?: string | null;
};

/**
 * Extract IST from utterance and store using the repository.
 * This function is best-effort and will not block the main flow.
 */
export async function extractAndStoreIST(params: ExtractISTParams): Promise<ISTResult | null> {
  const { utterance, courseContext, userId, courseId } = params;

  // Skip if utterance is empty or only whitespace
  if (!utterance || !utterance.trim()) {
    return null;
  }

  try {
    // Build IST context (STEP 1: minimal, empty histories; will be enriched in later steps)
    const istContext: IstContext = await getIstContextForIstExtraction({
      utterance,
      courseContext,
      userId: userId ?? null,
      courseId: courseId ?? null,
    });

    // Call the Python DSPy service directly (server-side)
    // This avoids potential loopback issues when calling the Next.js proxy from within the same app
    // STEP 2: Build richer payload from istContext (chat_history, ist_history, student_profile)
    const dspyServiceUrl = process.env.DSPY_SERVICE_URL || 'http://localhost:8000';
    
    // Build structured payload from IstContext
    const payload = {
      utterance: istContext.currentUtterance.trim(),
      course_context: istContext.courseContext ?? null,
      chat_history: istContext.recentChatMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        created_at: msg.createdAt ?? null,
      })),
      ist_history: istContext.recentIstEvents.map((event) => ({
        intent: event.intent,
        skills: event.skills,
        trajectory: event.trajectory,
        created_at: event.createdAt,
      })),
      student_profile: istContext.studentProfile
        ? {
            strong_skills: istContext.studentProfile.strongSkills,
            weak_skills: istContext.studentProfile.weakSkills,
            course_progress: istContext.studentProfile.courseProgress ?? null,
          }
        : null,
    };
    
    const istRes = await fetch(
      `${dspyServiceUrl}/api/intent-skill-trajectory`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!istRes.ok) {
      console.error('[IST] IST API returned non-OK status:', istRes.status);
      return null;
    }

    const istData = (await istRes.json()) as ISTResult;

    // Log to console
    console.log('[IST] Extracted IST:', {
      utterance: istContext.currentUtterance.trim(),
      courseContext: istContext.courseContext,
      ist: istData,
    });

    // Store using repository (non-blocking, best-effort)
    try {
      const repo = getIstEventRepository();
      await repo.save({
        userId: istContext.userId,
        courseId: istContext.courseId,
        utterance: istContext.currentUtterance.trim(),
        courseContext: istContext.courseContext,
        intent: istData.intent,
        skills: istData.skills,
        trajectory: istData.trajectory,
      });
      console.log('[IST][Repository] Stored IST event');
    } catch (storageError) {
      // Log but don't fail - storage write is optional and non-blocking
      console.error('[IST][Repository] Failed to store IST event:', storageError);
    }

    return istData;
  } catch (err) {
    console.error('[IST] Error calling IST API:', err);
    return null;
  }
}
