# UI Emulator Run Guide

This guide shows how to run the CourseWise UI with the **Firebase Emulator (Firestore + Functions)** and the **DSPy IST microservice**. It is intended for TAs who want to reproduce the IST behavior without connecting to any real Firebase project or production services.

The system runs entirely locally using:
- **Firebase Emulator** for Firestore and Cloud Functions (no real Firebase project needed)
- **DSPy microservice** for IST (Intent-Skill-Trajectory) extraction
- **Next.js app** for the UI and chat flow

---

## Prerequisites

Before starting, ensure you have:

1. **Node.js and npm installed**
   - The repo was tested with Node 22.x + npm 10.x
   - Verify: `node --version` and `npm --version`

2. **Firebase CLI installed**
   - Install: `npm install -g firebase-tools`
   - Verify: `firebase --version` works

3. **Python 3 + virtual environment**
   - Python 3.8+ required for `dspy_service`
   - Virtual environment should be set up in `dspy_service/` directory

4. **Dependencies installed**
   - **Next.js app**: Run `npm install` in the project root
   - **DSPy service**: Run `pip install -r requirements.txt` in `dspy_service/` directory

5. **Environment variables configured**
   - **Copy the example file**: `cp .env.example .env.local` (or `copy .env.example .env.local` on Windows)
   - **Edit `.env.local`** and fill in your actual values (or keep placeholders for emulator-only usage):

```env
# IST engine uses callable Cloud Function
NEXT_PUBLIC_IST_ENGINE_MODE=callable

# Use Firebase Emulator from the browser
NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true

# Firebase project for emulator (can be dummy values)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-no-project
NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo.firebaseapp.com
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=demo-app-id

# DSPy service (backend)
DSPY_SERVICE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_DSPY_SERVICE_URL=http://127.0.0.1:8000

# Keep existing JSON-based IST storage
IST_STORAGE_MODE=json
```

**Note**: When using the Firebase Emulator, the actual API keys are not sensitive and can be filled with dummy values (as shown above). The emulator doesn't validate these keys.

**For DSPy service**: Also copy `dspy_service/.env.example` to `dspy_service/.env` and set your `OPENAI_API_KEY` or `GEMINI_API_KEY` (required for IST extraction to work).

---

## Running the System – Three Terminals

The system is designed to run with three separate processes. Open three terminal windows and follow the steps below.

---

### Terminal 1 – DSPy IST Service

**Purpose**: Runs the Python FastAPI service that performs IST extraction using DSPy + LLM.

**Steps**:

```bash
# Navigate to dspy_service directory
cd dspy_service

# Set up environment variables (if not already done)
# Copy .env.example to .env and fill in your OPENAI_API_KEY
# On Windows PowerShell:
copy .env.example .env
# Then edit .env and set OPENAI_API_KEY=sk-your-actual-key-here

# Activate virtual environment (Windows PowerShell example)
.\venv\Scripts\activate

# Start the service
python -m uvicorn app:app --reload --port 8000
```

**Expected log lines**:

```
🔧 Initializing DSPy Intent–Skill–Trajectory extractor...
✅ DSPy service initialized successfully
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

**For each IST request, you'll see**:
```
[IST] Processing request - utterance: Can you explain Bayes' theorem to me?..., context: Course: cs202
[IST] Returning response - intent length: 45, skills count: 3, trajectory count: 4
INFO:     127.0.0.1:XXXXX - "POST /api/intent-skill-trajectory HTTP/1.1" 200 OK
```

**Keep this terminal open** – the service must stay running for IST extraction to work.

---

### Terminal 2 – Firebase Emulator (Firestore + Functions)

**Purpose**: Runs the Firebase Emulator suite, which provides local Firestore and Cloud Functions without connecting to a real Firebase project.

**Steps**:

```bash
# From project root (not inside dspy_service)
cd <project-root>

# Start Firebase emulators
firebase emulators:start
```

**Expected log lines**:

```
✔  firestore: Firestore Emulator started at http://127.0.0.1:8080
✔  functions: Functions Emulator started at http://127.0.0.1:5001
[Firebase Admin] Connecting to Firestore emulator at 127.0.0.1:8080
functions[us-central1-analyzeMessage]: http function initialized (http://127.0.0.1:5001/demo-no-project/us-central1/analyzeMessage)
```

**Important notes**:
- The emulator uses the demo project ID `demo-no-project` (from `.env.local`)
- It does **not** talk to any real Firebase project
- All data is stored in memory and cleared when you stop the emulator
- The Functions emulator automatically detects and loads `analyzeMessage` from `functions/lib/index.js`

**Keep this terminal open** – the emulator must stay running for Firestore and Cloud Functions to work.

---

### Terminal 3 – Next.js UI

**Purpose**: Runs the Next.js development server that serves the CourseWise UI.

**Steps**:

```bash
# From project root (same directory as Terminal 2)
cd <project-root>

# Start Next.js dev server
npm run dev
```

**Expected log lines**:

```
▲ Next.js 15.x.x
- Local:        http://localhost:9002
- Ready in X.XXs

[Firebase] Initialized app with projectId = demo-no-project
[Firebase] Connected to Firestore & Functions emulators
```

**When you navigate to a student course page**, you may also see:
```
[IST][Context][DEMO] Using demo identity: { userId: 'demo-user-1', courseId: 'cs-demo-101' }
[IST][Repository] Using JSON-based storage
[IST][Context] Loaded recent IST events: 5
```

**Keep this terminal open** – the UI must stay running to access the application.

---

## What to Do in the UI

### Step 1: Open the Student Course Page

Navigate to:
```
http://localhost:9002/student/courses/cs202
```

(You can use any valid `courseId` – `cs202`, `cs101`, etc. The app will use mock course data if the ID doesn't exist.)

### Step 2: Ask a Question in the Socratic Chat

1. Find the **Socratic Tutor** chat panel on the right side of the page
2. Type a question in the input field, for example:
   - "Can you explain Bayes' theorem to me?"
   - "I don't understand binary search"
   - "How do linked lists work?"
3. Press **Send** (or press Enter)

### Step 3: Observe Expected Behavior

**The chat should behave normally**:
- Your question appears as a user message
- The bot responds with a Socratic-style answer (this uses the existing Genkit/LLM flow)

**Additionally, an Intent Inspector block appears** below your user message, showing:

- **Primary Intent**: e.g., `ASK_EXPLANATION` with confidence `0.85`
- **Skills List**: 
  - Each skill shows: `displayName`, `confidence: 0.8`, `role: FOCUS` or `SECONDARY`
  - Example: `Bayes' theorem` (FOCUS), `Probability` (SECONDARY)
- **Trajectory**:
  - `status`: `ON_TRACK`
  - `suggestedNextNodes`: Array of learning steps with `id`, `reason`, and `priority`
- **Metadata**:
  - `Thread ID`: `demo-thread-cs202` (or `demo-thread-<courseId>`)
  - `Message ID`: `msg-1733456789123` (timestamp-based)
  - `User ID`: `demo-user`
  - `Model Version`: `ist-v1-dspy`
  - `Processed At`: ISO timestamp

**Note**: The Intent Inspector may take a moment to appear as it waits for the Cloud Function to complete and write to Firestore. If it doesn't appear after a few seconds, check the terminal logs for errors.

---

## How to Inspect Data in the Emulator

### Step 1: Open Firebase Emulator UI

Navigate to:
```
http://127.0.0.1:4000
```

This is the Firebase Emulator Suite UI, which provides a web interface for inspecting Firestore data and viewing Functions logs.

### Step 2: Navigate to Firestore Data

1. Click on **"Firestore"** in the left sidebar
2. Click on **"Data"** tab (if not already selected)

### Step 3: Find Your IST Analysis Documents

You should see a collection structure like:

```
threads
  └── demo-thread-cs202
      └── analysis
          └── msg-1733456789123
```

**For the debug page** (`/debug-analysis`), you'll see:
```
threads
  └── debug-thread-2
      └── analysis
          └── debug-message-2
```

### Step 4: Inspect Document Fields

Click on a document (e.g., `msg-1733456789123`) to see its fields:

**Key fields to check**:

- **`intent`**:
  - `labels`: Array of intent labels (e.g., `["ASK_EXPLANATION"]`)
  - `primary`: Main intent label (e.g., `"ASK_EXPLANATION"`)
  - `confidence`: Number between 0 and 1 (e.g., `0.85`)

- **`skills`**:
  - `items`: Array of skill objects, each with:
    - `id`: Normalized skill ID (e.g., `"bayes-theorem"`)
    - `displayName`: Human-readable name (e.g., `"Bayes' theorem"`)
    - `confidence`: Number between 0 and 1 (e.g., `0.8`)
    - `role`: `"FOCUS"` or `"SECONDARY"`

- **`trajectory`**:
  - `currentNodes`: Array of current learning node IDs (may be empty)
  - `suggestedNextNodes`: Array of suggested steps, each with:
    - `id`: Step ID (e.g., `"step-1"`)
    - `reason`: Description of the step (e.g., `"Review the concept of recursion..."`)
    - `priority`: Number (1 = highest priority)
  - `status`: One of `"ON_TRACK"`, `"STRUGGLING"`, `"TOO_ADVANCED"`, etc.

- **`metadata`**:
  - `processedAt`: ISO timestamp (e.g., `"2025-12-06T10:30:45.123Z"`)
  - `modelVersion`: `"ist-v1-dspy"` (indicates it came from DSPy service)
  - `threadId`: Thread ID (e.g., `"demo-thread-cs202"`)
  - `messageId`: Message ID (e.g., `"msg-1733456789123"`)
  - `uid`: User ID (e.g., `"demo-user"`)

---

## JSON Log (for the Course Requirements)

In parallel to Firestore Emulator writes, the existing JSON log file is still updated:

**Location**: `src/mocks/ist/events.json`

**Note**: This file is auto-created on first IST extraction. If you want to start with an empty file, you can copy `src/mocks/ist/events.json.example` (which contains an empty array `[]`) to `src/mocks/ist/events.json`. The code will create the file and directory automatically if they don't exist.

Each new student question adds an IST event to this file, which is the source used by the course project for analysis and reporting.

**Important**: The Cloud Function can also read from this JSON file (when running in emulator mode) to send IST history to DSPy, enriching the extraction with context from previous questions.

**To view the JSON log**:
- Open `src/mocks/ist/events.json` in your editor
- It's a JSON array of `IstEvent` objects, sorted by `createdAt` (newest events at the end)
- Each event contains: `id`, `createdAt`, `userId`, `courseId`, `utterance`, `courseContext`, `intent`, `skills`, `trajectory`

---

## Short "Sanity Checklist" for TAs

Use this checklist to verify everything is working correctly:

- [ ] **DSPy terminal** prints `[IST] Processing request - utterance: ...` when you send a question
- [ ] **Functions emulator terminal** prints `[analyzeMessage] Running IST analysis for threadId: ... messageId: ...` and `[analyzeMessage] Successfully wrote analysis to Firestore`
- [ ] **Firestore Emulator UI** shows a new document under `threads/demo-thread-<courseId>/analysis/msg-<timestamp>` after sending a question
- [ ] **Intent Inspector** appears under the user message in the UI with intent + skills + trajectory fields populated
- [ ] **`src/mocks/ist/events.json`** grows with new IST events (check file size or count of events in the array)

**If any item is unchecked**, check the terminal logs for errors:
- DSPy service errors: Check Terminal 1
- Cloud Function errors: Check Terminal 2 (Functions emulator)
- Next.js errors: Check Terminal 3
- Browser console: Open DevTools (F12) and check for JavaScript errors

---

## Troubleshooting

### Problem: Intent Inspector doesn't appear

**Possible causes**:
1. Cloud Function failed to write to Firestore (check Terminal 2 logs)
2. DSPy service is not running (check Terminal 1)
3. Firestore Emulator is not running (check Terminal 2)
4. Network error in browser (check browser DevTools console)

**Solution**: Check all three terminals for error messages. Ensure all services are running.

### Problem: Functions emulator shows "Failed to load function definition"

**Possible causes**:
1. Functions TypeScript code hasn't been compiled
2. `functions/lib/index.js` doesn't exist

**Solution**: 
```bash
cd functions
npm run build
```
Then restart the Firebase emulator.

### Problem: DSPy service returns errors

**Possible causes**:
1. Missing API key in `dspy_service/.env` (OPENAI_API_KEY or GEMINI_API_KEY)
2. Virtual environment not activated
3. Dependencies not installed

**Solution**: 
- Check `dspy_service/.env` file exists and has valid API keys
- Ensure virtual environment is activated
- Run `pip install -r requirements.txt` in `dspy_service/`

### Problem: Firestore Emulator UI shows "No data"

**Possible causes**:
1. Cloud Function didn't write the document (check Terminal 2 logs)
2. Wrong collection/document path
3. Emulator was restarted (data is in-memory only)

**Solution**: 
- Check Functions emulator logs for write confirmation
- Verify the document path matches: `threads/{threadId}/analysis/{messageId}`
- Note: Emulator data is cleared when you stop it

---

## Summary

This guide provides a complete walkthrough for running the CourseWise UI with Firebase Emulator and DSPy service. The system runs entirely locally, making it easy for TAs to test and observe the IST extraction behavior without any production dependencies.

**Key takeaway**: The IST pipeline now works end-to-end from UI → Cloud Function → DSPy → Firestore → IntentInspector, providing both real-time UI feedback and persistent storage for analysis.

