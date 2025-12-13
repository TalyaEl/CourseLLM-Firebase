# IST Pipeline Status Snapshot - December 6, 2025

## 1. High-Level Overview

**Project**: CourseWise - An AI-powered tutoring system for CS courses built with Next.js 15, TypeScript, Firebase/Genkit, and a Python DSPy microservice.

**IST Pipeline**: The Intent-Skill-Trajectory (IST) extraction system analyzes student questions in the Socratic chat flow to extract:
- **Intent**: What the student is trying to understand/do
- **Skills**: Relevant CS skills or concepts they need
- **Trajectory**: Suggested next learning steps

**End-to-End Flow** (Now Fully Integrated):
1. Student asks a question in the Socratic chat UI (`/student/courses/[courseId]`)
2. Frontend calls `analyzeAndStoreIstForMessage()` via `CallableIstAnalysisEngine`
3. Cloud Function `analyzeMessage` (Firebase Functions Emulator) receives the request
4. Cloud Function calls the **real DSPy microservice** at `/api/intent-skill-trajectory` (enriched with IST history when in emulator)
5. DSPy service uses OpenAI/Gemini to extract IST data
6. Cloud Function maps DSPy response to `MessageAnalysis` format and writes to **Firestore Emulator** under `threads/{threadId}/analysis/{messageId}`
7. `IntentInspector` UI component reads from Firestore Emulator in real-time and displays IST analysis below the user message
8. In parallel, the existing JSON-based storage (`src/mocks/ist/events.json`) continues to work for course project requirements

**Key Achievement**: The IST pipeline is now wired end-to-end from UI → Next.js → DSPy service → JSON log → Firebase Cloud Function → Firestore Emulator → IntentInspector UI, providing both file-based history (for course requirements) and Firestore documents (for inspection and future DB migration).

---

## 2. Recent Changes / Progress since November 30, 2025

### Firebase Emulator Wiring (Client + Admin)

- **`src/firebase.ts`** now conditionally connects Firestore & Functions to local emulators:
  - When `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true`, connects to:
    - Firestore Emulator: `localhost:8080` (configurable via `FIRESTORE_EMULATOR_HOST`/`FIRESTORE_EMULATOR_PORT`)
    - Functions Emulator: `localhost:5001` (configurable via `FIREBASE_FUNCTIONS_EMULATOR_HOST`/`FIREBASE_FUNCTIONS_EMULATOR_PORT`)
  - Uses `NEXT_PUBLIC_FIREBASE_*` environment variables (Next.js client-side pattern) with fallback to `REACT_APP_FIREBASE_*` for compatibility
  - Defaults to `projectId: 'demo-no-project'` when env vars are missing (prevents `undefined` in URLs)

- **`functions/src/firebaseAdmin.ts`** logs when it connects to the Firestore emulator:
  - Detects `FIRESTORE_EMULATOR_HOST` environment variable (automatically set by Firebase Emulator)
  - Logs: `[Firebase Admin] Connecting to Firestore emulator at 127.0.0.1:8080`

### Cloud Function `analyzeMessage`

- **Implementation**: Callable v2 HTTPS function (`onCall` from `firebase-functions/v2/https`)
- **Authentication**: 
  - In emulator mode (`FUNCTIONS_EMULATOR === 'true'`): Allows calls without Firebase Auth by using demo UID (`demo-user`) when `request.auth?.uid` is missing
  - In production: Still requires authenticated `uid` and throws `HttpsError('unauthenticated', ...)` if missing
- **DSPy Integration**: 
  - Now calls the **real DSPy microservice** at `/api/intent-skill-trajectory` instead of returning hard-coded analysis
  - Uses `DSPY_SERVICE_URL` environment variable (defaults to `http://127.0.0.1:8000`)
  - Sends enriched payload with `chat_history` and `ist_history` when running in emulator
- **IST History Enrichment**:
  - When `FUNCTIONS_EMULATOR === 'true'`, loads IST context from `src/mocks/ist/events.json` via `loadIstContextFromJson()`
  - Filters events by `userId` (e.g., `demo-user`) and `courseId` (if provided)
  - Maps to DSPy format: `ist_history` array with `{ intent, skills, trajectory, created_at }`
  - Returns empty arrays if file is missing or unparseable (defensive, non-blocking)
- **Response Mapping**: 
  - Maps DSPy response (`{ intent: string, skills: string[], trajectory: string[] }`) to canonical `MessageAnalysis` structure:
    - `intent`: Parsed to `IntentLabel` via keyword matching (defaults to `ASK_EXPLANATION`)
    - `skills`: Mapped to `skills.items[]` with `id`, `displayName`, `confidence: 0.8`, `role: 'FOCUS'/'SECONDARY'`
    - `trajectory`: Mapped to `trajectory.suggestedNextNodes[]` with `id: 'step-N'`, `reason`, `priority`
    - `metadata`: Includes `processedAt`, `modelVersion: 'ist-v1-dspy'`, `threadId`, `messageId`, `uid`
- **Firestore Write**: 
  - Writes `MessageAnalysis` to Firestore Emulator under `threads/{threadId}/analysis/{messageId}`
  - Uses `ref.set(analysis, { merge: true })` for idempotent writes
  - Logs success: `[analyzeMessage] Successfully wrote analysis to Firestore`
- **Error Handling**: 
  - Wrapped in `try/catch` with explicit logging: `[analyzeMessage] Unhandled error: ...`
  - Rethrows `HttpsError` instances as-is, wraps other errors in `HttpsError('internal', ...)`

### IST Engine + UI Integration

- **Engine Mode**: `NEXT_PUBLIC_IST_ENGINE_MODE=callable` now uses `CallableIstAnalysisEngine`:
  - Imports pre-initialized `functions` instance from `src/firebase.ts` (prevents "No Firebase App" errors)
  - Calls `httpsCallable(functions, 'analyzeMessage')` with `AnalyzeMessageRequest` payload
  - Returns `MessageAnalysis` directly from Cloud Function response

- **Real Student Chat Flow**:
  - `/student/courses/[courseId]` chat panel (`ChatPanel` component) now calls IST pipeline for every **student message**
  - Generates deterministic IDs:
    - `threadId`: `demo-thread-${courseId}` (or `demo-thread-standalone` if no courseId)
    - `messageId`: `msg-${Date.now().toString()}` (timestamp-based unique ID)
  - Calls `analyzeAndStoreIstForMessage()` **non-blocking** (fire-and-forget with `.catch()`)
  - Logs: `[IST] analyzeAndStoreIstForMessage for { threadId, messageId, courseId }`

- **IntentInspector UI**:
  - Added below each user message in the chat panel
  - Reads from Firestore Emulator in real-time using `onSnapshot(doc(db, 'threads', threadId, 'analysis', messageId))`
  - Displays IST analysis with:
    - Primary Intent (label + confidence)
    - Skills list (with roles: FOCUS / SECONDARY)
    - Trajectory (status, currentNodes, suggestedNextNodes with reasons)
    - Metadata (processedAt, modelVersion, threadId, messageId, uid)
  - Shows "No analysis available" if document doesn't exist yet (graceful loading state)

- **Dual Storage**:
  - **JSON-based logging** (`src/mocks/ist/events.json`) still works exactly as before:
    - Next.js `extractAndStoreIST()` continues to write to JSON file
    - Used for course project requirements and analysis
  - **Firestore Emulator** stores per-message analyses:
    - Used for real-time UI display via `IntentInspector`
    - Can be inspected in Firebase Emulator UI at `http://127.0.0.1:4000/firestore`
    - Future migration path to production Firestore

### Debug Flow

- **`/debug-analysis` page**: 
  - Calls the callable function directly with fixed `threadId=debug-thread-2` and `messageId=debug-message-2`
  - Makes it easy for TAs to trigger a single test IST extraction
  - Inspect results in Firestore Emulator UI under `threads/debug-thread-2/analysis/debug-message-2`
  - Page remains unchanged and functional (reference implementation)

---

## 3. Architecture / Components

### Components

- **DSPy service** (FastAPI/Uvicorn on `http://127.0.0.1:8000`)
  - Performs IST extraction using DSPy + LLM (OpenAI/Gemini)
  - Endpoint: `/api/intent-skill-trajectory`
  - Accepts enriched payload with `chat_history`, `ist_history`, `student_profile`
  - Returns: `{ intent: string, skills: string[], trajectory: string[] }`

- **Next.js app** (`http://localhost:9002`)
  - Orchestrates chat flow and UI rendering
  - Calls DSPy directly (for JSON logging via `extractAndStoreIST()`)
  - Calls DSPy indirectly via Cloud Function (for Firestore writes via `CallableIstAnalysisEngine`)
  - Client-side Firebase SDK connects to emulators when `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true`

- **Firebase Functions emulator** (`http://localhost:5001`)
  - Hosts `analyzeMessage` callable function
  - Calls DSPy service with enriched context (IST history from JSON when in emulator)
  - Writes results to Firestore Emulator
  - Uses Firebase Admin SDK (connects to Firestore Emulator via `FIRESTORE_EMULATOR_HOST`)

- **Firestore Emulator** (`http://127.0.0.1:8080`)
  - Stores per-message IST analyses under `threads/{threadId}/analysis/{messageId}`
  - Documents contain full `MessageAnalysis` structure (intent, skills, trajectory, metadata)
  - Accessible via Firebase Emulator UI at `http://127.0.0.1:4000/firestore`

- **IntentInspector UI** (React component)
  - Reads from Firestore Emulator using `onSnapshot` (real-time updates)
  - Displays IST analysis below each user message in chat
  - Shows loading state when analysis document doesn't exist yet

- **JSON Storage** (`src/mocks/ist/events.json`)
  - Continues to store IST events for course project requirements
  - Used by Cloud Function to enrich DSPy requests with IST history (in emulator mode)
  - Managed by `JsonIstEventRepository` (unchanged from previous snapshot)

### Data Flow

```
Student Message (UI)
  ↓
ChatPanel.handleChatSubmit()
  ↓
analyzeAndStoreIstForMessage() [non-blocking]
  ↓
CallableIstAnalysisEngine.analyzeMessage()
  ↓
Cloud Function: analyzeMessage (Firebase Functions Emulator)
  ↓
loadIstContextFromJson() [if emulator] → reads src/mocks/ist/events.json
  ↓
callDspyService() → POST /api/intent-skill-trajectory (with enriched context)
  ↓
DSPy Service → LLM extraction
  ↓
Cloud Function: mapDspyToMessageAnalysis()
  ↓
Firestore Emulator: threads/{threadId}/analysis/{messageId}
  ↓
IntentInspector: onSnapshot() → real-time UI display
```

---

## 4. Dev/Testing Instructions

### Initial Setup (First Time Only)

Before running the system, ensure you have:

1. **Copied environment variable templates**:
   - Copy `.env.example` to `.env.local` in the project root
   - Copy `dspy_service/.env.example` to `dspy_service/.env` and set your `OPENAI_API_KEY` (required for DSPy service)

2. **Installed dependencies**:
   - Run `npm install` in the project root
   - Run `pip install -r requirements.txt` in `dspy_service/` directory

3. **Note on `src/mocks/ist/events.json`**:
   - This file is auto-created on first IST extraction
   - If you want to start with an empty file, copy `src/mocks/ist/events.json.example` (contains `[]`) to `src/mocks/ist/events.json`
   - The code handles missing files gracefully (starts with empty array)

### Three-Terminal Setup

**Terminal 1 – DSPy Service:**
```bash
cd dspy_service
# Activate virtualenv (Windows example)
.\venv\Scripts\activate
python -m uvicorn app:app --reload --port 8000
```

**Terminal 2 – Firebase Emulators:**
```bash
# From project root
firebase emulators:start
```

**Terminal 3 – Next.js Dev Server:**
```bash
# From project root
npm run dev
```

### Testing

1. **Debug Page**: Navigate to `http://localhost:9002/debug-analysis`
   - Triggers a single IST extraction with fixed IDs
   - Check Firestore Emulator UI: `threads/debug-thread-2/analysis/debug-message-2`

2. **Real Chat Flow**: Navigate to `http://localhost:9002/student/courses/cs202` (or any courseId)
   - Send a question in the Socratic chat
   - Observe `IntentInspector` appearing below the user message
   - Check Firestore Emulator UI: `threads/demo-thread-cs202/analysis/msg-<timestamp>`

### Expected Logs

**DSPy Terminal:**
```
[IST] Processing request - utterance: ...
[IST] Returning response - intent length: ..., skills count: ..., trajectory count: ...
```

**Functions Emulator Terminal:**
```
[analyzeMessage] No auth in emulator, using demo UID "demo-user"
[analyzeMessage] Running IST analysis for threadId: ... messageId: ...
[IST][Functions] Loaded X IST events from JSON (userId: demo-user, courseId: ...)
[analyzeMessage] Enriching DSPy request with X IST history items
[analyzeMessage] Calling DSPy service at: http://127.0.0.1:8000/api/intent-skill-trajectory
[analyzeMessage] DSPy response received: { intent: "...", skillsCount: X, trajectoryCount: Y }
[analyzeMessage] IST analysis complete, writing to Firestore...
[analyzeMessage] Successfully wrote analysis to Firestore
```

**Next.js Terminal:**
```
[Firebase] Initialized app with projectId = demo-no-project
[Firebase] Connected to Firestore & Functions emulators
[IST] Using CallableIstAnalysisEngine (Cloud Function backend)
[IST] analyzeAndStoreIstForMessage for { threadId: "...", messageId: "...", courseId: "..." }
```

---

## 5. Open Risks / Next Steps

### High Priority

1. **Real Firebase Auth Integration**
   - Currently uses `demo-user` UID in emulator mode
   - Production needs real `uid` from Firebase Auth
   - Map `uid` to real student profiles for personalized IST extraction

2. **Error Handling Hardening**
   - Add retry logic for DSPy service calls (transient failures)
   - Handle Firestore write failures gracefully (don't break chat flow)
   - Monitor Cloud Function execution time and memory usage

3. **IST History Enrichment**
   - Currently loads from JSON file (emulator only)
   - Future: Load from Firestore or Postgres for production
   - Consider caching IST history to reduce read latency

### Medium Priority

4. **Intent Label Mapping**
   - Current keyword-based mapping is simplistic
   - Consider using DSPy to classify intent labels directly
   - Or use a separate intent classification model

5. **Skills Confidence Scoring**
   - Currently uses default `confidence: 0.8` for all skills
   - DSPy could provide confidence scores if enhanced
   - Use confidence to prioritize skills in UI

6. **Trajectory Status Inference**
   - Currently defaults to `status: 'ON_TRACK'`
   - Could infer from IST history (e.g., `STRUGGLING` if same skill appears multiple times)
   - Use trajectory analysis to suggest remediation steps

### Low Priority / Future

7. **Migration from JSON to Real Database**
   - JSON storage is fine for development and course requirements
   - Production should use Postgres or Firestore
   - `PostgresIstEventRepository` stub exists but needs implementation

8. **Monitoring & Analytics**
   - Track IST extraction success rate
   - Monitor DSPy service latency
   - Analyze skills/trajectory trends per user/course
   - Dashboard for instructors to view student learning patterns

9. **Performance Optimization**
   - Cache IST history in Cloud Function (reduce JSON file reads)
   - Batch Firestore writes if needed
   - Consider async processing for IST extraction (queue-based)

10. **Documentation**
    - API documentation for Cloud Function `analyzeMessage`
    - Architecture diagrams for IST flow
    - Deployment guide for production Firebase project

---

## 6. Quick Recap for Another LLM

### What's Already Working

- ✅ **Complete IST extraction pipeline** from UI → Cloud Function → DSPy → Firestore Emulator → IntentInspector UI
- ✅ **Firebase Emulator integration** (client SDK + Admin SDK) for local development
- ✅ **Dual storage**: JSON file (`src/mocks/ist/events.json`) + Firestore Emulator documents
- ✅ **Real DSPy service integration** in Cloud Function (no more hard-coded responses)
- ✅ **IST history enrichment** from JSON file when running in emulator
- ✅ **IntentInspector UI** displaying real-time IST analysis from Firestore
- ✅ **Non-blocking IST calls** in chat flow (doesn't delay LLM responses)
- ✅ **Debug page** (`/debug-analysis`) for easy testing

### How to Run Everything

1. **Terminal 1**: `cd dspy_service && .\venv\Scripts\activate && python -m uvicorn app:app --reload --port 8000`
2. **Terminal 2**: `firebase emulators:start` (from project root)
3. **Terminal 3**: `npm run dev` (from project root)
4. **Test**: Navigate to `http://localhost:9002/student/courses/cs202` and send a question
5. **Inspect**: Open `http://127.0.0.1:4000/firestore` to see documents under `threads/demo-thread-cs202/analysis/`

### What the User Wants to Do Next

Based on TODOs above, likely priorities:
- Add real Firebase Auth and map `uid` to student profiles
- Harden error handling and add retry logic
- Enhance intent label mapping (use DSPy or separate classifier)
- Implement Postgres repository when ready for production migration

### Most Important Files to Open First

1. **`functions/src/analyzeMessage.ts`** - Cloud Function that calls DSPy and writes to Firestore
2. **`functions/src/istContextFromJson.ts`** - Helper that loads IST history from JSON file
3. **`src/app/student/courses/[courseId]/_components/chat-panel.tsx`** - Chat UI that triggers IST extraction
4. **`src/components/IntentInspector.tsx`** - UI component that displays IST analysis
5. **`src/lib/ist/engineCallable.ts`** - Engine that calls Cloud Function
6. **`src/firebase.ts`** - Firebase client SDK initialization with emulator wiring

### Key Architecture Points

- **Cloud Function calls real DSPy service** - no more stubs or hard-coded data
- **Dual storage strategy** - JSON for course requirements, Firestore for UI and future migration
- **IST history enrichment** - Cloud Function reads from JSON file to send context to DSPy (emulator only)
- **Real-time UI updates** - IntentInspector uses Firestore `onSnapshot` for live updates
- **Non-blocking IST extraction** - Chat flow continues normally, IST runs in background
- **Emulator-friendly auth** - Uses `demo-user` UID when no real auth is available

---

**Last Updated**: December 6, 2025  
**Status**: ✅ Working end-to-end with Firebase Emulator + DSPy + Firestore + IntentInspector UI, ready for production Firebase Auth integration

