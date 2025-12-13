# IST Pipeline Status Snapshot - December 9, 2025

## 1. High-Level Overview

**Project**: CourseWise - An AI-powered tutoring system for CS courses built with Next.js 15, TypeScript, Firebase/Genkit, and a Python DSPy microservice.

**Update**: This snapshot covers the successful re-introduction of **Firebase Data Connect (PostgreSQL)** as a parallel storage backend for IST events, alongside the existing JSON and Firestore implementations.

**Current State**:
- **Existing Flow Preserved**: The JSON log and Firestore Emulator writes continue to work exactly as before.
- **New Data Connect Write**: The Cloud Function `analyzeMessage` now *also* writes IST events to the Data Connect emulator (best-effort, non-blocking).
- **New Dev Viewer**: A dedicated page (`/ist-dev/dataconnect`) allows developers to view IST events stored in Data Connect.
- **Limitation**: The *read path* for the DSPy prompt context still uses `events.json`; switching this to Data Connect is the next logical step.

---

## 2. Recent Changes / Progress since December 6, 2025

### Data Connect Scaffolding
- **Configuration**:
  - `firebase.json` updated to include the `dataconnect` service and emulator (port `9399`).
  - `dataconnect/` folder created with standard structure (`dataconnect.yaml`, `connector/connector.yaml`).
- **Schema (`dataconnect/schema/ist_events.gql`)**:
  - Defines `type IstEvent @table`:
    - `id`: UUID (auto-generated)
    - `userId`, `courseId`, `threadId`, `messageId`: Identifiers
    - `utterance`, `intent`: Core content
    - `skills`: `Any` scalar (mapped to `jsonb`)
    - `trajectory`: `Any` scalar (mapped to `jsonb`)
    - `createdAt`: Timestamp
- **Operations (`dataconnect/connector/ist_events_operations.gql`)**:
  - `query IstEventsByUserAndCourse`: Lists events filtered by user/course, ordered by time.
  - `mutation CreateIstEvent`: Inserts a new event.

### SDK Generation & Configuration
- **Dual SDK Generation**:
  - `firebase dataconnect:sdk:generate` produces two SDKs:
    1. **Web SDK**: `src/dataconnect-generated` (for Next.js client)
    2. **Functions SDK**: `functions/src/dataconnect-generated` (for Cloud Functions)
- **Dependencies**:
  - `functions/package.json` updated to include `firebase` (v11+) for Data Connect client support.

### Cloud Functions Integration (WRITE Path)
- **Client (`functions/src/dataconnect/istEventsClient.ts`)**:
  - Implements lazy initialization of the Firebase App (prevents load-time crashes).
  - Uses `getDataConnect` and `connectDataConnectEmulator` to connect to the local emulator.
  - Exports `saveIstEventToDataConnect`: A safe, error-catching helper that executes the `CreateIstEvent` mutation.
  - **Logging**:
    - `[DataConnect] Initialized Data Connect client`
    - `[DataConnect] Successfully created IstEvent for messageId ...`
    - Non-fatal errors are logged but never thrown.
- **Analysis Function (`functions/src/analyzeMessage.ts`)**:
  - Imported the client helper.
  - Added a **non-blocking side effect** after the DSPy call:
    - Calls `saveIstEventToDataConnect` with the full enriched payload (including skills/trajectory as raw JSON).
    - Logs: `[analyzeMessage] About to save IST event to DataConnect...` and `[analyzeMessage] DataConnect save completed...`.
  - **Impact**: Zero impact on the existing Firestore write or chat response latency.

### Dev Viewer in Next.js (READ Path)
- **Web Client (`src/lib/dataConnect/istEventsWebClient.ts`)**:
  - Initializes Data Connect on the client side (using existing `src/firebase.ts` app).
  - Connects to the emulator if `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true`.
  - Fetches events using the generated `istEventsByUserAndCourseRef`.
- **UI Page (`src/app/ist-dev/dataconnect/page.tsx`)**:
  - Simple debug interface at `/ist-dev/dataconnect`.
  - Inputs for `userId` (default: `demo-user`) and `courseId` (default: `cs202`).
  - Displays list of events with:
    - Intent and Utterance
    - Skills (rendered as a bullet list)
    - Trajectory (rendered as a numbered list)

---

## 3. Architecture / Components (Updated)

```
Student Message (UI)
  ↓
Cloud Function: analyzeMessage
  ↓
DSPy Service (Extraction)
  ↓
Cloud Function: Response Handling
  ├── (A) Write to Firestore Emulator (for IntentInspector UI) [EXISTING]
  ├── (B) Write to Data Connect Emulator (for long-term storage) [NEW]
  └── (C) Return analysis to Chat UI [EXISTING]
```

### Key Components
- **Data Connect Emulator**: Runs on port `9399`, backed by a local PostgreSQL instance (PGLite).
- **Functions SDK**: Typed access for backend writes.
- **Web SDK**: Typed access for frontend reads (demos).

---

## 4. Current Limitation (Important)

**Reading IST history from Data Connect is NOT wired into the prompt yet.**

- The `analyzeMessage` function currently uses `loadIstContextFromJson` (reading `src/mocks/ist/events.json`) to populate the `ist_history` sent to DSPy.
- The logs confirm this: `[IST][Functions] Loaded X IST events from JSON...` or `events.json not found`.
- **Status**:
  - ✅ Writing new events to Data Connect: **Done**.
  - ✅ Viewing events from Data Connect: **Done**.
  - ❌ Using Data Connect history for DSPy context: **Pending**.

---

## 5. Dev/Testing Instructions (Updated)

### How to Run Everything Now

1. **Terminal 1 (DSPy)**:
   ```bash
   cd dspy_service
   .\venv\Scripts\activate
   python -m uvicorn app:app --reload --port 8000
   ```

2. **Terminal 2 (Firebase)**:
   ```bash
   # Starts Functions, Firestore, and Data Connect emulators
   firebase emulators:start
   ```

3. **Terminal 3 (Next.js)**:
   ```bash
   npm run dev
   ```

### Verification Steps
1. **Trigger Extraction**:
   - Go to `http://localhost:9002/debug-analysis` OR use the chat at `/student/courses/cs202`.
2. **Check Logs**:
   - Look at the Firebase Emulator terminal.
   - Confirm you see: `[DataConnect] Successfully created IstEvent for messageId ...`
3. **Check Viewer**:
   - Go to `http://localhost:9002/ist-dev/dataconnect`.
   - Click "Load IST Events".
   - Verify the new event appears with correct Skills and Trajectory.

---

## 6. Next Steps

1.  **Implement History Fetching**:
    -   Create a helper `getRecentIstEventsFromDataConnect(userId, courseId)` in `functions`.
    -   Update `analyzeMessage.ts` to fetch history from Data Connect instead of (or as a fallback to) the JSON file.
    -   Pass this history to the DSPy service.

2.  **Retire JSON Storage (Optional)**:
    -   Once Data Connect is the source of truth for history, the local JSON file can be deprecated.

3.  **Production Deployment**:
    -   Provision real Cloud SQL instance.
    -   Configure proper IAM permissions for Cloud Functions to write to Data Connect in production.

---

**Last Updated**: December 9, 2025
**Status**: ✅ Data Connect write path and dev viewer active. Hybrid storage (JSON + Firestore + Data Connect) running in parallel.

