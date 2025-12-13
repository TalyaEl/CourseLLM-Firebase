import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    process.env.REACT_APP_FIREBASE_API_KEY ??
    'demo-api-key',
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    process.env.REACT_APP_FIREBASE_AUTH_DOMAIN ??
    'demo.firebaseapp.com',
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    process.env.REACT_APP_FIREBASE_PROJECT_ID ??
    'demo-no-project',
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    process.env.REACT_APP_FIREBASE_STORAGE_BUCKET ??
    'demo.appspot.com',
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID ??
    '1234567890',
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    process.env.REACT_APP_FIREBASE_APP_ID ??
    'demo-app-id',
};

export const app = initializeApp(firebaseConfig);

console.log(
  '[Firebase] Initialized app with projectId =',
  firebaseConfig.projectId
);

export const db = getFirestore(app);
export const functions = getFunctions(app);

// Connect to Firebase Emulators if enabled
if (process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === 'true') {
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || 'localhost';
  const firestorePort = Number(process.env.FIRESTORE_EMULATOR_PORT) || 8080;
  connectFirestoreEmulator(db, firestoreHost, firestorePort);

  const functionsHost = process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST || 'localhost';
  const functionsPort = Number(process.env.FIREBASE_FUNCTIONS_EMULATOR_PORT) || 5001;
  connectFunctionsEmulator(functions, functionsHost, functionsPort);

  console.log('[Firebase] Connected to Firestore & Functions emulators');
}

export const analyzeMessageFn = httpsCallable(functions, 'analyzeMessage');
