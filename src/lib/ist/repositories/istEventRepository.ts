/**
 * Repository interface for IST event storage.
 * 
 * This abstraction allows switching between different storage backends
 * (JSON file, PostgreSQL, etc.) without changing the calling code.
 */

import type { IstEvent, CreateIstEventInput } from '../types';

/**
 * Parameters for querying recent IST events.
 */
export interface GetRecentIstEventsParams {
  /** Required user ID to filter events by */
  userId: string;
  /** Optional course ID - if provided, filter by this course; otherwise return events across all courses for this user */
  courseId?: string | null;
  /** Optional limit on number of events to return (defaults to 10) */
  limit?: number;
}

/**
 * Repository interface for storing and querying IST events.
 */
export interface IstEventRepository {
  /**
   * Save a new IST event.
   * Generates id and createdAt if not provided.
   * 
   * @param event - The event data to save
   * @returns The saved event with generated fields populated
   */
  save(event: CreateIstEventInput): Promise<IstEvent>;

  /**
   * Find an event by its ID.
   * 
   * @param id - The event ID
   * @returns The event if found, null otherwise
   */
  findById(id: string): Promise<IstEvent | null>;

  /**
   * Find all events for a specific user and course.
   * 
   * @param userId - The user ID
   * @param courseId - The course ID
   * @returns Array of events (empty if none found)
   */
  findByUserAndCourse(userId: string, courseId: string): Promise<IstEvent[]>;

  /**
   * Find all events for a specific user (across all courses).
   * 
   * @param userId - The user ID
   * @returns Array of events (empty if none found)
   */
  findByUser(userId: string): Promise<IstEvent[]>;

  /**
   * Find all events for a specific course (across all users).
   * 
   * @param courseId - The course ID
   * @returns Array of events (empty if none found)
   */
  findByCourse(courseId: string): Promise<IstEvent[]>;

  /**
   * Get recent IST events for a user, optionally filtered by course.
   * Results are sorted by creation time (newest first) and limited to the specified count.
   * 
   * @param params - Parameters including userId, optional courseId, and optional limit
   * @returns Array of recent events (newest first, up to limit)
   */
  getRecentEvents(params: GetRecentIstEventsParams): Promise<IstEvent[]>;
}

