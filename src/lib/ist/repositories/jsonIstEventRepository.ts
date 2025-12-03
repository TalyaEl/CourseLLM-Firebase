/**
 * JSON-based implementation of IstEventRepository.
 * 
 * Stores IST events in a JSON file on disk, with an in-memory cache for fast access.
 * Data persists across server restarts.
 * 
 * File location: src/mocks/ist/events.json
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import type { IstEvent, CreateIstEventInput } from '../types';
import type { IstEventRepository, GetRecentIstEventsParams } from './istEventRepository';

const DEFAULT_EVENTS_FILE = join(process.cwd(), 'src', 'mocks', 'ist', 'events.json');

/**
 * JSON-based repository that persists to a file.
 */
export class JsonIstEventRepository implements IstEventRepository {
  private events: IstEvent[] = [];
  private loaded = false;
  private eventsFile: string;

  constructor(eventsFile: string = DEFAULT_EVENTS_FILE) {
    this.eventsFile = eventsFile;
  }

  /**
   * Lazy-load events from JSON file on first access.
   */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    try {
      // Ensure directory exists
      const dir = join(this.eventsFile, '..');
      await fs.mkdir(dir, { recursive: true });

      // Try to read existing file
      const content = await fs.readFile(this.eventsFile, 'utf-8');
      this.events = JSON.parse(content) as IstEvent[];

      // Validate that it's an array
      if (!Array.isArray(this.events)) {
        console.warn('[IST][JSON] events.json is not an array, starting fresh');
        this.events = [];
      }
    } catch (error: any) {
      // File doesn't exist yet or read error - start with empty array
      if (error.code === 'ENOENT') {
        console.log('[IST][JSON] events.json not found, starting with empty array');
        this.events = [];
      } else {
        console.error('[IST][JSON] Error loading events.json:', error);
        this.events = [];
      }
    }

    this.loaded = true;
  }

  /**
   * Write events array to JSON file.
   */
  private async persist(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = join(this.eventsFile, '..');
      await fs.mkdir(dir, { recursive: true });

      // Write pretty-printed JSON
      await fs.writeFile(this.eventsFile, JSON.stringify(this.events, null, 2), 'utf-8');
    } catch (error) {
      console.error('[IST][JSON] Error writing to events.json:', error);
      throw error;
    }
  }

  /**
   * Generate a unique ID for a new event.
   */
  private generateId(): string {
    // Simple incremental ID based on existing events
    const maxId = this.events.reduce((max, event) => {
      const numId = parseInt(event.id, 10);
      return isNaN(numId) ? max : Math.max(max, numId);
    }, 0);
    return String(maxId + 1);
  }

  async save(event: CreateIstEventInput): Promise<IstEvent> {
    await this.ensureLoaded();

    const newEvent: IstEvent = {
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      userId: event.userId ?? null,
      courseId: event.courseId ?? null,
      utterance: event.utterance,
      courseContext: event.courseContext ?? null,
      intent: event.intent,
      skills: event.skills,
      trajectory: event.trajectory,
    };

    this.events.push(newEvent);
    await this.persist();

    return newEvent;
  }

  async findById(id: string): Promise<IstEvent | null> {
    await this.ensureLoaded();
    return this.events.find((e) => e.id === id) ?? null;
  }

  async findByUserAndCourse(userId: string, courseId: string): Promise<IstEvent[]> {
    await this.ensureLoaded();
    return this.events.filter(
      (e) => e.userId === userId && e.courseId === courseId
    );
  }

  async findByUser(userId: string): Promise<IstEvent[]> {
    await this.ensureLoaded();
    return this.events.filter((e) => e.userId === userId);
  }

  async findByCourse(courseId: string): Promise<IstEvent[]> {
    await this.ensureLoaded();
    return this.events.filter((e) => e.courseId === courseId);
  }

  async getRecentEvents(params: GetRecentIstEventsParams): Promise<IstEvent[]> {
    const { userId, courseId = null, limit = 10 } = params;

    // Ensure events are loaded from disk into memory
    await this.ensureLoaded();

    const allEvents: IstEvent[] = this.events ?? [];

    // Filter by userId (required)
    // If courseId is provided, also filter by courseId; otherwise return events across all courses
    const filtered = allEvents.filter((event) => {
      if (event.userId !== userId) return false;
      if (courseId != null && event.courseId !== courseId) return false;
      return true;
    });

    // Sort by createdAt (newest first)
    const sorted = filtered.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime; // newest first
    });

    // Limit results
    return sorted.slice(0, limit);
  }
}

