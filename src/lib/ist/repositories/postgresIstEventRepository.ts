/**
 * PostgreSQL/Supabase implementation of IstEventRepository.
 * 
 * This is a stub implementation for future use.
 * Currently throws an error to indicate it's not yet implemented.
 */

import type { IstEvent, CreateIstEventInput } from '../types';
import type { IstEventRepository, GetRecentIstEventsParams } from './istEventRepository';

/**
 * PostgreSQL-based repository (not yet implemented).
 * 
 * When implemented, this will:
 * - Use getPool() from @/lib/db/pgClient
 * - Store events in the intent_skill_trajectory_events table
 * - Map IstEvent to/from PostgreSQL jsonb columns
 */
export class PostgresIstEventRepository implements IstEventRepository {
  async save(_event: CreateIstEventInput): Promise<IstEvent> {
    throw new Error('PostgresIstEventRepository is not yet implemented. Use IST_STORAGE_MODE=json for now.');
  }

  async findById(_id: string): Promise<IstEvent | null> {
    throw new Error('PostgresIstEventRepository is not yet implemented. Use IST_STORAGE_MODE=json for now.');
  }

  async findByUserAndCourse(_userId: string, _courseId: string): Promise<IstEvent[]> {
    throw new Error('PostgresIstEventRepository is not yet implemented. Use IST_STORAGE_MODE=json for now.');
  }

  async findByUser(_userId: string): Promise<IstEvent[]> {
    throw new Error('PostgresIstEventRepository is not yet implemented. Use IST_STORAGE_MODE=json for now.');
  }

  async findByCourse(_courseId: string): Promise<IstEvent[]> {
    throw new Error('PostgresIstEventRepository is not yet implemented. Use IST_STORAGE_MODE=json for now.');
  }

  async getRecentEvents(_params: GetRecentIstEventsParams): Promise<IstEvent[]> {
    throw new Error('PostgresIstEventRepository.getRecentEvents is not yet implemented. Use IST_STORAGE_MODE=json for now.');
  }
}

