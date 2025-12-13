/**
 * Repository factory for IST events and chat history.
 * 
 * Currently supports JSON-based storage for IST events and in-memory stub for chat history.
 */

import type { IstEventRepository } from './istEventRepository';
import { JsonIstEventRepository } from './jsonIstEventRepository';
import type { ChatHistoryRepository } from './chatHistoryRepository';
import { InMemoryChatHistoryRepository } from './inMemoryChatHistoryRepository';

let singletonRepository: IstEventRepository | null = null;

/**
 * Get the IST event repository instance.
 * 
 * Currently returns a JSON-based file storage implementation.
 * 
 * @returns The repository instance
 */
export function getIstEventRepository(): IstEventRepository {
  if (singletonRepository) {
    return singletonRepository;
  }

  singletonRepository = new JsonIstEventRepository();
  return singletonRepository;
}

/**
 * Chat history repository singleton instance.
 */
let chatHistoryRepoSingleton: ChatHistoryRepository | null = null;

/**
 * Get the chat history repository instance.
 * 
 * Currently returns an in-memory stub that always returns empty arrays.
 * In the future, this can be extended to support different implementations
 * (e.g., Firestore, Postgres) based on environment variables, similar to IST_STORAGE_MODE.
 * 
 * @returns The chat history repository instance
 */
export function getChatHistoryRepository(): ChatHistoryRepository {
  if (!chatHistoryRepoSingleton) {
    // For now, we only support the in-memory stub implementation
    // Future: we can switch based on env vars similar to IST_STORAGE_MODE
    chatHistoryRepoSingleton = new InMemoryChatHistoryRepository();
  }
  return chatHistoryRepoSingleton;
}

