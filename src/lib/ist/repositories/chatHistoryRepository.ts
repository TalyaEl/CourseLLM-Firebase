/**
 * Repository interface for chat history storage.
 * 
 * This abstraction allows switching between different storage backends
 * (in-memory, Firestore, PostgreSQL, etc.) without changing the calling code.
 */

import type { ChatMessage } from '../types';

/**
 * Parameters for querying recent chat messages.
 */
export interface GetRecentChatMessagesParams {
  /** Required user ID to filter messages by */
  userId: string;
  /** Optional course ID - if provided, filter by this course; otherwise return messages across all courses for this user */
  courseId?: string | null;
  /** Optional limit on number of messages to return (defaults to 10) */
  limit?: number;
}

/**
 * Repository interface for querying chat message history.
 */
export interface ChatHistoryRepository {
  /**
   * Get recent chat messages for a user, optionally filtered by course.
   * Results should be sorted by creation time (newest first) and limited to the specified count.
   * 
   * @param params - Parameters including userId, optional courseId, and optional limit
   * @returns Array of recent chat messages (newest first, up to limit)
   */
  getRecentMessages(params: GetRecentChatMessagesParams): Promise<ChatMessage[]>;
}

