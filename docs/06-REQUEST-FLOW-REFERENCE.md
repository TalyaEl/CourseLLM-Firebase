# CourseWise Request Flow Analysis

This document maps all requests sent by the CourseWise application, including Firebase (Firestore + Auth) calls and external HTTP endpoints.

---

## 1. Firebase Initialization

### `src/firebase.ts`

**Purpose:** Initializes Firebase client SDK for use in client-side React components.

**Configuration:**
```typescript
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functions = getFunctions(app);
```

**Environment:** 
- Uses environment variables prefixed with `REACT_APP_` (Note: This is unusual for Next.js, which typically uses `NEXT_PUBLIC_` for client-side env vars)
- **Points to production Firebase** by default (no emulator connection logic found)
- No emulator configuration detected in this file

**Exports:**
- `db` - Firestore instance (client-side)
- `functions` - Firebase Functions instance (client-side)
- `analyzeMessageFn` - Pre-configured callable function reference

---

### `functions/src/firebaseAdmin.ts`

**Purpose:** Initializes Firebase Admin SDK for use in Cloud Functions (server-side).

**Configuration:**
```typescript
if (!getApps().length) {
  initializeApp();
}
export { getFirestore };
```

**Environment:**
- Uses default Firebase Admin initialization (reads from `GOOGLE_APPLICATION_CREDENTIALS` or uses Application Default Credentials)
- **Points to production Firebase** by default
- No emulator connection logic found

**Note:** `firebase.json` defines emulator ports (Firestore: 8080, Functions: 5001), but there's no code that actually connects to these emulators.

---

## 2. Firebase Usage (Firestore + Auth)

### Firestore Operations

#### A. Client-Side Firestore Usage

##### `src/components/IntentInspector.tsx` – `useEffect` hook

- **Type:** Firestore (read, real-time listener)
- **Side:** Client-side (React component)
- **Operation:** `onSnapshot` listener on document path `threads/{threadId}/analysis/{messageId}`
- **Purpose:** Real-time subscription to message analysis results stored in Firestore
- **Firebase Instance:** Uses `db` from `src/firebase.ts` (client SDK)
- **Code:**
  ```typescript
  const ref = doc(db, 'threads', threadId, 'analysis', messageId);
  const unsubscribe = onSnapshot(ref, (snapshot) => { ... });
  ```

---

#### B. Server-Side Firestore Usage (Cloud Functions)

##### `functions/src/analyzeMessage.ts` – `analyzeMessage` Cloud Function

- **Type:** Firestore (write)
- **Side:** Server-side (Firebase Cloud Function)
- **Operation:** `ref.set(analysis, { merge: true })` on document path `threads/{threadId}/analysis/{messageId}`
- **Purpose:** Writes message analysis results to Firestore after processing
- **Firebase Instance:** Uses `getFirestore()` from `functions/src/firebaseAdmin.ts` (Admin SDK)
- **Code:**
  ```typescript
  const db = getFirestore();
  const ref = db
    .collection('threads')
    .doc(data.threadId)
    .collection('analysis')
    .doc(messageId);
  await ref.set(analysis, { merge: true });
  ```

---

### Firebase Auth Usage

**Note:** No explicit Firebase Auth calls found in the codebase. The `LoginForm` component (`src/components/auth/LoginForm.tsx`) is a UI-only component with no authentication logic. The app appears to use mock/demo authentication or authentication is handled elsewhere (not visible in the scanned files).

**However:**
- The Cloud Function `analyzeMessage` checks for authentication via `request.auth?.uid`, indicating that Firebase Auth is expected to be used, but the client-side auth implementation is not present in the scanned files.

---

### Firebase Functions (Callable Functions)

#### `src/lib/ist/engineCallable.ts` – `CallableIstAnalysisEngine.analyzeMessage`

- **Type:** Firebase Callable Function
- **Side:** Client-side (can be used in React components)
- **Operation:** Calls Cloud Function `analyzeMessage` via `httpsCallable`
- **Purpose:** Alternative engine implementation that calls the Firebase Cloud Function instead of the Next.js API route
- **Firebase Instance:** Uses `getFunctions()` (client SDK, initialized in `src/firebase.ts`)
- **Code:**
  ```typescript
  const functions = getFunctions();
  const callable = httpsCallable<AnalyzeMessageRequest, MessageAnalysis>(
    functions,
    'analyzeMessage'
  );
  const result = await callable(req);
  ```

**Note:** This engine is selected when `NEXT_PUBLIC_IST_ENGINE_MODE=callable` (default is `api`).

---

## 3. External HTTP / IST / LLM Calls

### A. DSPy FastAPI Service Calls

#### `src/app/api/dspy/intent-skill-trajectory/route.ts` – `POST` handler

- **File Path:** `src/app/api/dspy/intent-skill-trajectory/route.ts`
- **Function:** `POST` (Next.js API route handler)
- **URL:** 
  - Base URL: `process.env.DSPY_SERVICE_URL || process.env.NEXT_PUBLIC_DSPY_SERVICE_URL || 'http://localhost:8000'`
  - Full URL: `${dspyServiceUrl}/api/intent-skill-trajectory`
- **Purpose:** Proxy route that forwards IST extraction requests from frontend to Python DSPy service
- **Controlled by env vars:** 
  - `DSPY_SERVICE_URL` (server-side)
  - `NEXT_PUBLIC_DSPY_SERVICE_URL` (client-side, though this route is server-side)
- **Side:** Server-side (Next.js API route)
- **Method:** `fetch()` POST request with JSON body

---

#### `src/app/api/dspy/quiz/route.ts` – `POST` handler

- **File Path:** `src/app/api/dspy/quiz/route.ts`
- **Function:** `POST` (Next.js API route handler)
- **URL:**
  - Base URL: `process.env.DSPY_SERVICE_URL || process.env.NEXT_PUBLIC_DSPY_SERVICE_URL || 'http://localhost:8000'`
  - Full URL: `${dspyServiceUrl}/api/quiz`
- **Purpose:** Proxy route that forwards quiz generation requests from frontend to Python DSPy service
- **Controlled by env vars:**
  - `DSPY_SERVICE_URL` (server-side)
  - `NEXT_PUBLIC_DSPY_SERVICE_URL` (client-side, though this route is server-side)
- **Side:** Server-side (Next.js API route)
- **Method:** `fetch()` POST request with JSON body

---

#### `src/lib/ist/extractIST.ts` – `extractAndStoreIST`

- **File Path:** `src/lib/ist/extractIST.ts`
- **Function:** `extractAndStoreIST`
- **URL:**
  - Base URL: `process.env.DSPY_SERVICE_URL || 'http://localhost:8000'`
  - Full URL: `${dspyServiceUrl}/api/intent-skill-trajectory`
- **Purpose:** Direct server-side call to DSPy service for IST extraction (bypasses Next.js proxy to avoid loopback issues)
- **Controlled by env vars:**
  - `DSPY_SERVICE_URL` (server-side only, no `NEXT_PUBLIC_` variant)
- **Side:** Server-side (used in server actions/flows)
- **Method:** `fetch()` POST request with enriched payload (includes `chat_history`, `ist_history`, `student_profile`)
- **Note:** This is called asynchronously from Genkit flows (e.g., `provideSocraticGuidance`) and is non-blocking (best-effort)

---

#### `src/components/student/PracticeQuiz.tsx` – `handleGenerateQuiz`

- **File Path:** `src/components/student/PracticeQuiz.tsx`
- **Function:** `handleGenerateQuiz` (client component handler)
- **URL:** `/api/dspy/quiz` (relative URL, calls Next.js API route)
- **Purpose:** Client-side call to Next.js API route for quiz generation
- **Controlled by env vars:** Indirectly via the API route (see above)
- **Side:** Client-side (React component)
- **Method:** `fetch()` POST request to Next.js API route, which then forwards to DSPy service

---

### B. Next.js Internal API Routes

#### `src/lib/ist/engine.ts` – `ApiIstAnalysisEngine.analyzeMessage`

- **File Path:** `src/lib/ist/engine.ts`
- **Function:** `ApiIstAnalysisEngine.analyzeMessage`
- **URL:** `/api/analyze-message` (relative URL, calls Next.js API route)
- **Purpose:** Client-side call to Next.js API route for message analysis
- **Controlled by env vars:** None (uses relative URL)
- **Side:** Client-side (can be used in React components)
- **Method:** `fetch()` POST request
- **Note:** This engine is selected when `NEXT_PUBLIC_IST_ENGINE_MODE=api` (default)

---

#### `src/app/api/analyze-message/route.ts` – `POST` handler

- **File Path:** `src/app/api/analyze-message/route.ts`
- **Function:** `POST` (Next.js API route handler)
- **URL:** Internal Next.js route (no external HTTP call)
- **Purpose:** Server-side handler that calls Genkit flow `analyzeMessage` (does not call Firebase or external services directly)
- **Controlled by env vars:** None
- **Side:** Server-side (Next.js API route)
- **Note:** This route does NOT write to Firestore (comment in code: "הורדנו את ה-Firestore Web SDK מה-API route"). The analysis is returned to the client, and if using the Cloud Function engine, Firestore writes happen in the Cloud Function.

---

### C. Genkit/LLM Calls

#### `src/ai/genkit.ts`

- **File Path:** `src/ai/genkit.ts`
- **Purpose:** Initializes Genkit with Google Gemini AI
- **Configuration:**
  ```typescript
  export const ai = genkit({
    plugins: [
      googleAI({
        apiKey: process.env.GOOGLE_API_KEY || process.env.LLM_API_KEY
      })
    ],
    model: courseModel,
  });
  ```
- **Controlled by env vars:**
  - `GOOGLE_API_KEY` (primary)
  - `LLM_API_KEY` (fallback)
- **External Service:** Google Gemini API (via Genkit)
- **Side:** Server-side (used in server actions/flows)

---

#### Genkit Flows (Server Actions)

The following flows use Genkit (which calls Google Gemini):

1. **`src/ai/flows/analyze-message.ts`** – `analyzeMessage`
   - Uses Genkit flow `analyzeMessageFlow`
   - Currently returns placeholder data (not making real LLM calls yet)

2. **`src/ai/flows/provide-socratic-guidance.ts`** – `provideSocraticGuidance`
   - Uses Genkit flow `provideSocraticGuidanceFlow`
   - Calls Genkit prompt `provideSocraticGuidancePrompt`
   - Also calls `extractAndStoreIST` (which calls DSPy service)

3. **`src/ai/flows/socratic-course-chat.ts`** – `socraticCourseChat`
   - Uses Genkit flow (called from `src/app/student/courses/[courseId]/_components/chat-panel.tsx`)

4. **Other flows** (not actively used in current UI):
   - `generate-practice-quiz.ts` (replaced by DSPy service)
   - `personalized-learning-assessment.ts`
   - `summarize-uploaded-material.ts`

---

### D. Python DSPy Service (External Microservice)

**Location:** `dspy_service/app.py`

**Endpoints:**
- `GET /health` - Health check
- `POST /api/intent-skill-trajectory` - IST extraction (called by Next.js)
- `POST /api/quiz` - Quiz generation (called by Next.js)

**External LLM Calls:**
- The DSPy service itself makes calls to:
  - **OpenAI API** (if `LLM_PROVIDER=openai`, requires `OPENAI_API_KEY`)
  - **Google Gemini API** (if `LLM_PROVIDER=gemini`, requires `GEMINI_API_KEY` or `GOOGLE_API_KEY`)

**Controlled by env vars:**
- `LLM_PROVIDER` (default: `"openai"`)
- `LLM_MODEL` (optional, has defaults)
- `OPENAI_API_KEY` (for OpenAI)
- `GEMINI_API_KEY` or `GOOGLE_API_KEY` (for Gemini)

---

## 4. Summary

### Request Flow Overview

**When a student asks a question in the UI:**

1. **Client Component** (e.g., `SocraticChat`, `ChatPanel`) calls a **Genkit server action** (e.g., `provideSocraticGuidance`, `socraticCourseChat`)

2. **Genkit Server Action**:
   - Calls **Google Gemini API** via Genkit (using `GOOGLE_API_KEY`)
   - Optionally calls `extractAndStoreIST` (best-effort, non-blocking)

3. **IST Extraction** (`extractAndStoreIST`):
   - Calls **DSPy FastAPI service** at `http://localhost:8000/api/intent-skill-trajectory` (or `DSPY_SERVICE_URL` in production)
   - DSPy service calls **OpenAI or Gemini** (depending on `LLM_PROVIDER`)
   - Stores IST events in **JSON file** (if `IST_STORAGE_MODE=json`, default) or **PostgreSQL** (if `IST_STORAGE_MODE=postgres`, not yet implemented)

4. **Message Analysis** (if using IST engine):
   - Client calls `/api/analyze-message` (Next.js API route)
   - Next.js route calls Genkit flow `analyzeMessage` (currently returns placeholder data)
   - OR client calls Firebase Cloud Function `analyzeMessage` (if `NEXT_PUBLIC_IST_ENGINE_MODE=callable`)
   - Cloud Function writes analysis to **Firestore** at `threads/{threadId}/analysis/{messageId}`

5. **Real-time Updates**:
   - `IntentInspector` component subscribes to Firestore document via `onSnapshot` to display analysis results in real-time

---

### Which Parts Talk to Firebase Cloud?

1. **Firestore Writes:**
   - `functions/src/analyzeMessage.ts` (Cloud Function) writes analysis results to Firestore

2. **Firestore Reads (Real-time):**
   - `src/components/IntentInspector.tsx` subscribes to Firestore documents via `onSnapshot`

3. **Firebase Functions:**
   - `src/lib/ist/engineCallable.ts` calls Cloud Function `analyzeMessage` (if `NEXT_PUBLIC_IST_ENGINE_MODE=callable`)

**Note:** All Firebase operations currently point to **production Firebase** (no emulator connection code found).

---

### Which Parts Talk to Local Services?

1. **DSPy FastAPI Service:**
   - Default URL: `http://localhost:8000`
   - Called by:
     - `src/app/api/dspy/intent-skill-trajectory/route.ts`
     - `src/app/api/dspy/quiz/route.ts`
     - `src/lib/ist/extractIST.ts`

2. **Next.js Dev Server:**
   - Runs on port `9002` (see `package.json`: `next dev --turbopack -p 9002`)
   - Client components call relative URLs like `/api/dspy/quiz`, `/api/analyze-message`

3. **IST Storage (JSON):**
   - Default: `src/mocks/ist/events.json` (local file system)
   - Controlled by `IST_STORAGE_MODE=json` (default)

---

### Where to Plug in Firebase Emulator Flag

**Currently, there is NO emulator connection code in the codebase.** To add emulator support:

1. **Client-Side (`src/firebase.ts`):**
   ```typescript
   if (process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === 'true') {
     connectFirestoreEmulator(db, 'localhost', 8080);
     connectFunctionsEmulator(functions, 'localhost', 5001);
   }
   ```

2. **Server-Side (`functions/src/firebaseAdmin.ts`):**
   ```typescript
   if (process.env.FIREBASE_USE_EMULATOR === 'true') {
     process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
   }
   ```

**Environment Variables to Add:**
- `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true` (for client-side)
- `FIREBASE_USE_EMULATOR=true` (for server-side/Cloud Functions)

**Note:** `firebase.json` already defines emulator ports (Firestore: 8080, Functions: 5001), but the code doesn't use them yet.

---

### Environment Variables Summary

| Variable | Purpose | Default | Used In |
|----------|---------|---------|---------|
| `REACT_APP_FIREBASE_*` | Firebase client config | None (required) | `src/firebase.ts` |
| `DSPY_SERVICE_URL` | DSPy service base URL | `http://localhost:8000` | API routes, `extractIST.ts` |
| `NEXT_PUBLIC_DSPY_SERVICE_URL` | DSPy service base URL (client) | `http://localhost:8000` | API routes (fallback) |
| `GOOGLE_API_KEY` | Google Gemini API key | None (required) | `src/ai/genkit.ts` |
| `LLM_API_KEY` | Fallback LLM API key | None | `src/ai/genkit.ts` |
| `IST_STORAGE_MODE` | IST storage backend | `json` | `src/lib/ist/repositories/index.ts` |
| `NEXT_PUBLIC_IST_ENGINE_MODE` | IST engine mode | `api` | `src/lib/ist/engine.ts` |
| `LLM_PROVIDER` | DSPy LLM provider | `openai` | `dspy_service/app.py` |
| `OPENAI_API_KEY` | OpenAI API key | None | `dspy_service/app.py` |
| `GEMINI_API_KEY` | Gemini API key | None | `dspy_service/app.py` |

---

### Key Observations

1. **No Firebase Auth Implementation:** The codebase has no client-side Firebase Auth calls (signIn, signOut, etc.), though Cloud Functions expect authenticated users.

2. **No Emulator Support:** Despite `firebase.json` defining emulator ports, there's no code that connects to emulators.

3. **Mixed Storage Backends:** IST events use JSON file storage (local) or future PostgreSQL, while message analysis uses Firestore (cloud).

4. **Dual IST Engine Modes:** The app supports two modes for message analysis:
   - `api` mode: Calls Next.js API route → Genkit flow (default)
   - `callable` mode: Calls Firebase Cloud Function directly

5. **Production vs Local:** 
   - Firebase: Always production (no emulator)
   - DSPy: Defaults to localhost, configurable via env vars
   - IST Storage: Defaults to local JSON file

