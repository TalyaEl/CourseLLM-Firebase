/**
 * Helper to load IST context (ist_history, and eventually chat_history)
 * from the Firebase Data Connect IstEvent table.
 *
 * This mirrors the shape returned by loadIstContextFromJson so that
 * downstream DSPy calls can remain unchanged.
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getDataConnect,
  connectDataConnectEmulator,
  executeQuery,
  type DataConnect,
} from 'firebase/data-connect';
import {
  connectorConfig,
  istEventsByUserAndCourseRef,
} from '@dataconnect/functions-generated';

import type {
  IstContextOptions,
  IstContextResult,
} from './istContextFromJson';

// Keep a singleton Data Connect instance for reads
let dataConnectInstance: DataConnect | null = null;

function getOrInitDataConnect(): DataConnect | null {
  if (dataConnectInstance) {
    return dataConnectInstance;
  }

  try {
    // Ensure a default Firebase App exists (same pattern as istEventsClient)
    if (getApps().length === 0) {
      const configEnv = process.env.FIREBASE_CONFIG;
      if (!configEnv) {
        console.warn(
          '[DataConnect] Missing FIREBASE_CONFIG env var. Initializing with minimal config for emulator.'
        );
        initializeApp({
          projectId: process.env.GCLOUD_PROJECT || 'coursewise-f2421',
        });
      } else {
        const firebaseConfig = JSON.parse(configEnv);
        initializeApp(firebaseConfig);
      }
    }

    const dc = getDataConnect(connectorConfig);

    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      // Port 9400 is defined in firebase.json for the Data Connect emulator
      connectDataConnectEmulator(dc, 'localhost', 9400);
    }

    dataConnectInstance = dc;
    console.log('[DataConnect] Initialized Data Connect client for IST context loading');
    return dataConnectInstance;
  } catch (err) {
    console.error(
      '[DataConnect] Failed to initialize Data Connect client for IST context loading',
      err
    );
    return null;
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

/**
 * Load IST context from Firebase Data Connect IstEvent table.
 *
 * This returns the same IstContextResult shape as loadIstContextFromJson.
 */
export async function loadIstContextFromDataConnect(
  options: IstContextOptions
): Promise<IstContextResult> {
  const { userId, courseId, maxHistory = 5 } = options;

  // Without a userId (and courseId), we cannot query IstEvent
  if (!userId || !courseId) {
    console.warn(
      '[IST][DataConnect] Missing userId or courseId in options, returning empty IST context'
    );
    return { chatHistory: [], istHistory: [] };
  }

  const dc = getOrInitDataConnect();
  if (!dc) {
    console.warn(
      '[IST][DataConnect] Data Connect client not initialized, returning empty IST context'
    );
    return { chatHistory: [], istHistory: [] };
  }

  try {
    const ref = istEventsByUserAndCourseRef(dc, { userId, courseId });
    const result = await executeQuery(ref);

    const events = result.data?.istEvents ?? [];

    if (!Array.isArray(events) || events.length === 0) {
      console.log(
        `[IST][DataConnect] No IST events found for userId=${userId}, courseId=${courseId}`
      );
      return { chatHistory: [], istHistory: [] };
    }

    // Take up to maxHistory items (query is already newest-first)
    const recentEvents = events.slice(0, maxHistory);

    const istHistory: IstContextResult['istHistory'] = recentEvents.map(
      (event) => {
        const skills = normalizeStringArray(event.skills);
        const trajectory = normalizeStringArray(event.trajectory);

        let createdAt: string | null = null;
        if (event.createdAt) {
          const date = new Date(event.createdAt);
          createdAt = Number.isNaN(date.getTime())
            ? null
            : date.toISOString();
        }

        return {
          intent: event.intent,
          skills,
          trajectory,
          created_at: createdAt,
        };
      }
    );

    const chatHistory: IstContextResult['chatHistory'] = [];

    console.log(
      `[IST][DataConnect] Loaded ${istHistory.length} IST events from Data Connect (userId: ${userId}, courseId: ${courseId})`
    );

    return { chatHistory, istHistory };
  } catch (err) {
    console.error(
      '[IST][DataConnect] Failed to load IST context from Data Connect',
      err
    );
    return { chatHistory: [], istHistory: [] };
  }
}


