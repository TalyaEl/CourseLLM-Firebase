/**
 * Service for building IST context objects that enrich IST extraction.
 * 
 * This service will eventually be responsible for:
 * - Loading recent chat history
 * - Loading recent IST events from the repository
 * - Loading/constructing student profiles
 * 
 * STEP 4: Now populates both recentIstEvents and recentChatMessages from repositories when userId is available.
 */

import type { IstContext, ChatMessage, IstEvent } from './types';
import { getIstEventRepository, getChatHistoryRepository } from './repositories';

/**
 * Check if IST demo mode is enabled.
 * Demo mode provides fake userId/courseId and canned chat history for testing.
 */
function isIstDemoMode(): boolean {
  return process.env.IST_DEMO_MODE === 'true';
}

/**
 * Parameters for building an IST context.
 */
export interface BuildIstContextParams {
  /** The current student utterance to analyze */
  utterance: string;
  /** Optional course context (course name, topic, etc.) */
  courseContext?: string | null;
  /** Optional user ID who generated the utterance */
  userId?: string | null;
  /** Optional course ID context */
  courseId?: string | null;
}

/**
 * Build an IST context for IST extraction.
 * 
 * STEP 4: Populates both recentIstEvents and recentChatMessages from repositories when userId is available.
 * In later steps, this will be further enriched with:
 * - Student profile constructed from historical IST data
 * 
 * @param params - Parameters for building the context
 * @returns An IstContext object ready for IST extraction
 */
export async function getIstContextForIstExtraction(
  params: BuildIstContextParams
): Promise<IstContext> {
  const {
    utterance,
    courseContext = null,
    userId: rawUserId = null,
    courseId: rawCourseId = null,
  } = params;

  // DEMO MODE: Use demo IDs when no real userId is provided and demo mode is enabled
  let userId = rawUserId;
  let courseId = rawCourseId;

  if (!userId && isIstDemoMode()) {
    userId = 'demo-user-1';
    if (!courseId) {
      courseId = 'cs-demo-101';
    }
    console.log('[IST][Context][DEMO] Using demo identity:', { userId, courseId });
  }

  const istRepo = getIstEventRepository();
  const chatRepo = getChatHistoryRepository();

  let recentIstEvents: IstEvent[] = [];
  let recentChatMessages: ChatMessage[] = [];

  if (userId) {
    // Load recent IST events
    try {
      recentIstEvents = await istRepo.getRecentEvents({
        userId,
        courseId,
        limit: 10,
      });
      console.log('[IST][Context] Loaded recent IST events:', recentIstEvents.length);
    } catch (error) {
      // Log but don't fail - IST extraction remains non-blocking
      console.error('[IST][Context] Failed to load recent IST events:', error);
      recentIstEvents = [];
    }

    // Load recent chat messages
    try {
      recentChatMessages = await chatRepo.getRecentMessages({
        userId,
        courseId,
        limit: 10,
      });
      console.log('[IST][Context] Loaded recent chat messages:', recentChatMessages.length);
    } catch (error) {
      // Log but don't fail - IST extraction remains non-blocking
      console.error('[IST][Context] Failed to load recent chat messages:', error);
      recentChatMessages = [];
    }
  }

  const context: IstContext = {
    currentUtterance: utterance,
    courseContext,
    userId,
    courseId,
    recentChatMessages,
    recentIstEvents,
    studentProfile: null,
  };

  return context;
}

