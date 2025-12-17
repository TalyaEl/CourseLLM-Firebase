# Partner Setup Instructions

Follow these steps to set up the project locally. This setup is required because some configuration files are sensitive or local-only and are excluded from Git.

## 1. Prerequisites

Ensure you have the following installed:
- **Node.js** (v18+ recommended)
- **Python** (3.10+ recommended)
- **Firebase CLI**: `npm install -g firebase-tools`
- **Java**: Required for Firebase Emulators (ensure `java -version` works)

## 2. Configuration Files Setup

You need to create the following local configuration files manually.

### A. Environment Variables

1. **Root Directory**:
   Copy the example file to `.env.local`:
   ```bash
   cp .env.example .env.local
   # On Windows Command Prompt: copy .env.example .env.local
   ```
   *Modify `.env.local` if you have specific API keys (e.g., specific `GOOGLE_API_KEY`), otherwise the defaults/placeholders may work for some features.*

2. **DSPy Service**:
   Navigate to the `dspy_service` directory and create the `.env` file:
   ```bash
   cd dspy_service
   cp .env.example .env
   # On Windows Command Prompt: copy .env.example .env
   ```
   **Important**: You **MUST** text edit `dspy_service/.env` and add a valid **`OPENAI_API_KEY`** (or Gemini key). The service will not start without it.

### B. Local Data Mocks

1. **IST Pipeline Events**:
   Create the local events JSON file from the example:
   ```bash
   # From the project root
   cp src/mocks/ist/events.json.example src/mocks/ist/events.json
   # On Windows Command Prompt: copy src\mocks\ist\events.json.example src\mocks\ist\events.json
   ```
   *This file is used to store local pipeline state.*

## 3. Installation & Startup

Run these commands in separate terminal windows/tabs in the order below.

### Step 1: Install Dependencies

```bash
# 1. Install Node.js dependencies (Root)
npm install

# 2. Install Python dependencies (DSPy Service)
cd dspy_service
python -m venv venv
# Activate venv:
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
# source venv/bin/activate

pip install -r requirements.txt
```

### Step 2: Start Firebase Emulators

In a new terminal (Root):
```bash
firebase emulators:start
```
*Wait until you see "All emulators ready".*

### Step 3: Start DSPy Service

In a new terminal (inside `dspy_service`, with venv activated):
```bash
# Ensure you are in dspy_service/ and venv is active
python app.py
```
*Runs on `http://localhost:8000`.*

### Step 4: Start Next.js App

In a new terminal (Root):
```bash
npm run dev
```
*Runs on `http://localhost:9002`.*

## 4. Verification

To verify everything is working:

1.  **Frontend**: Open [http://localhost:9002](http://localhost:9002). The app should load.
2.  **DSPy Service**: Check the terminal running `python app.py`. It should say `Uvicorn running on http://0.0.0.0:8000`.
3.  **Firebase Emulators**: Open the Emulator UI at [http://localhost:4000](http://localhost:4000) (verify port in terminal output).
4.  **IST Data Connect**: Check logs for successful connections or visit debug routes if available.

## 5. Common Issues

*   **Missing API Key**: If `python app.py` crashes immediately, check `dspy_service/.env` has a valid key.
*   **Java Missing**: If `firebase emulators:start` fails, install Java (JDK 11+).
*   **Ports in Use**: Ensure ports 8000 (DSPy), 9002 (Next.js), 8080 (Firestore), 5001 (Functions), 9399 (Data Connect) are free.
*   **Module not found**: Ensure you activated the Python virtual environment (`venv`) before running `app.py`.
