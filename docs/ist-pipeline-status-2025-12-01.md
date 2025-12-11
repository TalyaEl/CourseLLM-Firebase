# IST Pipeline Status Snapshot - December 1, 2025

## 1. High-Level Overview

**Project**: CourseWise - An AI-powered tutoring system for CS courses built with Next.js 15, TypeScript, Firebase/Genkit, and a Python DSPy microservice.

**IST Pipeline**: The Intent-Skill-Trajectory (IST) extraction system analyzes student questions in the Socratic chat flow to extract:
- **Intent**: What the student is trying to understand/do
- **Skills**: Relevant CS skills or concepts they need
- **Trajectory**: Suggested next learning steps

**End-to-End Flow**:
1. Student asks a question in the Socratic chat UI
2. `socraticCourseChat` (Next.js server action) calls `extractAndStoreIST()`
3. `extractAndStoreIST()` builds a rich `IstContext` using the `IstContextService`
4. The context includes: current utterance, course context, recent IST events, recent chat messages, and student profile (future)
5. The enriched context is sent to the DSPy FastAPI service (port 8000)
6. DSPy service uses OpenAI/Gemini to extract IST data, incorporating the context for more personalized recommendations
7. IST data is returned to Next.js
8. Next.js stores the event using repository abstraction (currently JSON-based)
9. Chat continues normally (IST extraction is non-blocking)

**New Capabilities**:
- **Context Enrichment**: The pipeline now supports a richer "student context" model that includes IST history and chat history to provide more personalized recommendations
- **Demo Mode**: A fully local demo mode (`IST_DEMO_MODE=true`) that simulates real users with fixed demo identities (`demo-user-1`, `cs-demo-101`) and canned chat history, enabling testing of the full context enrichment flow without real authentication

---

## 2. Current Architecture (IST Pipeline)

### Next.js Side

- **`src/ai/flows/socratic-course-chat.ts`**
  - Server action that handles Socratic chat interactions
  - Calls `extractAndStoreIST()` asynchronously (non-blocking)
  - Passes `utterance`, `courseContext`, and (optionally) `userId` / `courseId` into the IST context service
  - Continues with normal Genkit chat flow

- **`src/lib/ist/extractIST.ts`**
  - Main IST extraction orchestrator
  - Calls `getIstContextForIstExtraction()` to build a rich `IstContext`
  - Sends enriched payload to DSPy FastAPI service at `http://localhost:8000/api/intent-skill-trajectory`
  - Payload includes: `utterance`, `course_context`, `chat_history`, `ist_history`, `student_profile`
  - Uses repository abstraction to store events
  - Uses `userId` / `courseId` from the `IstContext` when saving (ensures demo IDs are preserved)
  - All errors are logged but don't block the main flow

### IST Context Layer

- **`src/lib/ist/types.ts`**
  - TypeScript interfaces for the IST domain:
    - `IstEvent` - Complete IST event with all fields
    - `CreateIstEventInput` - Input type for creating events (omits auto-generated fields)
    - `ChatMessageRole` - Type: `'student' | 'tutor' | 'system'`
    - `ChatMessage` - Represents a single message in chat history
    - `StudentProfile` - Student learning profile (strong/weak skills, course progress)
    - `IstContext` - Aggregates all context needed for IST extraction

- **`src/lib/ist/istContextService.ts`**
  - Exposes `getIstContextForIstExtraction(params: BuildIstContextParams)`
  - Builds an `IstContext` object that includes:
    - `currentUtterance` - The current student question
    - `courseContext` - Optional course material snippet
    - `userId` / `courseId` - Optional user and course identifiers
    - `recentIstEvents` - Loaded from `IstEventRepository.getRecentEvents()` (up to 10 events)
    - `recentChatMessages` - Loaded from `ChatHistoryRepository.getRecentMessages()` (up to 10 messages)
    - `studentProfile` - Currently `null`, reserved for future logic
  - **Demo Mode Support**:
    - Implements `isIstDemoMode()` helper that checks `process.env.IST_DEMO_MODE === 'true'`
    - When demo mode is enabled and no `userId` is provided, injects:
      - `userId = 'demo-user-1'`
      - `courseId = 'cs-demo-101'`
    - Logs when demo mode is active: `[IST][Context][DEMO] Using demo identity`
    - Logs how many IST events and chat messages were loaded

### Repository Layer

- **`src/lib/ist/repositories/istEventRepository.ts`**
  - Repository interface defining:
    - `save(input: CreateIstEventInput): Promise<IstEvent>`
    - `getRecentEvents(params: GetRecentIstEventsParams): Promise<IstEvent[]>`
  - `GetRecentIstEventsParams` includes:
    - `userId` (required)
    - `courseId` (optional)
    - `limit` (optional, defaults to 10)

- **`src/lib/ist/repositories/jsonIstEventRepository.ts`**
  - JSON-based implementation for local development
  - Persists to `src/mocks/ist/events.json`
  - `getRecentEvents` implementation:
    - Filters by `userId` (required) and optionally by `courseId`
    - Sorts by `createdAt` (newest first)
    - Returns up to `limit` events (default 10)
  - Uses in-memory cache with lazy loading and write-through persistence

- **`src/lib/ist/repositories/postgresIstEventRepository.ts`**
  - Stub implementation for future PostgreSQL/Supabase migration
  - Now also declares `getRecentEvents()` but throws "not yet implemented" error
  - Maintains interface compatibility for future implementation

- **`src/lib/ist/repositories/chatHistoryRepository.ts`**
  - New repository interface:
    - `getRecentMessages(params: GetRecentChatMessagesParams): Promise<ChatMessage[]>`
  - `GetRecentChatMessagesParams` includes:
    - `userId` (required)
    - `courseId` (optional)
    - `limit` (optional, defaults to 10)

- **`src/lib/ist/repositories/inMemoryChatHistoryRepository.ts`**
  - In-memory demo implementation with demo mode support
  - **When `IST_DEMO_MODE=true`**:
    - Returns a canned list of 3 `ChatMessage` items simulating a short conversation:
      - Student message about Big-O notation (10 minutes ago)
      - Tutor response about algorithm runtime (9 minutes ago)
      - Student follow-up about linked lists (2 minutes ago)
    - Messages have realistic timestamps relative to current time
  - **When demo mode is off**:
    - Returns an empty array
  - Ready to be replaced with a real implementation (Firestore, Postgres, GraphQL, etc.)

- **`src/lib/ist/repositories/index.ts`**
  - Repository factory functions:
    - `getIstEventRepository()` - Returns JSON implementation (or Postgres stub if `IST_STORAGE_MODE=postgres`)
    - `getChatHistoryRepository()` - Returns singleton `InMemoryChatHistoryRepository` (ready for future swap)

### DSPy FastAPI Microservice

- **`dspy_service/app.py`**
  - FastAPI application with endpoint: `POST /api/intent-skill-trajectory`
  - **Pydantic Models**:
    - `ChatMessage` - Role, content, optional created_at
    - `IstHistoryItem` - Intent, skills, trajectory, optional created_at
    - `StudentProfile` - Strong/weak skills, course progress
    - `IntentSkillRequest` - Extended request model with:
      - `utterance` (required)
      - `course_context` (optional)
      - `chat_history` (list, default empty)
      - `ist_history` (list, default empty)
      - `student_profile` (optional, default null)
    - `IntentSkillResponse` - Response model with `intent`, `skills`, `trajectory`
  - Logs the sizes of `chat_history` and `ist_history` for debugging
  - CORS enabled for `localhost:9002` (Next.js dev server)
  - Passes enriched context to DSPy module

- **`dspy_service/dspy_flows.py`**
  - DSPy module configuration and IST extraction logic
  - **`IntentSkillTrajectorySignature`**:
    - Extended input fields: `utterance`, `course_context`, `chat_history`, `ist_history`, `student_profile`
    - Output fields: `intent`, `skills`, `trajectory`
    - Signature description guides the LLM to use all context fields for personalized recommendations
  - **`IntentSkillTrajectoryModule`**:
    - `forward()` method accepts the enriched context parameters
    - Converts Pydantic models from `app.py` to DSPy models
    - Formats context into human-readable sections:
      - `_build_profile_section()` - Formats student profile (or "no data available")
      - `_build_ist_history_section()` - Formats up to 5 recent IST events with intent, skills summary
      - `_build_chat_history_section()` - Formats up to 10 recent chat messages with role indicators
    - Feeds formatted context into the LLM via DSPy's `Predict` module
    - Still returns the same structured output: `{ intent: str, skills: List[str], trajectory: List[str] }`
    - Reuses existing normalization logic for `skills` and `trajectory` (handles JSON strings, lists, comma-separated strings, etc.)
    - Gracefully degrades when context is empty (shows "(none available)" messages)

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

# Enable IST demo mode (fake user + fake chat history)
IST_DEMO_MODE=true
```

**Demo Mode Behavior**:
- When `IST_DEMO_MODE=true`:
  - If no `userId` is provided, the system uses `demo-user-1` / `cs-demo-101`
  - The chat history repository returns 3 canned messages
  - IST events are saved and retrieved for the demo identity
  - Subsequent questions in the same session will show growing `ist_history` (0, then 1, then 2, etc.)
- When `IST_DEMO_MODE` is unset or `false`:
  - Behavior is identical to pre-demo state (no identity injection)
  - Chat history returns empty array
  - IST events depend on real stored data only

**File locations**:
- Actual: `.env.local` at project root (git-ignored)

---

## 4. Data & Storage Details

### IstEvent Type Definition

```typescript
interface IstEvent {
  id: string;                    // Auto-generated (incremental: "1", "2", ...)
  createdAt: string;             // ISO timestamp (e.g., "2025-12-01T10:30:00.000Z")
  userId?: string | null;        // Now actively used: 'demo-user-1' in demo mode, real user IDs in production
  courseId?: string | null;      // Now actively used: 'cs-demo-101' in demo mode, real course IDs in production
  utterance: string;             // Original student question
  courseContext?: string | null; // Course material snippet (first 200 chars)
  intent: string;                // Extracted intent (e.g., "The student wants to understand recursion.")
  skills: string[];              // Array of skills (e.g., ["recursion", "base case"])
  trajectory: string[];          // Array of learning steps (e.g., ["review Module 1", "watch video"])
}
```

### Current Status

- **Storage**: JSON file at `src/mocks/ist/events.json`
- **Demo Mode**: When enabled, events are saved under `demo-user-1` / `cs-demo-101`, creating a persistent history
- **Querying**: `getRecentEvents` operates **per user + course**, returning up to 10 latest events sorted by `createdAt` (newest first)
- **Persistence**: Data persists across server restarts
- **Limitations**:
  - Single-server only (not suitable for multi-instance deployments)
  - Not thread-safe across multiple processes
  - In-memory array grows with all events (OK for dev, not production)
  - File system dependency (requires write access)

**Intended Use**: Local development and testing only. Production should use Firebase DataConnect + GraphQL (see Next Steps).

### Example Data Structure

After running demo mode with a few questions, `events.json` contains entries like:

```json
{
  "id": "5",
  "createdAt": "2025-12-01T10:30:00.000Z",
  "userId": "demo-user-1",
  "courseId": "cs-demo-101",
  "utterance": "I don't understand linked lists",
  "courseContext": "Title: Module 1: Arrays & Strings...",
  "intent": "The student wants to understand linked lists.",
  "skills": ["linked lists", "data structures", "pointers"],
  "trajectory": ["review Module 2", "watch linked list video", "practice problems"]
}
```

---

## 5. Context Enrichment and Demo Mode

### IstContext as the Central Object

The `IstContext` object aggregates all information the IST extractor needs to provide more accurate and personalized recommendations:

- **`currentUtterance`**: The student's current question
- **`courseContext`**: Course material snippet (first 200 characters)
- **`userId` / `courseId`**: User and course identifiers (injected by demo mode if needed)
- **`recentIstEvents`**: Up to 10 most recent IST events for this user/course, showing learning patterns
- **`recentChatMessages`**: Up to 10 most recent chat messages, showing conversation flow
- **`studentProfile`**: Currently `null`, reserved for future skill assessment logic

### How Context Enrichment Works

1. **Building the Context** (`getIstContextForIstExtraction`):
   - Receives `utterance`, `courseContext`, `userId`, `courseId`
   - Applies demo mode injection if `IST_DEMO_MODE=true` and no `userId` is provided
   - Loads `recentIstEvents` from `IstEventRepository.getRecentEvents()`
   - Loads `recentChatMessages` from `ChatHistoryRepository.getRecentMessages()`
   - Returns complete `IstContext` object

2. **Using the Context** (DSPy module):
   - Formats context sections into human-readable text:
     - Student profile section (or "no data available")
     - IST history showing previous intents, skills, trajectories
     - Chat history showing conversation flow with role indicators
   - Feeds formatted context into the LLM prompt alongside the current `utterance`
   - LLM generates IST extraction that:
     - Builds on previous trajectories (doesn't repeat identical steps)
     - Considers the conversation context
     - Provides more personalized recommendations based on learning history

### Demo Mode Test Results

We performed a test run with three consecutive questions in demo mode:

1. **First question** ("I don't understand linked lists"):
   - FastAPI logs: `chat_history size: 3`, `ist_history size: 0`
   - Created first IST event for `demo-user-1` / `cs-demo-101`
   - Result: Basic linked lists understanding intent

2. **Second question** ("How does Big-O relate to linked lists?"):
   - FastAPI logs: `chat_history size: 3`, `ist_history size: 1`
   - DSPy module saw the first question's IST history
   - Result: More sophisticated intent connecting Big-O and linked lists

3. **Third question** ("What should I practice next?"):
   - FastAPI logs: `chat_history size: 3`, `ist_history size: 2`
   - DSPy module saw both previous IST events
   - Result: Concrete practice steps combining linked lists + Big-O, building on previous trajectories

**Validation**: This confirms that context enrichment across multiple turns is working end-to-end. The DSPy module is receiving and using the accumulated IST history to provide increasingly personalized and context-aware recommendations.

---

## 6. Changes Since November 30, 2025

### Context Layer

- ✅ **Added `IstContext` model** (`src/lib/ist/types.ts`)
  - Aggregates current utterance, course context, recent IST events, chat messages, and student profile
- ✅ **Created `IstContextService`** (`src/lib/ist/istContextService.ts`)
  - Builds rich context objects for IST extraction
  - Implements demo mode identity injection
  - Loads recent IST events and chat messages from repositories

### Repositories

- ✅ **Extended `IstEventRepository` interface** with `getRecentEvents()`
  - Added `GetRecentIstEventsParams` type
  - Supports filtering by `userId` (required) and `courseId` (optional)
  - Supports limiting results (default 10)
- ✅ **Implemented `getRecentEvents` in `JsonIstEventRepository`**
  - Filters, sorts, and limits IST events
  - Returns newest events first
- ✅ **Created `ChatHistoryRepository` interface**
  - Defines `getRecentMessages()` method
  - Added `GetRecentChatMessagesParams` type
- ✅ **Implemented `InMemoryChatHistoryRepository`**
  - Stub implementation that returns empty array by default
  - Demo mode support: returns 3 canned chat messages when `IST_DEMO_MODE=true`
- ✅ **Updated `PostgresIstEventRepository` stub**
  - Added `getRecentEvents()` method that throws "not yet implemented"

### DSPy / FastAPI

- ✅ **Extended request/response models** (`dspy_service/app.py`)
  - Added `ChatMessage`, `IstHistoryItem`, `StudentProfile` Pydantic models
  - Extended `IntentSkillRequest` to include `chat_history`, `ist_history`, `student_profile`
  - Added logging for context sizes
- ✅ **Updated DSPy module** (`dspy_service/dspy_flows.py`)
  - Extended `IntentSkillTrajectorySignature` with context input fields
  - Updated `IntentSkillTrajectoryModule.forward()` to accept and format enriched context
  - Added helper methods: `_build_profile_section()`, `_build_ist_history_section()`, `_build_chat_history_section()`
  - Enhanced signature description to guide LLM to use all context fields
  - Maintains backward compatibility (graceful degradation when context is empty)

### Demo Mode

- ✅ **Introduced `IST_DEMO_MODE` environment variable**
  - Controls demo identity injection and canned chat history
- ✅ **Implemented demo identity injection**
  - When `IST_DEMO_MODE=true` and no `userId` is provided, injects `demo-user-1` / `cs-demo-101`
  - Demo IDs are used consistently for both context building and IST event storage
- ✅ **Added canned chat history** for demo mode
  - `InMemoryChatHistoryRepository` returns 3 realistic messages when demo mode is enabled
- ✅ **Verified working behavior**
  - Tested with multiple questions, observed IST history growth in logs
  - Confirmed `events.json` contains demo user events with progressive refinement

---

## 7. Next Steps and Long-Term Direction

### Short-Term (Next Coding Steps)

1. **Wire Real User Context**
   - Extract real `userId` from authentication layer (Firebase Auth) in `socratic-course-chat.ts`
   - Extract real `courseId` from route parameters
   - Pass these to `extractAndStoreIST()` instead of `undefined`

2. **Real Chat History Integration**
   - Replace `InMemoryChatHistoryRepository` with a real implementation
   - Options: Firestore collection, Postgres table, or (preferred) GraphQL/DataConnect
   - Store chat messages as they occur in the Socratic chat flow

3. **Student Profile Construction**
   - Create `StudentProfileService` that derives profile from IST history
   - Analyze `recentIstEvents` to infer:
     - Strong skills (frequently mentioned, high confidence)
     - Weak skills (repeated questions, failed trajectories)
     - Course progress (based on skill progression over time)
   - Store profile via repository abstraction (ready for DataConnect migration)

### Medium-Term (Data Layer Evolution – Aligned with Firebase DataConnect)

Based on architectural guidance, we plan to migrate from local JSON storage to **Firebase DataConnect + GraphQL** as the primary data layer:

1. **Firebase DataConnect Setup**
   - Define data models for IST events and chat history in DataConnect
   - Set up DataConnect connectors (Firestore, PostgreSQL, or other backends)
   - Configure GraphQL schema that exposes IST and chat data

2. **GraphQL Repository Implementations**
   - Implement `GraphqlIstEventRepository` that:
     - Uses GraphQL queries/mutations to interact with DataConnect
     - Satisfies the existing `IstEventRepository` interface
     - Handles pagination, filtering, and sorting via GraphQL
   - Implement `GraphqlChatHistoryRepository` that:
     - Uses GraphQL to fetch chat messages
     - Satisfies the existing `ChatHistoryRepository` interface
     - Supports real-time subscriptions for live chat history (optional)

3. **Migration Strategy**
   - Keep repository abstraction pattern (no changes to `extractIST.ts` or `istContextService.ts`)
   - Add factory logic in `repositories/index.ts` to select GraphQL implementation based on environment variable
   - Gradually migrate from JSON → GraphQL while maintaining backward compatibility
   - Export GraphQL schema so other services can consume the same data

4. **Benefits of This Approach**
   - **Unified Data Access**: GraphQL provides a single API for IST and chat data
   - **Type Safety**: GraphQL schema ensures type-safe queries across the stack
   - **Team Collaboration**: Other teams/services can consume IST data via GraphQL without direct DB access
   - **Scalability**: DataConnect handles connection pooling, caching, and optimization
   - **Flexibility**: Can swap backends (Firestore → Postgres → etc.) without changing GraphQL schema

### Long-Term (Product Features)

1. **Personalized Learning Recommendations**
   - Use IST history + StudentProfile to drive adaptive learning paths
   - Recommend next topics based on skill gaps and trajectory patterns
   - Suggest practice problems tailored to weak areas

2. **Instructor Analytics**
   - Build dashboards showing skill trends across cohorts
   - Identify common weak areas per course
   - Track trajectory effectiveness (which trajectories lead to skill mastery?)

3. **DSPy Service Boundaries**
   - Maintain DSPy microservice as LLM-only logic (no direct DB access)
   - All data access happens on Next.js side through repositories and GraphQL/DataConnect
   - DSPy receives pre-aggregated context via HTTP payload
   - This keeps the service stateless and easily scalable

---

## 8. Quick Recap for Another LLM

### What's Already Working

- ✅ **Complete IST extraction pipeline** from student question → enriched context → DSPy → storage
- ✅ **Context enrichment system** that loads IST history and chat history for personalized recommendations
- ✅ **Demo mode** (`IST_DEMO_MODE=true`) that simulates real users with fixed identities and canned chat history
- ✅ **JSON-based repository** storing events in `src/mocks/ist/events.json`
- ✅ **Repository abstraction** ready for GraphQL/DataConnect migration
- ✅ **DSPy service** running on port 8000 with enriched context support
- ✅ **Next.js integration** calling DSPy and storing events (non-blocking)
- ✅ **Progressive context accumulation** verified: subsequent questions show growing `ist_history` (0 → 1 → 2...)

### How to Run Everything

1. **Terminal 1**: `cd dspy_service && .\venv\Scripts\activate && python -m uvicorn app:app --reload --port 8000`
2. **Terminal 2**: `npm run dev` (from project root)
3. **Enable demo mode**: Add `IST_DEMO_MODE=true` to `.env.local` and restart Next.js
4. **Verify**: Check logs for `[IST][Context][DEMO] Using demo identity` and `[IST] Received chat_history size: 3`
5. **Test**: Ask multiple questions in Socratic chat, observe `ist_history` growth in FastAPI logs

### What the User Wants to Do Next

Based on the planned direction:
- Wire real `userId`/`courseId` from auth/route context (short-term)
- Migrate storage to Firebase DataConnect + GraphQL while preserving repository abstraction (medium-term)
- Build student profile service and analytics dashboards (long-term)

### Most Important Files to Open First

1. **`src/lib/ist/istContextService.ts`** - Context building and demo mode logic
2. **`src/lib/ist/extractIST.ts`** - Main IST extraction orchestrator
3. **`src/lib/ist/repositories/jsonIstEventRepository.ts`** - Current storage implementation
4. **`dspy_service/dspy_flows.py`** - DSPy module with context enrichment (line 220+ for formatting logic)
5. **`src/mocks/ist/events.json`** - View stored IST events (debugging)
6. **`src/lib/ist/repositories/index.ts`** - Repository factory (ready for GraphQL implementations)

### Key Architecture Points

- **DSPy service is separate microservice** - doesn't touch database, receives pre-aggregated context via HTTP
- **All DB logic is in Next.js** - repository abstraction in `src/lib/ist/repositories/`
- **IST extraction is non-blocking** - errors are logged but don't break chat flow
- **Context enrichment is automatic** - when `userId` is available (real or demo), history is loaded automatically
- **Demo mode enables testing** - fixed identity and canned chat history make it easy to test the full flow locally
- **Migration path is clear** - repository abstraction allows swapping JSON → GraphQL without changing calling code
- **Future direction**: Firebase DataConnect + GraphQL will provide unified, type-safe data access for IST and chat history

---

**Last Updated**: December 1, 2025  
**Status**: ✅ Working end-to-end with context enrichment and demo mode, ready for real auth integration and GraphQL/DataConnect migration

