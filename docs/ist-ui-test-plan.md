# IST UI Test Plan

This document describes manual UI-based tests for the IST (Intent–Skill–Trajectory) pipeline. These tests validate the end-to-end flow from the **student Socratic chat UI** through:

- Next.js 15 frontend (Socratic course page)
- Cloud Functions (`analyzeMessage`)
- DSPy FastAPI service (`/api/intent-skill-trajectory`)
- **Firebase Data Connect** (IstEvent storage + history queries)
- Firestore Emulator (threads / analysis documents)
- Developer/debug views (e.g., `/ist-dev/dataconnect`)

The focus is on what a **developer/TA can see in the UI and logs** to confirm that IST extraction, storage, and history usage are working as intended in emulator mode.

---

## 1. Overview

The IST UI currently supports:

- **Student Socratic chat UI** on the course page (`/student/courses/[courseId]`), where students ask questions.
- **IST extraction** (intent, skills, trajectory) via a Python DSPy microservice.
- Integration with:
  - **Cloud Functions**: `us-central1-analyzeMessage` callable function
  - **Data Connect**: `IstEvent` table for persistent IST history (write + read)
  - **Firestore**: Thread-level analysis documents for the IntentInspector UI
  - **DSPy service**: `/api/intent-skill-trajectory` endpoint
  - **Debug/Developer views**: `/ist-dev/dataconnect` for Data Connect introspection

In emulator mode, Data Connect is the **source of truth** for IST history used in prompts; JSON file storage is kept only as a fallback and is no longer the primary focus of this test plan.

---

## 2. Prerequisites

### 2.1 Tools Installed

- **Node.js and npm**
  - Verify: `node --version` and `npm --version`
  - Recommended: Node.js 18.x or higher
- **Python 3.x**
  - Verify: `python --version` (3.8+)
  - Verify: `pip --version`
- **Firebase CLI**
  - Required to run `firebase emulators:start`

### 2.2 Environment Variables

#### DSPy Service (`dspy_service/.env`)

Create or verify `dspy_service/.env`:

```env
# Required for LLM access (OpenAI or Gemini via LiteLLM)
OPENAI_API_KEY=sk-...your-real-key...

# Optional: Provider selection
LLM_PROVIDER=openai  # or "gemini"
LLM_MODEL=openai/gpt-4o-mini  # Optional override
```

#### Next.js App (`.env.local` at project root)

Create or verify `.env.local`:

```env
# Gemini/Google AI (for Genkit Socratic chat)
GOOGLE_API_KEY=AIzaSy...your-real-key...
GEMINI_API_KEY=AIzaSy...your-real-key...  # Alternative

# DSPy service URL (defaults to localhost:8000)
DSPY_SERVICE_URL=http://localhost:8000

# Emulator flags
NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true

# Optional demo mode for IST context
IST_DEMO_MODE=true
```

> **Note**: Restart `npm run dev` after editing `.env.local`. Next.js only reads env vars at startup.

### 2.3 Services Running

Run each of the following in its own terminal:

- **Terminal 1 – DSPy FastAPI service**

  ```powershell
  cd dspy_service
  .\venv\Scripts\Activate.ps1
  python -m uvicorn app:app --reload --port 8000
  ```

- **Terminal 2 – Firebase Emulators (Functions, Firestore, Data Connect)**

  ```powershell
  firebase emulators:start
  ```

- **Terminal 3 – Next.js dev server**

  ```powershell
  npm run dev
  ```

Optional helpers:

- **Emulator UI**: `http://127.0.0.1:4000/`
- **Data Connect debug page**: `http://localhost:9002/ist-dev/dataconnect`

---

## 3. Test Scenario 1 – Basic Socratic Chat with IST Extraction

### 3.1 Steps

1. Open:

   ```text
   http://localhost:9002/student/courses/cs202
   ```

2. Scroll to the **Socratic chat** section.
3. In the chat input, ask a conceptual question, for example:

   ```text
   What is the time complexity of inserting into a dynamic array?
   ```

4. Send the question (press Enter or click **Send**).

### 3.2 Expected Results – UI

- The Socratic tutor responds with a course-aware explanation or guiding question.  
- If Gemini is overloaded or returns a 503, the UI shows a **fallback tutor message** instead of a red error page.  
- The chat remains responsive; no unhandled errors are shown to the user.

### 3.3 Expected Results – Functions & DSPy Logs

- **Functions emulator** (`analyzeMessage`):
  - `Running IST analysis for threadId ... messageId ...`
  - `DSPy response received: { intent: ..., skillsCount: ..., trajectoryCount: ... }`
  - `About to save IST event to DataConnect for messageId ...`
  - `DataConnect save completed for messageId ...`

- **DSPy terminal**:
  - `[IST] Processing request - utterance: ...`
  - `[IST] Received chat_history size: N`
  - `[IST] Received ist_history size: M`
  - `[IST] Returning response - intent length: X, skills count: Y, trajectory count: Z`

### 3.4 Expected Results – Firestore Emulator

In the **Firestore Emulator UI** (`http://127.0.0.1:4000/`), you should see:

- Collection: `threads`
  - Document: `<threadId>`
    - Subcollection: `analysis`
      - Document: `<messageId>` containing the `MessageAnalysis` JSON written by `analyzeMessage`.

This confirms the IntentInspector UI has a Firestore-backed analysis document to read from.

---

## 4. Test Scenario 2 – IST Event Stored in Data Connect

### 4.1 Steps

1. From the Socratic chat page, send one or more questions (as in Scenario 1).
2. Watch the **Functions emulator** terminal.

### 4.2 Expected Logs

- `[analyzeMessage] About to save IST event to DataConnect for messageId ...`
- `[DataConnect] Successfully created IstEvent for messageId ...`
- `[analyzeMessage] DataConnect save completed for messageId ...`

### 4.3 Expected Results

- No Data Connect–related errors are printed in the Functions logs.  
- Data Connect emulator log files (`dataconnect-debug.log`) remain free of fatal errors.  
- Each Socratic question corresponds to a new `IstEvent` row in the emulator’s Postgres instance (verified via `/ist-dev/dataconnect` in Scenario 4).

---

## 5. Test Scenario 3 – Frontend Reads IST History from Data Connect

### 5.1 Steps

1. With all services running, send **several** questions in the same course (`/student/courses/cs202`).  
2. Refresh the page or send another question to trigger history loading.
3. Inspect the **Next.js dev server** logs.

### 5.2 Expected Logs – Next.js

You should see messages similar to:

```text
[IST][Context][DEMO] Using demo identity: { userId: 'demo-user-1', courseId: 'cs-demo-101' }
[IST][Context] Loaded recent IST events: X
[IST][Context] Loaded recent chat messages: Y
```

Where:

- `X > 0` after you have sent some questions (e.g., `10` recent events).  
- `Y` is the number of chat messages included in the context (e.g., `3` recent turns).

### 5.3 Expected Logs – DSPy

In the DSPy terminal:

```text
[IST] Received chat_history size: Y
[IST] Received ist_history size: X
```

**Interpretation**:

- `chat_history` and `ist_history` are non-empty, confirming that:
  - Data Connect is queried for recent `IstEvent` history.
  - The frontend (or Cloud Function) passes these into DSPy on subsequent requests.

---

## 6. Test Scenario 4 – `/ist-dev/dataconnect` Debug View

### 6.1 Steps

1. Navigate to:

   ```text
   http://localhost:9002/ist-dev/dataconnect
   ```

2. Leave the default values (e.g., `userId = demo-user`, `courseId = cs202`) or adjust to match your test user/course.  
3. Click **“Load IST Events”**.

### 6.2 Expected Results

- The page renders a list of IST events fetched from **Data Connect** using the generated web SDK.
- For each event, verify fields such as:
  - `utterance` – matches your Socratic questions.
  - `intent` – natural-language description of the student’s goal.
  - `skills` – array of skills or concepts (rendered as a list).
  - `trajectory` – array of recommended next steps (rendered as a numbered list).
  - `createdAt`, `threadId`, `messageId`, `userId`, `courseId` – metadata consistent with your session.
- The data in this UI should match what you see in Functions and DSPy logs.

---

## 7. Test Scenario 5 – Gemini Quota / Error Behavior (Optional but Recommended)

### 7.1 Goal

Validate that **Genkit / Gemini errors** (e.g., 429/503) do **not** break the IST pipeline or crash the UI.

### 7.2 Steps

1. With all services running, send several Socratic questions in quick succession.  
2. Intentionally push towards Gemini rate limits, or temporarily misconfigure Genkit to trigger an upstream error.  
3. Observe the **Next.js** logs and browser UI.

### 7.3 Expected Results

- In the Next.js logs:

  ```text
  [socratic-course-chat] socraticPrompt failed, returning fallback tutor message instead of throwing: GenkitError ...
  ```

- In the UI:
  - The Socratic chat displays a fallback tutor message such as:
    > “The AI tutor is temporarily unavailable because the upstream model is overloaded (503). Your question was still processed for IST analysis – please try again in a bit.”
  - No red error page or unhandled exception is shown.

- In the Functions & DSPy logs:
  - `analyzeMessage` still runs and calls DSPy.
  - DSPy logs still show `Received chat_history size: ...` and `Received ist_history size: ...`.
  - Data Connect logs still show successful `IstEvent` creations.

**Conclusion**: Gemini quota issues affect **only** the tutor answer text, not IST extraction or Data Connect read/write behavior.

---

## 8. Where to See Each Result (Summary Table)

| Feature                                   | Where to see it                                                |
| ---------------------------------------- | -------------------------------------------------------------- |
| Student message + tutor reply            | Course page UI (`/student/courses/cs202`)                      |
| IST extraction (intent/skills/trajectory)| DSPy logs (`dspy_service` terminal)                            |
| IST saved to Data Connect                | Functions logs (`analyzeMessage`), `/ist-dev/dataconnect`      |
| IST history loaded into context          | Next.js logs (`[IST][Context] Loaded recent ...`) + DSPy logs  |
| Firestore write (thread/message)         | Firestore Emulator UI (`http://127.0.0.1:4000/`)               |
| Data Connect emulator status             | Firebase emulator logs, `/ist-dev/dataconnect` UI              |

---

## 9. Validation Summary

These IST UI tests validate that:

- **End-to-end connectivity** from UI → Next.js → Cloud Functions → DSPy → Data Connect → Firestore is working in emulator mode.
- **IST history and chat history** are loaded from Data Connect and passed into DSPy as `ist_history` and `chat_history`.
- **Data Connect** is the primary store for IST events, with the `/ist-dev/dataconnect` page providing a clear visual for developers.
- **Fallback behavior** for Gemini/Genkit errors keeps the UI stable while IST + Data Connect processing continues.

This test plan should be used by developers and TAs to validate changes to the IST pipeline, especially when iterating on Data Connect integration, DSPy prompts, or UI behavior.

---

**Last Updated**: December 11, 2025  
**Status**: ✅ Updated for Data Connect–backed IST history and Gemini fallback behavior
