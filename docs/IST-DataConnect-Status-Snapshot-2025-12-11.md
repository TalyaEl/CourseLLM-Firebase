# IST / Data Connect Status Snapshot - December 11, 2025

## 1. High-Level Overview

**Project**: CourseWise – AI-powered tutoring for CS courses using Next.js 15, Firebase/Genkit, Firebase Emulators, DSPy, and Firebase Data Connect (Postgres emulator).

**Update**: This snapshot documents an end-to-end IST session where **Data Connect** is exercised as the primary store for IST events during local emulator runs, and verified from:
- Cloud Functions (`analyzeMessage`)
- DSPy service
- Next.js dev server
- `/ist-dev/dataconnect` debug page

**Key Point**: In this flow, **Data Connect is the source of truth for IST history**, with JSON kept only as a fallback in the Cloud Function.

---

## 2. Session Context / Environment

**Date**: 2025-12-11  
**Mode**: Local development with emulators

- **Next.js dev server**
  - Command: `npm run dev`
  - Port: `http://localhost:9002`
- **Firebase Emulators**
  - Command: `firebase emulators:start`
  - Services: **Functions**, **Firestore**, **Data Connect** (Postgres emulator on port `9399`)
- **DSPy service**
  - Directory: `dspy_service`
  - Command: `python -m uvicorn app:app --reload --port 8000`

This configuration mirrors the intended production architecture but with all data staying local in the emulator stack.

---

## 3. IST → Data Connect: Write Path Validation

### 3.1 Observed Function Logs

From the **Functions emulator** logs (Cloud Function: `us-central1-analyzeMessage`) we observed lines such as:

- `[analyzeMessage] About to save IST event to DataConnect for messageId ...`
- `[DataConnect] Successfully created IstEvent for messageId ...`
- `[analyzeMessage] DataConnect save completed for messageId ...`

These logs originate from:
- `functions/src/analyzeMessage.ts` – calls `saveIstEventToDataConnect(...)` after DSPy returns.
- `functions/src/dataconnect/istEventsClient.ts` – wraps the generated Data Connect SDK and mutation.

### 3.2 Conclusion (Write Path)

- The **Cloud Function** successfully:
  1. Receives an IST response from DSPy (`intent`, `skills`, `trajectory`).
  2. Constructs an `IstEvent` payload (including `userId`, `courseId`, `threadId`, `messageId`, `utterance`, analysis fields).
  3. Executes the Data Connect mutation against the **Postgres emulator**.
- The presence of the success logs confirms that:
  - The Data Connect client is correctly initialized in the Functions runtime.
  - IST events are persisted as `IstEvent` rows in the emulator database.

---

## 4. Data Connect → Next.js / DSPy: Read Path Validation

### 4.1 Next.js Logs (Context Loader)

From the **Next.js dev server** logs we saw messages like:

- `[IST][Context][DEMO] Using demo identity: { userId: 'demo-user-1', courseId: 'cs-demo-101' }`
- `[IST][Context] Loaded recent IST events: 10`
- `[IST][Context] Loaded recent chat messages: 3`

These indicate that the frontend:
- Resolves a **demo identity** (`userId`, `courseId`) in emulator mode.
- Uses a Data Connect-backed context loader to fetch:
  - A bounded window of recent `IstEvent` rows for that user/course (`ist_history`).
  - Associated chat messages (`chat_history`).

### 4.2 DSPy Service Logs (Received Context)

From the **DSPy FastAPI** logs, we observed:

- `[IST] Received chat_history size: 3`
- `[IST] Received ist_history size: 10`

This confirms that:
- The frontend passes the loaded history into the DSPy endpoint as:
  - `chat_history`: list of `{ role, content, created_at }`.
  - `ist_history`: list of `{ intent, skills, trajectory, created_at }`.
- DSPy correctly receives and uses both histories when generating new IST analyses.

### 4.3 Conclusion (Read Path)

After Data Connect receives `IstEvent` writes from `analyzeMessage`, the frontend:
1. **Queries recent IST events** and **chat messages** from Data Connect using the generated client.
2. Transforms them into the DSPy-friendly `ist_history` and `chat_history` formats.
3. Includes them in subsequent calls to the `/api/intent-skill-trajectory` endpoint.

This closes the loop: **IST history written to Data Connect is now read back and used as context for new analyses.**

---

## 5. UI Verification – `/ist-dev/dataconnect` Page

### 5.1 Page Behavior

Visiting:

- `http://localhost:9002/ist-dev/dataconnect`

We observed:
- A simple debug UI with inputs for `userId` and `courseId`.
- Clicking **"Load IST Events"** lists the stored `IstEvent` records, including:
  - `utterance`
  - `intent`
  - `skills`
  - `trajectory`
  - `createdAt`
  - `threadId`, `messageId`, `userId`, `courseId`

### 5.2 Conclusion (Visual Proof of Storage)

- This page uses the **web Data Connect SDK** and the same `IstEventsByUserAndCourse` query.
- Seeing the expected events here confirms:
  - Data is successfully **persisted** in the emulator database.
  - The **read path** via Data Connect is functioning independently of the DSPy integration.

---

## 6. Gemini / Genkit Quota Errors (Side Note)

During the session we hit **Gemini API quota / overload** conditions when using `gemini-2.5-flash` via Genkit:

- Errors of the form:
  - `RESOURCE_EXHAUSTED` / `429 Too Many Requests`
  - `UNAVAILABLE` / `503 Service Unavailable: The model is overloaded. Please try again later.`

**Impact**:
- These errors affect only the **Socratic tutor answer generation** (Genkit / Gemini flow).
- The **IST pipeline** (Cloud Function `analyzeMessage` → DSPy → Data Connect) continued to:
  - Receive student questions.
  - Produce IST analyses.
  - Write/read `IstEvent` records in Data Connect.

**Mitigation Implemented**:
- The Socratic chat flow now wraps the Genkit call in a `try/catch`.
  - On Gemini failure, it returns a **fallback tutor message** instead of throwing.
  - The page remains usable, and IST extraction + Data Connect writes still complete.

---

## 7. End-to-End Flow Summary (Emulator Mode)

In the current emulator setup, the **IST pipeline with Data Connect** behaves as follows:

1. **Student message** is sent from the Socratic chat UI on `/student/courses/cs202`.
2. The backend calls the Cloud Function **`analyzeMessage`**, which:
   - Invokes the DSPy service at `/api/intent-skill-trajectory`.
   - Receives `intent`, `skills`, and `trajectory`.
3. `analyzeMessage` **writes an `IstEvent`** to the **Data Connect emulator** (Postgres) via the generated SDK.
4. The frontend (or Functions, depending on the context) **queries Data Connect** for:
   - Recent IST events (`IstEvent` rows) for the demo identity.
   - Recent chat messages.
5. These are converted into `ist_history` and `chat_history` and **sent to DSPy** on subsequent requests.
6. The `/ist-dev/dataconnect` page surfaces the stored events for developers to inspect and verify.

**Key Takeaway**:  
In this flow, **Data Connect is now the source of truth for IST history**, with the JSON file kept only as a defensive fallback in emulator mode.

---

**Last Updated**: December 11, 2025  
**Status**: ✅ Data Connect read/write path validated end-to-end in emulator; IST history is flowing through Data Connect into DSPy context and the dev UI.


