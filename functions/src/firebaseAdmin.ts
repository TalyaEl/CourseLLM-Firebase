
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp();
}

// Log when running against the Firestore Emulator
if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.log('[Firebase Admin] Connecting to Firestore emulator at', process.env.FIRESTORE_EMULATOR_HOST);
}

export { getFirestore };
