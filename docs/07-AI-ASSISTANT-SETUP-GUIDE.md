# CourseLLM IST Project - AI Assistant Setup Guide

## For AI Assistants (Claude Code, GitHub Copilot, etc.)

This file contains step-by-step instructions to set up this project. Read this entire file, then execute each step in order, verifying success before proceeding to the next step.

## For Developers

Ask your AI assistant to read this file and follow the instructions.

**Example:** "Please read 07-AI-ASSISTANT-SETUP-GUIDE.md and help me set up this project"

---

## Overview

This is the CourseLLM Firebase project with IST (Intent-Skill-Trajectory) pipeline. It consists of:

- Next.js frontend application
- Firebase Cloud Functions backend
- Firebase DataConnect with PostgreSQL
- Python DSPy microservice for LLM analysis
- Firebase Emulators for local development

---

## Prerequisites Check

**AI Assistant:** Before starting, verify the user has these installed:

1. **Node.js version 18 or higher**
   - Check with: `node --version`

2. **Java JDK version 21 or higher** (required for Firebase emulators)
   - Check with: `java --version`

3. **Firebase CLI installed globally**
   - Check with: `firebase --version`
   - If missing, instruct user to run: `npm install -g firebase-tools`

4. **Python 3.8 or higher**
   - Check with: `python --version` or `python3 --version`

5. **Git**
   - Check with: `git --version`

**If any are missing, STOP and ask the user to install the missing prerequisites before continuing.**

---

## Step 1: Install Node.js Dependencies

**AI Assistant:** Execute these commands and verify each succeeds before moving on.

### 1.1. Install root project dependencies

```bash
npm install
```

**Expected:** Should complete without errors
**If errors:** Show the error to the user and debug

### 1.2. Install Functions dependencies

```bash
cd functions && npm install && cd ..
```

**Expected:** Should complete without errors
**If errors:** Show the error to the user and debug

### 1.3. Verify critical packages are installed

Check that `node_modules` exists in both root and `functions/` directories

---

## Step 2: Set Up Python Environment

**AI Assistant:** The Python DSPy service is located in the `dspy_service/` directory.

### 2.1. Navigate to dspy_service

```bash
cd dspy_service
```

### 2.2. Create Python virtual environment

```bash
python -m venv venv
```

**Alternative** (if python command fails):
```bash
python3 -m venv venv
```

**Expected:** A `venv/` directory should be created
**Verify:** Check that `dspy_service/venv/` exists

### 2.3. Determine activation command based on OS

- **Windows CMD:** `venv\Scripts\activate`
- **Windows PowerShell:** `venv\Scripts\Activate.ps1`
- **macOS/Linux:** `source venv/bin/activate`

Tell the user which command to use based on their system.

### 2.4. Activate the virtual environment

Ask user to run the activation command from step 2.3
**Expected:** Command prompt should show `(venv)` prefix

### 2.5. Install Python dependencies

```bash
pip install -r requirements.txt
```

**Expected:** Should install all packages without errors

**If this fails with errors:**
- Try: `pip install --upgrade pip`
- Then retry: `pip install -r requirements.txt`
- If still failing, install core packages individually:
  ```bash
  pip install fastapi uvicorn python-dotenv
  ```

### 2.6. Verify Python packages installed

```bash
pip list
```

**Expected:** Should see fastapi, uvicorn, python-dotenv and others

Check specifically for:
- fastapi (should be installed)
- uvicorn (should be installed)
- python-dotenv (should be installed)

### 2.7. Return to project root

```bash
cd ..
```

---

## Step 3: Configure Environment Variables

**AI Assistant:** The project needs a `.env.local` file with specific configuration.

### 3.1. Check if .env.local exists

If it doesn't exist, create it by copying `.env.example`:

```bash
# Unix/macOS/Linux
cp .env.example .env.local

# Windows
copy .env.example .env.local
```

### 3.2. Open .env.local and verify/add these REQUIRED variables

```bash
# Firebase Emulator Configuration
NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true
FIRESTORE_EMULATOR_HOST=localhost
FIRESTORE_EMULATOR_PORT=8080
FIREBASE_FUNCTIONS_EMULATOR_HOST=localhost
FIREBASE_FUNCTIONS_EMULATOR_PORT=5001

# Firebase Project ID (use this for local development)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=coursewise-f2421
REACT_APP_FIREBASE_PROJECT_ID=coursewise-f2421
FIREBASE_PROJECT_ID=coursewise-f2421

# DSPy Service Configuration
DSPY_SERVICE_URL=http://localhost:8000
NEXT_PUBLIC_DSPY_SERVICE_URL=http://localhost:8000

# IST Pipeline Configuration
IST_DEMO_MODE=true
NEXT_PUBLIC_IST_ENGINE_MODE=callable
IST_STORAGE_MODE=json

# Firebase Auth (can use demo values for local development)
NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo.firebaseapp.com
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=demo-app-id

REACT_APP_FIREBASE_API_KEY=demo-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=demo.firebaseapp.com
REACT_APP_FIREBASE_STORAGE_BUCKET=demo.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=demo-app-id
```

### 3.3. OPTIONAL: If user has real API keys and wants to use production LLM

Add these (otherwise skip):
```bash
GOOGLE_API_KEY=their_api_key_here
GEMINI_API_KEY=their_api_key_here
```

### 3.4. Configure DSPy service environment

Check if `dspy_service/.env` exists. If not, create it:

```bash
# Unix/macOS/Linux
cp dspy_service/.env.example dspy_service/.env

# Windows
copy dspy_service\.env.example dspy_service\.env
```

---

## Step 4: Verify DataConnect Configuration

**AI Assistant:** This is CRITICAL - incorrect port configuration will cause errors.

### 4.1. Verify firebase.json has DataConnect on port 9400

- Open `firebase.json`
- Find the "dataconnect" section under "emulators"
- Confirm it shows: `"port": 9400`

**If different, STOP and report to user - this is unexpected.**

### 4.2. Verify all DataConnect client files use port 9400

Check these 3 files (search for "connectDataConnectEmulator"):

**File 1:** `functions/src/dataconnect/istEventsClient.ts`
Around line 45, should see:
```typescript
connectDataConnectEmulator(dc, 'localhost', 9400);
```

**File 2:** `functions/src/istContextFromDataConnect.ts`
Around line 55, should see:
```typescript
connectDataConnectEmulator(dc, 'localhost', 9400);
```

**File 3:** `src/lib/dataConnect/istEventsWebClient.ts`
Around line 39, should see:
```typescript
connectDataConnectEmulator(dc, "localhost", 9400);
```

**If ANY file shows 9399 or a different port:**
- Update it to 9400
- Report to user that you fixed a port mismatch
- This was a known bug that has been fixed

### 4.3. Build the Functions with correct configuration

```bash
cd functions && npm run build && cd ..
```

**Expected:** TypeScript should compile without errors
**If errors:** Show them to the user and debug

---

## Step 5: Start the Services

**AI Assistant:** Three services must run simultaneously. Instruct the user to open 3 separate terminal windows/tabs.

**IMPORTANT:** Each service must start successfully before starting the next one.

### 5.1. TERMINAL 1 - Start Firebase Emulators

```bash
firebase emulators:start
```

**Expected output** (wait for these lines):
- "Starting emulators: functions, firestore, dataconnect, extensions"
- "✔  All emulators ready! It is now safe to connect your app."
- "View Emulator UI at http://127.0.0.1:4000/"

**Verify these emulators are running:**
- Functions: http://127.0.0.1:5001
- Firestore: http://127.0.0.1:8080
- DataConnect: http://127.0.0.1:9400
- Emulator UI: http://127.0.0.1:4000

**Common issues:**
- Port already in use: Ask user to close other apps using these ports
- Java version error: User needs Java 21+
- Project ID error: This is expected warning, can be ignored

**WAIT FOR EMULATORS TO FULLY START before proceeding!**

### 5.2. TERMINAL 2 - Start Python DSPy Service

**Step 1:** Navigate to dspy_service:
```bash
cd dspy_service
```

**Step 2:** Activate virtual environment (Use the command from Step 2.3 based on user's OS):
- **Windows CMD:** `venv\Scripts\activate`
- **Windows PowerShell:** `venv\Scripts\Activate.ps1`
- **macOS/Linux:** `source venv/bin/activate`

**Expected:** Prompt should show `(venv)`

**Step 3:** Start the service:
```bash
python main.py
```

**Alternative** (if python fails):
```bash
python3 main.py
```

**Expected output:**
- "Uvicorn running on http://127.0.0.1:8000"
- "Application startup complete"
- No error messages

**Verify:** Ask user to open http://localhost:8000/docs in browser. Should see FastAPI Swagger documentation page.

**Common issues:**
- Port 8000 in use: Tell user to close other apps or change port
- Module not found: Re-run `pip install -r requirements.txt`
- Import errors: Check that venv is activated (should see `(venv)` in prompt)

**WAIT FOR SERVICE TO START before proceeding!**

### 5.3. TERMINAL 3 - Start Next.js Development Server

```bash
npm run dev
```

**Expected output:**
- "Ready in X ms"
- URL where app is running (usually http://localhost:3000)
- No compilation errors

**Watch for successful compilation of:**
- /ist-dev/dataconnect
- /debug-analysis
- Other IST-related pages

**Common issues:**
- Port 3000 in use: Server will auto-select different port (e.g., 3001)
- Compilation errors: Show errors to user and debug
- Module not found: Run `npm install` again

**Note the actual port where Next.js started (user will need this)**

---

## Step 6: Verify the Setup

**AI Assistant:** Now verify everything is working correctly.

### 6.1. Check all services are running

Ask user to confirm all 3 terminals show active running services:
- Terminal 1: Firebase emulators running
- Terminal 2: DSPy service running on port 8000
- Terminal 3: Next.js running (usually port 3000)

### 6.2. Test Firebase Emulator UI

**Instruct user:** Open http://127.0.0.1:4000/ in browser

**Expected:** Should see Firebase Emulator Suite UI with tabs for Functions, Firestore, Extensions (DataConnect doesn't have UI tab yet, this is normal)

### 6.3. Test DSPy Service

**Instruct user:** Open http://localhost:8000/docs

**Expected:** Should see FastAPI Swagger UI with API endpoints. No errors should appear.

### 6.4. Test Next.js Application

**Instruct user:** Open http://localhost:3000 (or whichever port Next.js started on)

**Expected:** Application should load without errors

### 6.5. Test IST DataConnect Debug Page

**Instruct user:** Navigate to http://localhost:3000/ist-dev/dataconnect

**Expected:** Page should load showing a form with:
- userId input (default: demo-user)
- courseId input (default: cs202)
- "Load IST Events" button

This page may show "No IST events found" initially - this is normal until you send a test message through the IST pipeline.

### 6.6. Check browser console

**Instruct user:**
1. Press F12 to open DevTools
2. Go to Console tab
3. Look for any red errors

**Common warnings that can be ignored:**
- Firebase project warnings (we're using emulators)
- Demo mode warnings

**RED ERRORS that need fixing:**
- "Failed to fetch" from DataConnect
- Network errors to localhost:8000
- Missing module errors

---

## Step 7: Test the IST Pipeline

**AI Assistant:** Now test that the full IST pipeline works.

### 7.1. Send a test message through the system

(The exact UI for this depends on the application, but typically):
- Navigate to a course/chat interface
- Send a test message like "What is the difference between arrays and lists?"

### 7.2. Monitor the Firebase Functions logs

In Terminal 1 (Firebase emulators), watch for output like:
- "[analyzeMessage] Running IST analysis..."
- "[DataConnect] Initialized Data Connect client"
- "[DataConnect] Successfully created IstEvent..."

**If you see errors like "Failed to fetch" or "Failed to create IstEvent":**
- Check DataConnect port configuration (should be 9400)
- Verify emulators are running
- Check Step 4 was completed correctly

### 7.3. Verify data was saved to DataConnect

**Instruct user:** Go to http://localhost:3000/ist-dev/dataconnect
- Enter userId: demo-user (or the user ID from test)
- Enter courseId: cs202 (or the course ID from test)
- Click "Load IST Events"

**Expected:** Should see the IST event(s) with:
- Intent (e.g., "Student wants to know the difference...")
- Skills array (list of required skills)
- Trajectory array (suggested learning steps)
- Timestamp

**If "No IST events found":**
- Verify you used correct userId and courseId
- Check Firebase Functions logs for errors
- Verify DSPy service is running and accessible

---

## Troubleshooting Guide

**AI Assistant:** If something doesn't work, diagnose systematically:

### ISSUE: DataConnect shows "Failed to fetch" errors

**Diagnosis steps:**
1. Check `firebase.json` has `"dataconnect": {"port": 9400}`
2. Verify all 3 DataConnect client files use port 9400 (see Step 4.2)
3. Check Firebase emulators terminal - is DataConnect emulator running?
4. Rebuild functions: `cd functions && npm run build && cd ..`
5. Restart Firebase emulators

### ISSUE: "No IST events found" in DataConnect UI

**Diagnosis steps:**
1. Verify you're using correct userId and courseId
2. Check Firebase Functions terminal for log messages
3. Look for "[DataConnect] Successfully created IstEvent" in logs
4. If you see error logs, read and address the specific error
5. Ensure you've sent at least one test message through the IST pipeline

### ISSUE: Firebase emulators won't start

**Diagnosis steps:**
1. Check Java version: `java --version` (need 21+)
2. Check if ports are available (4000, 5001, 8080, 9400)
3. Try: `firebase emulators:start --project demo-test`
4. On Windows, may need to allow firewall access

### ISSUE: DSPy service fails to start

**Diagnosis steps:**
1. Verify virtual environment is activated (prompt shows `(venv)`)
2. Try: `pip install --upgrade pip`
3. Try: `pip install -r requirements.txt`
4. Check if port 8000 is available
5. Try running on different port: `python main.py --port 8001`
   (then update `.env.local` DSPY_SERVICE_URL to match)

### ISSUE: Next.js won't start or has build errors

**Diagnosis steps:**
1. Delete build cache: `rm -rf .next` (Windows: `rmdir /S /Q .next`)
2. Reinstall packages: `rm -rf node_modules && npm install`
3. Check for specific error messages and address them
4. Verify `.env.local` has all required variables from Step 3

### ISSUE: Browser shows "Failed to fetch" to localhost:8000

**Diagnosis steps:**
1. Verify DSPy service is running in Terminal 2
2. Test http://localhost:8000/docs directly in browser
3. Check browser console for CORS errors
4. Verify `.env.local` has correct DSPY_SERVICE_URL

### ISSUE: TypeScript compilation errors

**Diagnosis steps:**
1. Check if all packages are installed: `npm install`
2. Check `functions/tsconfig.json` is present
3. Try: `cd functions && npm run build`
4. Read error messages and fix type issues

### ISSUE: Module not found errors (Node.js)

**Solution:**
```bash
npm install [missing-module]
```

Or reinstall all:
```bash
rm -rf node_modules && npm install
```

### ISSUE: Module not found errors (Python)

**Solution:**
1. Ensure venv is activated
2. `pip install [missing-module]`

Or reinstall all:
```bash
pip install -r requirements.txt
```

---

## Understanding the Architecture

**AI Assistant:** Help the user understand how the pieces fit together:

### Service Flow

1. User sends message in Next.js UI
2. Next.js calls Firebase Cloud Function "analyzeMessage"
3. Cloud Function calls DSPy service (Python) for LLM analysis
4. DSPy service returns intent, skills, trajectory
5. Cloud Function saves result to DataConnect (PostgreSQL)
6. Cloud Function also saves to Firestore
7. UI can query DataConnect to view saved IST events

### Key Ports

- **3000:** Next.js frontend
- **4000:** Firebase Emulator UI
- **5001:** Firebase Functions emulator
- **8000:** Python DSPy service
- **8080:** Firestore emulator
- **9400:** DataConnect emulator (PostgreSQL)

### Important Files

- `firebase.json` - Emulator configuration
- `.env.local` - Environment variables
- `functions/src/analyzeMessage.ts` - Main IST analysis function
- `functions/src/dataconnect/istEventsClient.ts` - DataConnect write client
- `src/lib/dataConnect/istEventsWebClient.ts` - DataConnect web client
- `dspy_service/main.py` - Python LLM service

### Data Flow

- Messages → Firestore (chat storage)
- IST Analysis → DataConnect PostgreSQL (structured IST events)
- Both can be viewed in respective UIs

---

## Additional Notes for AI Assistants

1. All emulator data is ephemeral - restarting emulators clears the database

2. `IST_DEMO_MODE=true` bypasses authentication for easier testing

3. The DataConnect emulator uses embedded PostgreSQL, no separate DB needed

4. If user wants production deployment, they need:
   - Real Firebase project with Blaze plan
   - Cloud SQL instance for DataConnect
   - Deploy functions: `firebase deploy --only functions`
   - Update `.env.local` with production credentials

5. When debugging, always check all 3 terminal outputs for error messages

6. The project uses TypeScript, so any code changes in `functions/` need rebuild

7. **Port 9400 for DataConnect is critical** - port 9399 was a bug, should be 9400

---

## Success Checklist

**AI Assistant:** Before telling the user setup is complete, verify:

- [ ] All 3 services running without errors:
  - [ ] Firebase emulators in Terminal 1
  - [ ] Python DSPy service in Terminal 2
  - [ ] Next.js dev server in Terminal 3

- [ ] All URLs accessible in browser:
  - [ ] http://127.0.0.1:4000 (Emulator UI)
  - [ ] http://localhost:8000/docs (DSPy API docs)
  - [ ] http://localhost:3000 (Next.js app)
  - [ ] http://localhost:3000/ist-dev/dataconnect (IST debug page)

- [ ] No red errors in:
  - [ ] Any terminal output
  - [ ] Browser console (F12)
  - [ ] Network tab (F12)

- [ ] Test message successfully:
  - [ ] Triggers IST analysis
  - [ ] Saves to DataConnect
  - [ ] Appears in ist-dev/dataconnect page

**If all checkboxes are checked, setup is complete!**

---

## Final Instructions for AI Assistants

### When you finish successfully

1. Congratulate the user
2. Provide a summary of what's running and where
3. Give them the key URLs to bookmark
4. Remind them they need all 3 terminals to stay open
5. Tell them how to stop services (Ctrl+C in each terminal)

### If you encounter errors you can't resolve

1. Show the complete error message
2. Show what you've tried
3. Ask the user for additional context
4. Suggest they check the Troubleshooting Guide
5. Recommend searching for the specific error online

**Remember:** Work step-by-step, verify each step succeeds, and communicate clearly with the user throughout the process.

Good luck!
