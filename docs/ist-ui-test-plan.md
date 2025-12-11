# IST UI Test Plan

This document describes manual UI-based tests for the IST (Intent–Skill–Trajectory) pipeline. These tests validate the end-to-end flow from the web UI through the Next.js backend to the DSPy FastAPI service and JSON storage.

The tests focus on observing functionality via:
- **Web UI** (Socratic chat screen in the student course page)
- **Two terminals** (Next.js dev server logs + DSPy FastAPI logs)
- **JSON storage file** (`src/mocks/ist/events.json`)

---

## 1. Prerequisites

Before running the tests, verify the following prerequisites:

### Required Tools Installed

- **Node.js and npm**: Required for running the Next.js application
  - Verify: `node --version` and `npm --version`
  - Recommended: Node.js 18.x or higher

- **Python 3.x**: Required for the DSPy FastAPI service
  - Verify: `python --version` (should be Python 3.8 or higher)
  - Verify: `pip --version`

- **Git**: Optional but recommended for version control

### Dependencies Installed

1. **Next.js Dependencies** (from project root):
   ```powershell
   npm install
   ```
   This installs all Node.js packages listed in `package.json`.

2. **DSPy Service Dependencies** (inside `dspy_service/` folder):
   ```powershell
   cd dspy_service
   python -m venv venv
   .\venv\Scripts\Activate.ps1   # For Windows PowerShell
   pip install -r requirements.txt
   ```
   This creates a virtual environment and installs Python dependencies including `dspy`, `fastapi`, `uvicorn`, `pydantic`, etc.

### Environment Variables

#### DSPy Service (`dspy_service/.env`)

Create or verify the file `dspy_service/.env` contains:

```env
# Required for OpenAI
OPENAI_API_KEY=sk-...your-real-key-here...

# Optional: Provider selection
LLM_PROVIDER=openai  # or "gemini"
LLM_MODEL=openai/gpt-4o-mini  # Optional override
```

**Important**: Replace `sk-...your-real-key-here...` with your actual OpenAI API key. The service will fail to start if the key is missing or invalid.

#### Next.js App (`.env.local` at project root)

Create or verify the file `.env.local` at the project root contains:

```env
# Gemini/Google AI (for Genkit Socratic chat)
GOOGLE_API_KEY=AIzaSy...your-real-key...
GEMINI_API_KEY=AIzaSy...your-real-key...  # Alternative

# Optional: DSPy service URL override (defaults to localhost:8000)
DSPY_SERVICE_URL=http://localhost:8000

# Optional: IST storage mode (defaults to 'json')
IST_STORAGE_MODE=json

# Enable IST demo mode (fake user + fake chat history)
IST_DEMO_MODE=true
```

**Critical for Demo Mode**: Set `IST_DEMO_MODE=true` to enable demo mode. When enabled and no `userId` is provided, the system will automatically use:
- `userId = "demo-user-1"`
- `courseId = "cs-demo-101"`

**Note**: Next.js requires a **server restart** to pick up changes to `.env.local`. Always restart the dev server after modifying this file.

### File Locations

- **`src/mocks/ist/events.json`**: This file will be created automatically by the JSON repository if it doesn't exist. The directory `src/mocks/ist/` will also be created automatically.

**Recommended**: If you want a clean test run, delete or back up the existing `src/mocks/ist/events.json` file before starting the tests. This ensures you start with an empty history and can clearly observe new events being created.

---

## 2. Starting the Services

The IST pipeline requires **two services** running simultaneously in separate terminals.

### Terminal 1 – DSPy FastAPI Service

Open a PowerShell terminal and run:

```powershell
cd path/to/CourseLLM-Firebase--miluimnikim-osher-extract-works/dspy_service
.\venv\Scripts\Activate.ps1
python -m uvicorn app:app --reload --port 8000
```

**Expected output on startup**:
```
🔧 Initializing DSPy Intent–Skill–Trajectory extractor...
✅ DSPy service initialized successfully
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [xxxxx] using StatReload
INFO:     Started server process [xxxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**When requests arrive, you should see logs like**:
```
[IST] Processing request - utterance: I don't understand linked lists...
[IST] Received chat_history size: 3
[IST] Received ist_history size: 0
[IST] Returning response - intent length: 45, skills count: 4, trajectory count: 3
INFO:     127.0.0.1:xxxxx - "POST /api/intent-skill-trajectory HTTP/1.1" 200 OK
```

**Keep this terminal open** – the service must remain running for the tests to work.

### Terminal 2 – Next.js Dev Server

Open a **second** PowerShell terminal (keep Terminal 1 running) and run:

```powershell
cd path/to/CourseLLM-Firebase--miluimnikim-osher-extract-works
npm run dev
```

**Expected output on startup**:
```
   ▲ Next.js 15.x.x
   - Local:        http://localhost:9002
   - Ready in X.Xs

  ○ Compiling / ...
  ✓ Compiled / in X.Xs
```

**When visiting pages, you should see logs like**:
```
GET /student 200 in Xms
GET /student/courses/cs202 200 in Xms
```

**When IST extraction runs, you should see logs like**:
```
[IST][Context][DEMO] Using demo identity: { userId: 'demo-user-1', courseId: 'cs-demo-101' }
[IST][Context] Loaded recent IST events: 0
[IST][Context] Loaded recent chat messages: 3
[IST] Extracted IST: { utterance: 'I don't understand linked lists at all', courseContext: '...', ist: {...} }
[IST][Repository] Stored IST event
```

**Keep this terminal open** – the Next.js server must remain running for the UI to work.
### Terminal 3 – Firebase Emulator (Hosting & Functions)

Start the Firebase Emulator Suite in a **third** terminal to provide local Hosting and Functions endpoints used by the app.

- From the project root (replace path as needed):

```powershell
cd path/to/CourseLLM-Firebase--miluimnikim
firebase emulators:start --only hosting,functions
```

- Or with `npx` if you don't have `firebase-tools` globally:

```powershell
npx firebase emulators:start --only hosting,functions
```

This will start the local Emulator UI (typically `http://localhost:4000`) and expose the Hosting and Functions emulators so the Next.js client and callable functions work as expected.

Mandatory checks before starting:
- Ensure `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true` is set in your `\.env.local` (client-side) so the app connects to local emulators. See `\.env.local` for example values.
- Verify `FIRESTORE_EMULATOR_HOST`, `FIRESTORE_EMULATOR_PORT`, `FIREBASE_FUNCTIONS_EMULATOR_HOST`, and `FIREBASE_FUNCTIONS_EMULATOR_PORT` are set in `\.env.local` when the emulator is required.
- Confirm `firebase.json` and `.firebaserc` are configured for the services you intend to emulate.
- Keep Terminal 3 open while running the UI tests so emulator endpoints remain available.


---

## 3. Basic Demo Mode Sanity Test

**Goal**: Confirm that a single question in the Socratic chat:
- Reaches the DSPy service successfully
- Produces a valid IST result
- Is stored in `events.json` with demo mode identifiers
- Uses the enriched context (chat history + IST history)

### Steps

1. **Open a web browser** and navigate to:
   ```
   http://localhost:9002/student/courses/cs202
   ```
   *(Adjust `cs202` if your project uses a different course ID. You can check available routes in `src/app/student/courses/`.)*

2. **Scroll to the Socratic chat section** on the course page.

3. **In the chat input box**, type a question such as:
   ```
   How do binary trees work?
   ```

4. **Send the question** (press Enter or click Send).

5. **Wait for the AI response** to appear in the chat.

### Expected Results – UI

- ✅ The AI/tutor responds with a Socratic-style follow-up question about binary trees, referencing the course content.
- ✅ The page does not crash; the chat flow continues as normal.
- ✅ The response appears within a few seconds (depends on LLM response time).

### Expected Results – DSPy Terminal (Terminal 1)

You should see logs like:
```
[IST] Processing request - utterance: How do binary trees work?, context: Title: Module 1...
[IST] Received chat_history size: 3
[IST] Received ist_history size: 0
[IST] Returning response - intent length: 52, skills count: 3, trajectory count: 4
INFO:     127.0.0.1:xxxxx - "POST /api/intent-skill-trajectory HTTP/1.1" 200 OK
```

**Key observations**:
- `chat_history size: 3` confirms demo chat history is being sent (from `InMemoryChatHistoryRepository`)
- `ist_history size: 0` confirms this is the first question (no previous IST events yet)
- HTTP status `200 OK` confirms successful extraction

### Expected Results – Next.js Terminal (Terminal 2)

You should see logs like:
```
[IST][Context][DEMO] Using demo identity: { userId: 'demo-user-1', courseId: 'cs-demo-101' }
[IST][Context] Loaded recent IST events: 0
[IST][Context] Loaded recent chat messages: 3
[IST] Extracted IST: {
  utterance: 'How do binary trees work?',
  courseContext: 'Title: Module 1: Arrays & Strings...',
  ist: {
    intent: 'The student wants to understand binary trees.',
    skills: [ 'binary trees', 'tree traversal', 'data structures' ],
    trajectory: [ 'review tree concepts', 'study binary tree operations', 'practice tree problems' ]
  }
}
[IST][Repository] Stored IST event
```

**Key observations**:
- `[IST][Context][DEMO] Using demo identity` confirms demo mode is active
- `Loaded recent IST events: 0` confirms no prior history (first question)
- `Loaded recent chat messages: 3` confirms demo chat history is loaded
- `[IST][Repository] Stored IST event` confirms the event was saved

### Expected Results – JSON File

1. **Open** `src/mocks/ist/events.json` in a text editor or IDE.

2. **A new `IstEvent` entry should exist** with fields similar to:
   ```json
   {
     "id": "5",
     "createdAt": "2025-12-01T15:30:45.123Z",
     "userId": "demo-user-1",
     "courseId": "cs-demo-101",
     "utterance": "How do binary trees work?",
     "courseContext": "Title: Module 1: Arrays & Strings...",
     "intent": "The student wants to understand binary trees.",
     "skills": [
       "binary trees",
       "tree traversal",
       "data structures"
     ],
     "trajectory": [
       "review tree concepts",
       "study binary tree operations",
       "practice tree problems"
     ]
   }
   ```

**Key observations**:
- `userId: "demo-user-1"` confirms demo mode identity injection
- `courseId: "cs-demo-101"` confirms demo course ID
- `skills` and `trajectory` are clean arrays (not JSON strings)
- `id` is a sequential number (e.g., "5", "6", "7")

**If this test passes**, the basic pipeline is working correctly! Proceed to the multi-turn test.

---

## 4. Multi-Turn Context Enrichment Test

**Goal**: Verify that IST history accumulates across multiple questions and that the model's recommendations become more personalized over time.

This test validates:
- IST history is reused across multiple turns
- Demo chat history is consistently present
- The model's output becomes richer and more context-aware over time

### Test Scenario

Use **three consecutive questions** in the same course and session:

1. **First question**: `What is recursion and how does it work?`
2. **Second question**: `Can you explain how recursion relates to tree traversal algorithms?`
3. **Third question**: `What are some good practice problems to master recursion with trees?`

### Steps

1. **With both servers running**, stay on `http://localhost:9002/student/courses/cs202` (same page as before).

2. **Ask the first question**:
   ```
   What is recursion and how does it work?
   ```
   Wait for the AI response.

3. **Ask the second question** (without refreshing the page):
   ```
   Can you explain how recursion relates to tree traversal algorithms?
   ```
   Wait for the AI response.

4. **Ask the third question** (still on the same page):
   ```
   What are some good practice problems to master recursion with trees?
   ```
   Wait for the AI response.

### Expected Results – UI

- ✅ **First response**: Should focus on recursion, explaining the concept with base cases and recursive cases.
- ✅ **Second response**: Should connect recursion with tree traversal algorithms (e.g., "Recursion is naturally suited for tree traversal because each subtree is a smaller instance of the problem").
- ✅ **Third response**: Should provide concrete practice problems combining recursion and trees (e.g., "Try implementing binary tree traversal using recursion", "Solve problems involving recursive tree operations").

The responses should show **progressive sophistication**, with later responses incorporating context from earlier questions.

### Expected Results – DSPy Terminal (Terminal 1)

**For the first question**:
```
[IST] Processing request - utterance: What is recursion and how does it work?...
[IST] Received chat_history size: 3
[IST] Received ist_history size: 0
[IST] Returning response - intent length: ..., skills count: ..., trajectory count: ...
```

**For the second question**:
```
[IST] Processing request - utterance: Can you explain how recursion relates to tree traversal algorithms?...
[IST] Received chat_history size: 3
[IST] Received ist_history size: 1
[IST] Returning response - intent length: ..., skills count: ..., trajectory count: ...
```

**For the third question**:
```
[IST] Processing request - utterance: What are some good practice problems to master recursion with trees?...
[IST] Received chat_history size: 3
[IST] Received ist_history size: 2
[IST] Returning response - intent length: ..., skills count: ..., trajectory count: ...
```

**Key observation**: The `ist_history size` grows from `0` → `1` → `2`, confirming that the DSPy module is receiving a growing IST history for the same demo user. This enables the model to build on previous learning patterns and avoid repeating identical trajectory steps.

### Expected Results – Next.js Terminal (Terminal 2)

**Between questions, you should see logs like**:
```
[IST][Context][DEMO] Using demo identity: { userId: 'demo-user-1', courseId: 'cs-demo-101' }
[IST][Context] Loaded recent IST events: 0
[IST][Context] Loaded recent chat messages: 3
[IST] Extracted IST: { ... }
[IST][Repository] Stored IST event

[IST][Context][DEMO] Using demo identity: { userId: 'demo-user-1', courseId: 'cs-demo-101' }
[IST][Context] Loaded recent IST events: 1
[IST][Context] Loaded recent chat messages: 3
[IST] Extracted IST: { ... }
[IST][Repository] Stored IST event

[IST][Context][DEMO] Using demo identity: { userId: 'demo-user-1', courseId: 'cs-demo-101' }
[IST][Context] Loaded recent IST events: 2
[IST][Context] Loaded recent chat messages: 3
[IST] Extracted IST: { ... }
[IST][Repository] Stored IST event
```

**Key observations**:
- `Loaded recent IST events` increases: `0` → `1` → `2`
- `Loaded recent chat messages: 3` stays constant (demo chat history is fixed)
- Each question produces an `[IST] Extracted IST` log and a corresponding `[IST][Repository] Stored IST event`

### Expected Results – JSON File

1. **Open** `src/mocks/ist/events.json` after completing all three questions.

2. **The file should now contain multiple entries** with:
   - `userId: "demo-user-1"` (consistent across all entries)
   - `courseId: "cs-demo-101"` (consistent across all entries)
   - `utterance` matching each of the three questions
   - Increasing `id` values (e.g., "5", "6", "7")
   - `createdAt` timestamps in chronological order

3. **Inspect the `skills` and `trajectory` fields** across the three entries:

   - **First IST** (`id: "5"`):
     - Skills: Focused on recursion (e.g., `["recursion", "base case", "recursive case", "function calls"]`)
     - Trajectory: Basic recursion learning steps (e.g., `["understand base cases", "learn recursive thinking", "practice simple recursive functions"]`)

   - **Second IST** (`id: "6"`):
     - Skills: Should mention both recursion AND tree traversal (e.g., `["recursion", "tree traversal", "binary trees", "recursive algorithms"]`)
     - Trajectory: Should connect recursion with trees (e.g., `["review tree data structures", "understand recursive tree traversal", "study preorder, inorder, postorder traversal"]`)

   - **Third IST** (`id: "7"`):
     - Skills: Should still include recursion and trees, with practice-oriented skills (e.g., `["recursion", "tree algorithms", "problem-solving", "recursive patterns"]`)
     - Trajectory: Should include concrete practice steps combining recursion and trees, building on previous trajectories (e.g., `["implement recursive tree traversal algorithms", "solve LeetCode problems on trees using recursion", "practice problems combining recursion and tree operations"]`)

**Key observation**: The trajectory should show **progression** and **avoid repetition**. If the first trajectory says "understand base cases", the third trajectory should say something like "implement recursive tree traversal algorithms" or "solve practice problems" rather than repeating "understand base cases".

**If this test passes**, context enrichment is working correctly! The system is accumulating IST history and using it to generate increasingly personalized recommendations.

---

## 5. Verifying Stored IST Events in JSON

This section provides a guide for inspecting the stored IST events in `src/mocks/ist/events.json`.

### How to Open the File

1. **Using a text editor**: Open `src/mocks/ist/events.json` in VS Code, Notepad++, or any text editor.
2. **Using an IDE**: Most IDEs (VS Code, WebStorm, etc.) have JSON syntax highlighting for easier reading.
3. **Format the JSON**: If the file is hard to read, use a JSON formatter (VS Code: right-click → "Format Document", or use an online JSON formatter).

### What to Look For

#### 1. **Increasing ID Values**
   - The `id` field should be a sequential string: `"1"`, `"2"`, `"3"`, etc.
   - Each new event gets the next available ID.
   - **Example**: After three questions, you should see ids like `"5"`, `"6"`, `"7"`.

#### 2. **CreatedAt Timestamps**
   - Timestamps should be in ISO format: `"2025-12-01T15:30:45.123Z"`
   - Timestamps should reflect the order of questions (newer events have later timestamps).
   - **Tip**: If timestamps seem out of order, check system clock synchronization.

#### 3. **Consistent User and Course IDs (Demo Mode)**
   - In demo mode, all entries should have:
     - `userId: "demo-user-1"`
     - `courseId: "cs-demo-101"`
   - **If you see `userId: null`**, demo mode is not active. Check `IST_DEMO_MODE=true` in `.env.local`.

#### 4. **Meaningful Intent, Skills, and Trajectory**
   - **`intent`**: Should be a clear English sentence describing what the student wants (e.g., `"The student wants to understand binary trees."`)
   - **`skills`**: Should be an array of strings (e.g., `["binary trees", "tree traversal", "data structures"]`)
     - ✅ **Good**: Clean array format
     - ❌ **Bad**: JSON string format like `"[\"binary trees\", \"tree traversal\"]"`
   - **`trajectory`**: Should be an array of actionable learning steps (e.g., `["review tree concepts", "study tree operations", "practice tree problems"]`)

#### 5. **Utterance Matches the Question**
   - The `utterance` field should match the question you typed in the UI.
   - This helps correlate stored events with UI interactions.

### Repository Behavior

**Important**: `JsonIstEventRepository.getRecentEvents()`:
- Filters by `userId` (required) and optionally by `courseId`
- Sorts by `createdAt` (newest first)
- Returns up to the last 10 events (configurable via `limit` parameter)

**What this means**:
- All events remain in `events.json` (the file keeps growing)
- Only the most recent 10 events for a user/course are passed to the LLM in a single prompt
- Older events are still available for inspection and potential future analytics

**Example**: If you have 15 events for `demo-user-1`, only the newest 10 will be included in `ist_history` when building context. The other 5 remain in the file but are not sent to DSPy.

---

## 6. Expected Logs and Troubleshooting Notes

### Summary of Main Log Patterns

#### DSPy Terminal (Terminal 1) – Successful Flow

**On startup**:
```
🔧 Initializing DSPy Intent–Skill–Trajectory extractor...
✅ DSPy service initialized successfully
INFO:     Uvicorn running on http://127.0.0.1:8000
```

**On each request**:
```
[IST] Processing request - utterance: ..., context: ...
[IST] Received chat_history size: 3
[IST] Received ist_history size: N
[IST] Returning response - intent length: X, skills count: Y, trajectory count: Z
INFO:     127.0.0.1:xxxxx - "POST /api/intent-skill-trajectory HTTP/1.1" 200 OK
```

#### Next.js Terminal (Terminal 2) – Successful Flow

**On startup**:
```
▲ Next.js 15.x.x
- Local:        http://localhost:9002
```

**On each IST extraction**:
```
[IST][Context][DEMO] Using demo identity: { userId: 'demo-user-1', courseId: 'cs-demo-101' }
[IST][Context] Loaded recent IST events: N
[IST][Context] Loaded recent chat messages: 3
[IST] Extracted IST: { utterance: '...', courseContext: '...', ist: {...} }
[IST][Repository] Stored IST event
```

### Common Issues and Troubleshooting

#### Issue 1: UI Works But No DSPy Logs Appear

**Symptoms**: The chat UI loads and responds, but Terminal 1 (DSPy) shows no request logs.

**Checks**:
1. ✅ Verify `DSPY_SERVICE_URL` in `.env.local` matches the DSPy service URL (default: `http://localhost:8000`)
2. ✅ Verify uvicorn is running on port 8000 (check Terminal 1 for `Uvicorn running on http://127.0.0.1:8000`)
3. ✅ Check for CORS errors in the browser console (F12 → Console tab)
4. ✅ Verify the DSPy service is accessible: Open `http://localhost:8000/health` in a browser (should return `{"status": "healthy"}`)

**Fix**: Restart both services if the URL mismatch or CORS issues are suspected.

---

#### Issue 2: FastAPI Returns Errors About Missing API Key

**Symptoms**: Terminal 1 shows errors like:
```
RuntimeError: OPENAI_API_KEY is not set. Please set OPENAI_API_KEY in your .env file...
```

**Checks**:
1. ✅ Verify `dspy_service/.env` exists
2. ✅ Verify `OPENAI_API_KEY=sk-...` is set with a real API key (not a placeholder)
3. ✅ Verify the API key is not quoted (e.g., `OPENAI_API_KEY="sk-..."` should be `OPENAI_API_KEY=sk-...`)
4. ✅ Verify the virtual environment is activated (Terminal 1 should show `(venv)` in the prompt)

**Fix**: Create or update `dspy_service/.env` with a valid API key and restart the service.

---

#### Issue 3: IST_DEMO_MODE Does Not Seem Active

**Symptoms**: Terminal 2 shows no `[IST][Context][DEMO] Using demo identity` logs, or `events.json` shows `userId: null`.

**Checks**:
1. ✅ Confirm `.env.local` has `IST_DEMO_MODE=true` (not `"true"` or `True`)
2. ✅ Verify the Next.js dev server was **restarted** after editing `.env.local` (Next.js only reads env vars on startup)
3. ✅ Check for typos: Should be exactly `IST_DEMO_MODE=true` (case-sensitive)

**Fix**: 
- Update `.env.local` with `IST_DEMO_MODE=true`
- **Stop** the Next.js server (Ctrl+C in Terminal 2)
- **Restart** with `npm run dev`
- Try sending a question again

---

#### Issue 4: Events.json Is Not Updated

**Symptoms**: Questions are sent, but `src/mocks/ist/events.json` doesn't change or doesn't exist.

**Checks**:
1. ✅ Look for `[IST][Repository] Stored IST event` in Terminal 2 (confirms save was attempted)
2. ✅ Verify `IST_STORAGE_MODE=json` in `.env.local` (or leave it unset, defaults to `json`)
3. ✅ Check file permissions: Ensure the process can write to `src/mocks/ist/`
4. ✅ Verify the directory exists: `src/mocks/ist/` should exist (repository creates it automatically)

**Fix**: 
- Check Terminal 2 for error messages during save
- Verify `IST_STORAGE_MODE=json` in `.env.local`
- Manually create `src/mocks/ist/` directory if it doesn't exist
- Restart Next.js server

---

#### Issue 5: Chat History Size Is 0 Instead of 3

**Symptoms**: DSPy terminal shows `Received chat_history size: 0` instead of `3` in demo mode.

**Checks**:
1. ✅ Verify `IST_DEMO_MODE=true` in `.env.local`
2. ✅ Verify Next.js server was restarted after setting the env var
3. ✅ Check Terminal 2 for `[IST][Context] Loaded recent chat messages: 3` (confirms chat history was loaded on Next.js side)

**Fix**: Enable demo mode and restart Next.js server (see Issue 3).

---

#### Issue 6: IST History Size Doesn't Grow

**Symptoms**: Second and third questions still show `ist_history size: 0` instead of growing.

**Checks**:
1. ✅ Verify events are being saved: Check `events.json` for new entries after each question
2. ✅ Verify `userId` is consistent: All events should have the same `userId` (e.g., `"demo-user-1"`)
3. ✅ Verify `courseId` is consistent: All events should have the same `courseId` (e.g., `"cs-demo-101"`)
4. ✅ Check Terminal 2 for `[IST][Context] Loaded recent IST events: N` (should increase: 0 → 1 → 2)

**Fix**: 
- Ensure demo mode is active (consistent `userId`/`courseId`)
- Verify events are being saved to `events.json`
- Check for errors in Terminal 2 during context loading

---

#### Issue 7: Skills/Trajectory Are JSON Strings Instead of Arrays

**Symptoms**: In `events.json`, you see:
```json
"skills": "[\"binary trees\", \"tree traversal\"]"
```
Instead of:
```json
"skills": ["binary trees", "tree traversal"]
```

**Explanation**: This was a bug that was fixed in an earlier session. The normalization logic in `dspy_flows.py` should handle JSON strings and convert them to arrays.

**Checks**:
1. ✅ Verify you're using the latest code (the fix should be in `dspy_service/dspy_flows.py`)
2. ✅ Check DSPy terminal for normalization logs: `[IST] Normalized list from JSON string: X items`

**Fix**: If this still occurs, check the normalization logic in `dspy_flows.py` (the `normalize_list()` function).

---

### Validation Summary

These UI tests validate:

✅ **End-to-end connectivity**: UI → Next.js → DSPy → storage is working correctly  
✅ **Context enrichment**: IST history and chat history are being loaded and sent to the LLM  
✅ **Demo mode functionality**: Fixed demo identities and canned chat history enable testing without real auth  
✅ **Progressive refinement**: Multiple questions show accumulating context and increasingly personalized recommendations  
✅ **Data persistence**: IST events are stored correctly and can be retrieved for future context building  

The system is now ready to be wired to real user identities (from Firebase Auth) and a production data layer (e.g., Firebase DataConnect + GraphQL) in future iterations, while maintaining the same repository abstraction and DSPy service boundaries.

---

**Last Updated**: December 1, 2025  
**Status**: ✅ Test plan validated with demo mode and context enrichment features

