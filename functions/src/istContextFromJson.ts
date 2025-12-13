/**
 * Helper to load IST context (chat_history and ist_history) from the JSON file
 * used by the Next.js app's JsonIstEventRepository.
 * 
 * This is used ONLY when running in the Firebase Emulator to enrich DSPy requests
 * with historical context from previous IST extractions.
 * 
 * Type definitions (inferred from src/lib/ist/types.ts and dspy_service/app.py):
 * 
 * IstEvent (from JSON file):
 *   - id: string
 *   - createdAt: string (ISO timestamp)
 *   - userId?: string | null
 *   - courseId?: string | null
 *   - utterance: string
 *   - courseContext?: string | null
 *   - intent: string
 *   - skills: string[]
 *   - trajectory: string[]
 * 
 * DSPy expects:
 *   - chat_history: Array<{ role: "student"|"tutor"|"system", content: string, created_at: string|null }>
 *   - ist_history: Array<{ intent: string, skills: string[], trajectory: string[], created_at: string|null }>
 * 
 * Note: The JSON file doesn't store separate chat messages, so chat_history will be empty.
 * Only ist_history is populated from the IST events.
 */

import { promises as fs } from 'fs';
import { resolve } from 'path';

/**
 * IST event as stored in the JSON file (mirrors IstEvent from src/lib/ist/types.ts)
 */
interface IstEventFromJson {
  id: string;
  createdAt: string;
  userId?: string | null;
  courseId?: string | null;
  utterance: string;
  courseContext?: string | null;
  intent: string;
  skills: string[];
  trajectory: string[];
}

/**
 * Options for loading IST context
 */
export interface IstContextOptions {
  /** User ID to filter events (e.g., "demo-user" in emulator) */
  userId?: string;
  /** Optional course ID to filter events */
  courseId?: string;
  /** Maximum number of events to return (default: 5) */
  maxHistory?: number;
}

/**
 * Result containing chat_history and ist_history in DSPy format
 */
export interface IstContextResult {
  /** Chat history (empty for now, as JSON doesn't store separate chat messages) */
  chatHistory: Array<{
    role: 'student' | 'tutor' | 'system';
    content: string;
    created_at: string | null;
  }>;
  /** IST history from previous extractions */
  istHistory: Array<{
    intent: string;
    skills: string[];
    trajectory: string[];
    created_at: string | null;
  }>;
}

/**
 * Load IST context from the JSON file used by JsonIstEventRepository.
 * 
 * Path resolution:
 * - When Firebase Emulator runs, the working directory is typically the project root
 * - The JSON file is at: src/mocks/ist/events.json (relative to project root)
 * - We use process.cwd() to get the project root, then resolve to the file
 * 
 * This function is defensive: if the file doesn't exist or can't be parsed,
 * it logs a warning and returns empty arrays instead of throwing.
 */
export async function loadIstContextFromJson(
  options: IstContextOptions
): Promise<IstContextResult> {
  const { userId, courseId, maxHistory = 5 } = options;

  // Resolve path to events.json
  // From project root: src/mocks/ist/events.json
  // When running in emulator, process.cwd() is the project root
  const eventsFilePath = resolve(process.cwd(), 'src', 'mocks', 'ist', 'events.json');

  try {
    // Read and parse the JSON file
    const fileContent = await fs.readFile(eventsFilePath, 'utf-8');
    const events = JSON.parse(fileContent) as IstEventFromJson[];

    // Validate that it's an array
    if (!Array.isArray(events)) {
      console.warn('[IST][Functions] events.json is not an array, returning empty context');
      return { chatHistory: [], istHistory: [] };
    }

    // Filter events by userId and courseId
    let filtered = events;
    
    if (userId) {
      filtered = filtered.filter((event) => event.userId === userId);
    }
    
    if (courseId) {
      filtered = filtered.filter((event) => event.courseId === courseId);
    }

    // Sort by createdAt (newest first)
    const sorted = filtered.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime; // newest first
    });

    // Take up to maxHistory items
    const recentEvents = sorted.slice(0, maxHistory);

    // Map to DSPy ist_history format
    const istHistory = recentEvents.map((event) => ({
      intent: event.intent,
      skills: event.skills,
      trajectory: event.trajectory,
      created_at: event.createdAt,
    }));

    // Note: We don't have separate chat messages in the JSON file
    // The utterances are stored in IST events, but DSPy expects separate chat_history
    // For now, we return empty chat_history. This could be enriched later by
    // extracting utterances from IST events and creating chat messages.
    const chatHistory: IstContextResult['chatHistory'] = [];

    console.log(
      `[IST][Functions] Loaded ${istHistory.length} IST events from JSON (userId: ${userId ?? 'any'}, courseId: ${courseId ?? 'any'})`
    );

    return { chatHistory, istHistory };
  } catch (error: any) {
    // File doesn't exist or parse error - return empty arrays
    if (error.code === 'ENOENT') {
      console.warn(
        `[IST][Functions] events.json not found at ${eventsFilePath}, returning empty context`
      );
    } else {
      console.warn(
        `[IST][Functions] Failed to load IST context from JSON: ${error.message}`,
        error
      );
    }
    return { chatHistory: [], istHistory: [] };
  }
}

