/**
 * In-memory stub implementation of ChatHistoryRepository.
 * 
 * DEMO MODE: Returns canned chat history when IST_DEMO_MODE=true.
 * Otherwise returns empty array.
 * 
 * In future steps, this can be:
 * - replaced by a Firestore/Postgres-backed implementation
 * - or extended to read from real chat logs
 */

import type { ChatMessage } from '../types';
import type {
  ChatHistoryRepository,
  GetRecentChatMessagesParams,
} from './chatHistoryRepository';

/**
 * Check if IST demo mode is enabled.
 * Used to determine whether to return demo chat history.
 */
function isIstDemoMode(): boolean {
  return process.env.IST_DEMO_MODE === 'true';
}

/**
 * In-memory chat history repository (stub implementation with demo mode support).
 */
export class InMemoryChatHistoryRepository implements ChatHistoryRepository {
  // We keep an internal store for future extension, but for now we don't use it.
  private messages: ChatMessage[] = [];

  async getRecentMessages(
    params: GetRecentChatMessagesParams
  ): Promise<ChatMessage[]> {
    // DEMO MODE: Return canned chat history when enabled
    if (!isIstDemoMode()) {
      return [];
    }

    // Return demo chat history (same for all users in demo mode)
    const now = Date.now();
    return [
      {
        role: 'student',
        content: "I'm struggling with understanding Big-O notation.",
        createdAt: new Date(now - 1000 * 60 * 10).toISOString(), // 10 minutes ago
      },
      {
        role: 'tutor',
        content:
          "Big-O describes how your algorithm's runtime grows with input size. Which part confuses you most?",
        createdAt: new Date(now - 1000 * 60 * 9).toISOString(), // 9 minutes ago
      },
      {
        role: 'student',
        content: "Now I'm also stuck on linked lists in this course.",
        createdAt: new Date(now - 1000 * 60 * 2).toISOString(), // 2 minutes ago
      },
    ];
  }
}

