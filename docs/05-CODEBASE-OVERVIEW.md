# Repository Overview: CourseWise / IST Pipeline

This document provides a comprehensive map of the **CourseWise** repository, explaining the project structure, key components, and data flows. It is designed to help new developers and AI assistants navigate the codebase.

## 1. Project Overview

**CourseWise** is an AI-powered tutoring system for Computer Science courses. It uses a Socratic dialogue approach to help students learn by guiding them rather than giving direct answers.

**Key Technologies:**
*   **Frontend**: Next.js 15 (App Router) + TypeScript.
*   **Backend**: Firebase (Cloud Functions, Firestore, Authentication).
*   **Data Layer**: Firebase Data Connect (PostgreSQL) for structured event storage, plus Firestore for real-time UI updates.
*   **AI/ML**: Python DSPy microservice for Intent-Skill-Trajectory (IST) extraction.

**The IST Pipeline:**
The core intelligence feature is the **Intent-Skill-Trajectory (IST) Pipeline**. Every time a student sends a message, the system analyzes it to extract:
*   **Intent**: What is the student trying to do?
*   **Skills**: Which CS concepts are involved?
*   **Trajectory**: What are the suggested next steps for learning?
This analysis powers the tutoring logic and provides insights to instructors.

---

## 2. Top-Level Directory Map

*   `src/` – Main source code for the Next.js frontend (components, pages, lib).
*   `functions/` – Firebase Cloud Functions (backend logic).
*   `dataconnect/` – Firebase Data Connect configuration, schemas (`.gql`), and operations.
*   `dspy_service/` – Python microservice using DSPy for AI extraction.
*   `public/` – Static assets (images, icons).
*   `scripts/` – Utility scripts for setup or data management.
*   `firebase.json` – Firebase configuration for Emulators, Functions, Hosting, and Data Connect.
*   `dataconnect.yaml` – Root Data Connect service configuration.

---

## 3. Frontend (Next.js) Structure

The frontend is built with Next.js App Router (`src/app`).

### Key Routes
*   `src/app/student/courses/[courseId]/` – The main student interface. Contains the chat UI where the Socratic dialogue happens.
*   `src/app/debug-analysis/` – A dev tool to trigger a single IST analysis with hardcoded inputs for testing.
*   `src/app/ist-dev/dataconnect/page.tsx` – A new developer viewer to inspect IST events stored in PostgreSQL via Data Connect.

### Important Components & Modules
*   **Chat UI**: `src/app/student/courses/[courseId]/_components/chat-panel.tsx` handles user input and displays messages.
*   **IST UI**: `src/components/IntentInspector.tsx` displays the real-time analysis (from Firestore) below chat messages.
*   **Data Connect Client**: `src/lib/dataConnect/istEventsWebClient.ts` initializes the Web SDK and provides functions to fetch events (e.g., `listIstEventsForUserAndCourse`).
*   **Config**: `src/lib/config/storage.ts` defines storage modes (JSON, Data Connect, etc.).

### Integration Points
*   **Calling Functions**: The frontend calls the `analyzeMessage` Cloud Function via `httpsCallable`.
*   **Data Connect Web SDK**: Generated types and functions live in `src/dataconnect-generated`.

---

## 4. Backend: Firebase Functions

The backend logic resides in `functions/`.

### Entry Points
*   `functions/src/index.ts` – Exports the Cloud Functions (e.g., `analyzeMessage`).

### Key Functions
*   **`analyzeMessage`** (`functions/src/analyzeMessage.ts`):
    *   **Trigger**: Callable HTTPS function (called by frontend).
    *   **Action**: Orchestrates the IST analysis.
    *   **Logic**:
        1.  Loads IST history (currently from JSON file).
        2.  Calls the Python DSPy service.
        3.  Writes the result to **Firestore** (for the UI).
        4.  Writes the result to **Data Connect** (PostgreSQL) via `saveIstEventToDataConnect` (non-blocking side effect).
        5.  Writes to JSON log (legacy).

### Data Connect Write Path
*   **Helper**: `functions/src/dataconnect/istEventsClient.ts`.
    *   **Role**: Safely initializes the Firebase Admin / Data Connect environment.
    *   **Lazy Loading**: Initializes `firebase-admin` on demand to prevent cold-start errors.
    *   **Operation**: Uses the generated Functions SDK (`functions/src/dataconnect-generated`) to execute the `CreateIstEvent` mutation.

---

## 5. Data Connect / PostgreSQL Layer

This layer stores structured IST data in a PostgreSQL database managed by Firebase Data Connect.

### Directory Structure (`dataconnect/`)
*   `dataconnect.yaml` – Service definition.
*   `connector/connector.yaml` – Connector config (defines SDK generation targets).
*   `schema/ist_events.gql` – Defines the `IstEvent` table schema.
*   `connector/ist_events_operations.gql` – GraphQL queries and mutations.

### `IstEvent` Schema
*   **Fields**:
    *   `id` (UUID), `userId`, `courseId`, `threadId`, `messageId`.
    *   `utterance` (String), `intent` (String).
    *   `skills` (`Any` -> `jsonb`), `trajectory` (`Any` -> `jsonb`).
    *   `createdAt` (Timestamp).

### SDKs
*   **Functions SDK**: Generated into `functions/src/dataconnect-generated`. Used by Cloud Functions for backend writes.
*   **Web SDK**: Generated into `src/dataconnect-generated`. Used by the Next.js frontend for read/display.

### Emulator
*   Runs on port **9399**.
*   Backed by a local PGLite instance (ephemeral).

---

## 6. Python DSPy Microservice

Located in `dspy_service/`. This service performs the actual AI extraction.

*   **Entry Point**: `app.py` (FastAPI application).
*   **Endpoint**: `POST /api/intent-skill-trajectory`
    *   **Input**: User message + Chat history + IST history.
    *   **Output**: JSON object with `intent`, `skills` list, and `trajectory` steps.
*   **Run Command**:
    ```bash
    cd dspy_service
    .\venv\Scripts\activate
    python -m uvicorn app:app --reload --port 8000
    ```

---

## 7. Emulator / Dev Environment

To run the full stack locally, you need three concurrent terminals:

### 1. Python DSPy Service
```bash
cd dspy_service
.\venv\Scripts\activate
python -m uvicorn app:app --reload --port 8000
```

### 2. Firebase Emulators
Starts Functions, Firestore, and Data Connect emulators.
```bash
firebase emulators:start
```

### 3. Next.js Dev Server
```bash
npm run dev
```

**Key Environment Variables (`.env.local`):**
*   `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true` – Tells the frontend to connect to local emulators.
*   `IST_STORAGE_MODE=data_connect_with_json_fallback` – Controls how repositories behave.

---

## 8. IST Pipeline: End-to-End View

1.  **Student sends a message**:
    *   Captured in `src/app/student/courses/[courseId]/_components/chat-panel.tsx`.
2.  **Frontend calls Cloud Function**:
    *   Invokes `analyzeMessage` (defined in `functions/src/analyzeMessage.ts`).
3.  **Cloud Function Logic**:
    *   **History**: Reads `src/mocks/ist/events.json` (Legacy/Current Limitation) to get context.
    *   **Extraction**: Calls `POST http://127.0.0.1:8000/api/intent-skill-trajectory` (DSPy).
    *   **Write (Firestore)**: Writes `MessageAnalysis` to `threads/{threadId}/analysis/{messageId}`.
    *   **Write (Data Connect)**: Calls `saveIstEventToDataConnect` to insert into PostgreSQL table `IstEvent`.
4.  **UI Updates**:
    *   `IntentInspector.tsx` listens to the Firestore document and updates in real-time.
5.  **Dev Verification**:
    *   Developer visits `/ist-dev/dataconnect` to confirm the row exists in Data Connect.

---

## 9. Status & Future Work

*   ✅ **Stable**: Firestore-based UI updates, JSON logging, basic DSPy integration.
*   ✅ **Stable**: Data Connect Write Path (Cloud Functions) and Read Path (Dev Viewer).
*   🧹 **Legacy**: `src/mocks/ist/events.json` is currently the *source of truth* for history context passed to DSPy.
*   **Current Limitation**: The Cloud Function writes to Data Connect, but does **not** yet read from it when constructing the prompt for DSPy.
*   **Next Step**: Implement `getRecentIstEventsFromDataConnect` in Cloud Functions and switch the prompt generation to use it.

