# IST Pipeline Status Snapshot - November 30, 2025

## 1. High-Level Overview

**Project**: CourseWise - An AI-powered tutoring system for CS courses built with Next.js 15, TypeScript, Firebase/Genkit, and a Python DSPy microservice.

**IST Pipeline**: The Intent-Skill-Trajectory (IST) extraction system analyzes student questions in the Socratic chat flow to extract:
- **Intent**: What the student is trying to understand/do
- **Skills**: Relevant CS skills or concepts they need
- **Trajectory**: Suggested next learning steps

**End-to-End Flow**:
1. Student asks a question in the Socratic chat UI
2. `socraticCourseChat` (Next.js server action) calls `extractAndStoreIST()`
3. `extractAndStoreIST()` sends the utterance to DSPy FastAPI service (port 8000)
4. DSPy service uses OpenAI/Gemini to extract IST data
5. IST data is returned to Next.js
6. Next.js stores the event using repository abstraction (currently JSON-based)
7. Chat continues normally (IST extraction is non-blocking)

---

## 2. Current Architecture (IST Pipeline)

### Components

- **`src/ai/flows/socratic-course-chat.ts`**
  - Server action that handles Socratic chat interactions
  - Calls `extractAndStoreIST()` asynchronously (non-blocking)
  - Continues with normal Genkit chat flow

- **`src/lib/ist/extractIST.ts`**
  - Main IST extraction orchestrator
  - Calls DSPy FastAPI service at `http://localhost:8000/api/intent-skill-trajectory`
  - Uses repository abstraction to store events
  - All errors are logged but don't block the main flow

- **`dspy_service/` (Python FastAPI microservice)**
  - **`app.py`**: FastAPI app with `/api/intent-skill-trajectory` endpoint
  - **`dspy_flows.py`**: DSPy module (`IntentSkillTrajectoryModule`) that uses LLM to extract IST
  - Runs on port 8000, CORS enabled for `localhost:3000`
  - Uses `dspy.LM` with OpenAI (default) or Gemini via LiteLLM

- **Repository Abstraction Layer**
  - **`src/lib/ist/types.ts`**: TypeScript interfaces (`IstEvent`, `CreateIstEventInput`)
  - **`src/lib/ist/repositories/istEventRepository.ts`**: Interface definition
  - **`src/lib/ist/repositories/index.ts`**: Factory function (`getIstEventRepository()`)
  - **`src/lib/ist/repositories/jsonIstEventRepository.ts`**: JSON-based implementation
  - **`src/lib/ist/repositories/postgresIstEventRepository.ts`**: Stub for future Postgres implementation

### JSON Storage

- **Location**: `src/mocks/ist/events.json`
- **Format**: Array of `IstEvent` objects
- **Persistence**: In-memory cache + file write on every `save()`
- **Directory**: Auto-created if missing

---

## 3. How to Run Everything Locally

### Step 1: Start DSPy Service

```powershell
# Navigate to dspy_service folder
cd dspy_service

# Activate virtual environment (Windows PowerShell)
.\venv\Scripts\activate

# Set up .env file (copy from .env.example if needed)
# Edit .env and set your real OPENAI_API_KEY

# Start the service
python -m uvicorn app:app --reload --port 8000
```

**Expected output**:
```
🔧 Initializing DSPy Intent–Skill–Trajectory extractor...
✅ DSPy service initialized successfully
[IST][Repository] Using JSON-based storage
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Step 2: Start Next.js App

```powershell
# From project root
npm run dev
```

**Expected output**: Next.js dev server on `http://localhost:9002` (see package.json for port config)

### Ports Used

- **DSPy Service**: `8000` (FastAPI)
- **Next.js App**: `9002` (default from package.json)

### Environment Variables

#### DSPy Service (`dspy_service/.env`)

```env
# Required for OpenAI
OPENAI_API_KEY=sk-...your-real-key...

# Optional: Provider selection
LLM_PROVIDER=openai  # or "gemini"
LLM_MODEL=openai/gpt-4o-mini  # Optional override
```

**File locations**:
- Template: `dspy_service/.env.example` (committed to git)
- Actual: `dspy_service/.env` (git-ignored, must be created manually)

#### Next.js App (`.env.local` at project root)

```env
# Gemini/Google AI (for Genkit Socratic chat)
GOOGLE_API_KEY=AIzaSy...your-real-key...
GEMINI_API_KEY=AIzaSy...your-real-key...  # Alternative

# Optional: DSPy service URL override (defaults to localhost:8000)
DSPY_SERVICE_URL=http://localhost:8000

# Optional: IST storage mode (defaults to 'json')
IST_STORAGE_MODE=json  # or 'postgres' (future)
```

**File locations**:
- Actual: `.env.local` at project root (git-ignored)

---

## 4. Data & Storage Details

### IstEvent Type Definition

```typescript
interface IstEvent {
  id: string;                    // Auto-generated (incremental: "1", "2", ...)
  createdAt: string;             // ISO timestamp (e.g., "2025-11-30T18:52:01.498Z")
  userId?: string | null;        // Currently null (TODO: wire from auth context)
  courseId?: string | null;      // Currently null (TODO: wire from route params)
  utterance: string;             // Original student question
  courseContext?: string | null; // Course material snippet (first 200 chars)
  intent: string;                // Extracted intent (e.g., "The student wants to understand recursion.")
  skills: string[];              // Array of skills (e.g., ["recursion", "base case"])
  trajectory: string[];          // Array of learning steps (e.g., ["review Module 1", "watch video"])
}
```

### Current Status

- **Storage**: JSON file at `src/mocks/ist/events.json`
- **userId/courseId**: Currently `null` (placeholders for future auth/context wiring)
- **Persistence**: Data persists across server restarts
- **Limitations**:
  - Single-server only (not suitable for multi-instance deployments)
  - Not thread-safe across multiple processes
  - In-memory array grows with all events (OK for dev, not production)
  - File system dependency (requires write access)

**Intended Use**: Local development and testing only. Production should use `IST_STORAGE_MODE=postgres`.

---

## 5. Migration Path to Real DB (Supabase/Postgres)

### Current State

- **`PostgresIstEventRepository`** exists as a stub file that throws "not yet implemented" errors
- **Repository factory** (`src/lib/ist/repositories/index.ts`) already has logic to switch modes via `IST_STORAGE_MODE` env var
- **Schema file** exists: `src/lib/ist/schema.sql` (reference for table structure)
- **DB client** exists: `src/lib/db/pgClient.ts` (singleton Pool pattern, reads `IST_DB_URL`)

### What Needs Implementation

1. **Implement `PostgresIstEventRepository`** in `src/lib/ist/repositories/postgresIstEventRepository.ts`:
   - Use `getPool()` from `src/lib/db/pgClient.ts`
   - Implement all interface methods using SQL queries
   - Map `IstEvent` ↔ PostgreSQL `jsonb` columns for `skills` and `trajectory`

2. **Set environment variables**:
   - `IST_STORAGE_MODE=postgres`
   - `IST_DB_URL=<supabase-connection-string>`

3. **Run SQL schema** in Supabase:
   - Execute `src/lib/ist/schema.sql` to create `intent_skill_trajectory_events` table

### Files That Will Change

- ✅ **No changes needed**: `extractIST.ts`, `socratic-course-chat.ts` (already use repository abstraction)
- ⚠️ **Must implement**: `postgresIstEventRepository.ts` (stub → full implementation)
- ✅ **Already ready**: Repository factory, types, schema

---

## 6. Recent Changes in This Session

### Repository Abstraction Implementation

- **Created** `src/lib/ist/types.ts` with `IstEvent` and `CreateIstEventInput` interfaces
- **Created** repository interface (`src/lib/ist/repositories/istEventRepository.ts`)
- **Created** JSON implementation (`src/lib/ist/repositories/jsonIstEventRepository.ts`)
  - Persists to `src/mocks/ist/events.json`
  - Lazy-loads on first access
  - Write-through cache (updates memory + file on save)
- **Created** Postgres stub (`src/lib/ist/repositories/postgresIstEventRepository.ts`)
- **Created** repository factory (`src/lib/ist/repositories/index.ts`)

### Updated Files

- **`src/lib/ist/extractIST.ts`**:
  - Removed direct Postgres calls (`storeISTInPostgres()`, `getPool()` import)
  - Now uses `getIstEventRepository()` and `repo.save()`
  - Maintains non-blocking error handling

- **`.gitignore`**:
  - Added `src/mocks/ist/events.json` (ignores local JSON data)
  - Added `!.env.example` exception (allows `.env.example` files)

### DSPy Service Improvements

- **`dspy_service/dspy_flows.py`**:
  - Enhanced JSON array parsing in `normalize_list()` function
  - Handles JSON array strings like `"[\"recursion\", \"base case\"]"` correctly
  - Falls back gracefully to string splitting if JSON parsing fails
  - Added debug logging for normalization method tracking

- **`dspy_service/app.py`**:
  - Already had `load_dotenv()` at startup
  - Improved error messages for missing API keys

- **`dspy_service/dspy_flows.py`**:
  - Added placeholder validation for API keys (rejects "PASTE_YOUR_..." values)
  - Improved error messages pointing to `.env` file

- **Created** `dspy_service/.env.example` as template

### Working Confirmation

**Log messages that confirm the flow is working**:
```
[IST] Extracted IST: { utterance: "...", courseContext: "...", ist: {...} }
[IST][Repository] Stored IST event
[IST][Repository] Using JSON-based storage
[IST] Normalized list from JSON string: 3 items  # or "from list type" / "from string splitting"
```

**JSON file**: `src/mocks/ist/events.json` contains stored events with proper structure (see id "3" for clean array example).

---

## 7. Known Issues / TODOs / Next Steps

### HIGH PRIORITY for Next Session

1. **Wire real `userId` and `courseId`** in `socratic-course-chat.ts`
   - Currently: `userId: undefined, courseId: undefined`
   - TODO: Extract from auth context and route params
   - **Impact**: Events stored without user/course context (harder to query later)

2. **JSON Array Parsing Edge Cases**
   - Recent fix handles most cases, but monitor for edge cases
   - Event id "2" in `events.json` shows old malformed data (JSON arrays split incorrectly)
   - Event id "3" shows correct format after fix
   - **Action**: Test with various model outputs to ensure robustness

3. **Test Postgres Repository Implementation**
   - When ready to migrate, need thorough testing
   - **Prerequisite**: Supabase connection string and schema deployment

### Medium Priority

4. **Improve DSPy Prompts**
   - Current prompts work but could be refined for better IST extraction
   - Consider adding few-shot examples to signature

5. **Add Repository Tests**
   - Unit tests for `JsonIstEventRepository`
   - Integration tests for IST extraction flow
   - Mock DSPy service for testing

6. **Analytics/Dashboard**
   - UI to view IST events history
   - Visualize skills/trajectory trends per user/course
   - **Future feature**: Not critical for MVP

7. **Error Recovery**
   - Handle DSPy service downtime gracefully (currently just logs error)
   - Consider retry logic for transient failures

### Low Priority / Future

8. **Performance Optimization**
   - Consider batching IST storage writes
   - Add indexing for JSON file queries (if keeping JSON mode long-term)

9. **Documentation**
   - API documentation for DSPy service endpoints
   - Architecture diagram for IST flow

10. **Monitoring**
    - Add metrics/logging for IST extraction success rate
    - Track storage failures separately from extraction failures

---

## 8. Quick Recap for Another LLM

### What's Already Working

- ✅ **Complete IST extraction pipeline** from student question → DSPy → storage
- ✅ **JSON-based repository** storing events in `src/mocks/ist/events.json`
- ✅ **Repository abstraction** ready for Postgres migration (just implement the stub)
- ✅ **DSPy service** running on port 8000 with proper API key handling
- ✅ **Next.js integration** calling DSPy and storing events (non-blocking)
- ✅ **JSON array parsing** fixed to handle model outputs correctly

### How to Run Everything

1. **Terminal 1**: `cd dspy_service && .\venv\Scripts\activate && python -m uvicorn app:app --reload --port 8000`
2. **Terminal 2**: `npm run dev` (from project root)
3. **Verify**: Check logs for `[IST] Extracted IST` and `[IST][Repository] Stored IST event`
4. **Inspect**: Open `src/mocks/ist/events.json` to see stored events

### What the User Wants to Do Next

Based on TODOs above, likely priorities:
- Wire `userId`/`courseId` from auth/route context (HIGH PRIORITY)
- Test and refine JSON parsing with more diverse inputs
- Eventually implement Postgres repository when ready for production

### Most Important Files to Open First

1. **`src/lib/ist/extractIST.ts`** - Main IST extraction entry point
2. **`src/lib/ist/repositories/jsonIstEventRepository.ts`** - Current storage implementation
3. **`src/ai/flows/socratic-course-chat.ts`** - Where IST extraction is triggered
4. **`dspy_service/dspy_flows.py`** - DSPy module that extracts IST (line 280+ for normalization logic)
5. **`src/mocks/ist/events.json`** - View stored events (debugging)

### Key Architecture Points

- **DSPy service is separate microservice** - doesn't touch database
- **All DB logic is in Next.js** - repository abstraction in `src/lib/ist/repositories/`
- **IST extraction is non-blocking** - errors are logged but don't break chat flow
- **Storage is currently JSON file** - ready to swap to Postgres via env var when implemented

---

**Last Updated**: November 30, 2025  
**Status**: ✅ Working end-to-end with JSON storage, ready for Postgres migration when needed


