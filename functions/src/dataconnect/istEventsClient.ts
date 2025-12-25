import { initializeApp, getApps } from 'firebase/app';
import { getDataConnect, connectDataConnectEmulator, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createIstEventRef } from '@dataconnect/functions-generated';

interface IstEventInput {
  userId: string;
  courseId: string;
  threadId: string;
  messageId: string;
  utterance: string;
  intent: string;
  skills: unknown;
  trajectory: unknown;
}

// Keep a singleton Data Connect instance
let dataConnectInstance: ReturnType<typeof getDataConnect> | null = null;

function getOrInitDataConnect() {
  if (dataConnectInstance) {
    return dataConnectInstance;
  }

  try {
    // Ensure a default Firebase App exists
    if (getApps().length === 0) {
      const configEnv = process.env.FIREBASE_CONFIG;
      if (!configEnv) {
        // In some emulator environments, FIREBASE_CONFIG might be missing or minimal.
        // We can try a fallback or just log error.
        // For local emulator, sometimes just {} is enough if we trust the emulator config.
        console.warn('[DataConnect] Missing FIREBASE_CONFIG env var. Attempting to initialize with minimal config for emulator.');
        // Minimal config might work for emulator if it only needs project ID
        initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'coursewise-f2421' });
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
    console.log('[DataConnect] Initialized Data Connect client');
    return dataConnectInstance;

  } catch (err) {
    console.error('[DataConnect] Failed to initialize Data Connect client', err);
    return null;
  }
}

export async function saveIstEventToDataConnect(input: IstEventInput): Promise<void> {
  const dc = getOrInitDataConnect();

  if (!dc) {
    console.warn('[DataConnect] Skipping saveIstEventToDataConnect because Data Connect client is not initialized');
    return;
  }

  try {
    const ref = createIstEventRef(dc, {
      userId: input.userId,
      courseId: input.courseId,
      threadId: input.threadId,
      messageId: input.messageId,
      utterance: input.utterance,
      intent: input.intent,
      skills: input.skills,
      trajectory: input.trajectory,
    });

    await executeMutation(ref);
    console.log('[DataConnect] Successfully created IstEvent for messageId', input.messageId);
  } catch (err) {
    console.error('[DataConnect] Failed to create IstEvent for messageId', input.messageId, err);
  }
}
