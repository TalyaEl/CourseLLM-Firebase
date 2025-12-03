/**
 * Repository factory for IST events and chat history.
 * 
 * Selects the appropriate repository implementation based on environment variables.
 * Currently supports JSON-based storage for IST events and in-memory stub for chat history.
 */

import type { IstEventRepository } from './istEventRepository';
import { JsonIstEventRepository } from './jsonIstEventRepository';
import { PostgresIstEventRepository } from './postgresIstEventRepository';
import type { ChatHistoryRepository } from './chatHistoryRepository';
import { InMemoryChatHistoryRepository } from './inMemoryChatHistoryRepository';

let singletonRepository: IstEventRepository | null = null;

/**
 * Get the IST event repository instance.
 * 
 * Uses IST_STORAGE_MODE environment variable:
 * - 'json' (default): JSON-based file storage
 * - 'postgres': PostgreSQL/Supabase storage (not yet implemented)
 * 
 * @returns The repository instance
 */
export function getIstEventRepository(): IstEventRepository {
  if (singletonRepository) {
    return singletonRepository;
  }

  const mode = process.env.IST_STORAGE_MODE || 'json';

  switch (mode) {
    case 'json':
      singletonRepository = new JsonIstEventRepository();
      console.log('[IST][Repository] Using JSON-based storage');
      break;

    case 'postgres':
      // Future: when PostgresIstEventRepository is implemented
      singletonRepository = new PostgresIstEventRepository();
      console.log('[IST][Repository] Using PostgreSQL storage (not yet implemented)');
      break;

    default:
      throw new Error(
        `Unknown IST_STORAGE_MODE: ${mode}. Use 'json' or 'postgres'.`
      );
  }

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

