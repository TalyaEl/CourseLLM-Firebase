# Database & Data Pipes Report
## CourseWise / IST Pipeline Project

**Generated:** 2025-12-06  
**Scope:** Complete mapping of data storage systems and data flow in the IST (Intent-Skill-Trajectory) pipeline

---

## 1. Overview

This project uses **three primary storage mechanisms** for the IST pipeline:

1. **Firestore (Firebase)** - Stores per-message `MessageAnalysis` documents in the path `threads/{threadId}/analysis/{messageId}`. This is the primary storage for analysis results that are displayed in the UI.

2. **JSON File Storage** - Stores IST events (raw intent/skill/trajectory extractions) in `src/mocks/ist/events.json`. This is used for:
   - Historical context enrichment when calling the DSPy service
   - Development/testing purposes
   - Non-blocking IST event logging

3. **In-Memory Storage** - Used for temporary caching of `MessageAnalysis` objects in the Next.js app (via `InMemoryIstAnalysisRepository`).

**PostgreSQL/Supabase** is stubbed but not yet implemented - the `PostgresIstEventRepository` class exists but throws errors when used.

The architecture follows a **repository pattern** with clear abstractions, making it straightforward to swap storage backends (e.g., from JSON to Postgres, or to a new Firebase Data Connect layer).

---

## 2. Storage Mechanisms

### 2.1 Firestore / Firebase

#### Configuration Files
- **Client SDK:** `src/firebase.ts`
- **Admin SDK:** `functions/src/firebaseAdmin.ts`
- **Firebase Config:** `firebase.json`

#### Client SDK Initialization (`src/firebase.ts`)
The Firebase client SDK is initialized with configuration from environment variables:
- `NEXT_PUBLIC_FIREBASE_API_KEY` (or `REACT_APP_FIREBASE_API_KEY`)
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` (or `REACT_APP_FIREBASE_AUTH_DOMAIN`)
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (or `REACT_APP_FIREBASE_PROJECT_ID`)
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (or `REACT_APP_FIREBASE_STORAGE_BUCKET`)
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` (or `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`)
- `NEXT_PUBLIC_FIREBASE_APP_ID` (or `REACT_APP_FIREBASE_APP_ID`)

Emulator connection is controlled by:
- `NEXT_PUBLIC_FIREBASE_USE_EMULATOR` (set to `'true'` to enable)
- `FIRESTORE_EMULATOR_HOST` (default: `localhost`)
- `FIRESTORE_EMULATOR_PORT` (default: `8080`)
- `FIREBASE_FUNCTIONS_EMULATOR_HOST` (default: `localhost`)
- `FIREBASE_FUNCTIONS_EMULATOR_PORT` (default: `5001`)

#### Admin SDK Initialization (`functions/src/firebaseAdmin.ts`)
The Firebase Admin SDK is initialized automatically (uses default credentials or service account). It detects the Firestore emulator via `FIRESTORE_EMULATOR_HOST` environment variable.

#### Firestore Collections

**Collection Path:** `threads/{threadId}/analysis/{messageId}`

**Document Schema:** `MessageAnalysis` (defined in `functions/src/types/messageAnalysis.ts`)

```typescript
{
  intent: {
    labels: IntentLabel[];      // all intent labels that apply
    primary: IntentLabel;       // the main/primary intent
    confidence: number;         // 0–1
  };
  skills: {
    items: {
      id: string;               // stable skill/topic id
      displayName?: string;     // human-readable label
      confidence: number;       // 0–1
      role?: "FOCUS" | "SECONDARY" | "PREREQUISITE";
    }[];
  };
  trajectory: {
    currentNodes: string[];     // current node ids in learning trajectory
    suggestedNextNodes: {
      id: string;               // suggested next node id
      reason?: string;          // explanation for suggestion
      priority?: number;        // 1 = highest priority
    }[];
    status: "ON_TRACK" | "STRUGGLING" | "TOO_ADVANCED" | "REVIEW_NEEDED" | "NEW_TOPIC" | "UNKNOWN";
  };
  metadata: {
    processedAt: string;        // ISO timestamp
    modelVersion: string;       // e.g. "ist-v1-dspy"
    threadId: string;
    messageId?: string | null;
    uid: string;                // user id (from auth)
  };
}
```

**Write Operations:**
- **Location:** `functions/src/analyzeMessage.ts` (Cloud Function)
- **Method:** `ref.set(analysis, { merge: true })` at line 220
- **Trigger:** After DSPy service returns IST data and it's mapped to `MessageAnalysis` format

**Read Operations:**
- Currently, there are no explicit read operations in the codebase for Firestore analysis documents. The UI likely reads these directly using Firestore client SDK, but this is not visible in the repository pattern.

---

### 2.2 JSON-based IST Event Log

#### File Location
- **Path:** `src/mocks/ist/events.json`
- **Repository Implementation:** `src/lib/ist/repositories/jsonIstEventRepository.ts`
- **Repository Factory:** `src/lib/ist/repositories/index.ts`

#### JSON Schema
Each event in the JSON array follows the `IstEvent` interface (defined in `src/lib/ist/types.ts`):

```typescript
{
  id: string;                    // Unique identifier (auto-generated)
  createdAt: string;             // ISO timestamp
  userId?: string | null;        // Optional user ID
  courseId?: string | null;      // Optional course ID
  utterance: string;            // Original student utterance
  courseContext?: string | null; // Optional course context
  intent: string;                // Extracted intent (string)
  skills: string[];             // Array of skills/concepts
  trajectory: string[];         // Array of suggested learning steps
}
```

#### Write Operations
- **Function:** `extractAndStoreIST()` in `src/lib/ist/extractIST.ts` (line 100-111)
- **Repository Method:** `JsonIstEventRepository.save()` in `src/lib/ist/repositories/jsonIstEventRepository.ts`
- **Flow:**
  1. `extractAndStoreIST()` calls DSPy service directly
  2. Receives IST result (intent, skills, trajectory)
  3. Calls `getIstEventRepository().save()` with the IST data
  4. `JsonIstEventRepository` appends to in-memory array and persists to JSON file

#### Read Operations
- **Function:** `loadIstContextFromJson()` in `functions/src/istContextFromJson.ts`
- **Used By:** `functions/src/analyzeMessage.ts` (line 147) when running in emulator mode
- **Purpose:** Enriches DSPy requests with historical IST context (up to 5 recent events)
- **Also Used By:** `src/lib/ist/istContextService.ts` (line 78) via `getIstEventRepository().getRecentEvents()`

The JSON file is read in two contexts:
1. **Cloud Functions (emulator mode):** `loadIstContextFromJson()` reads the file directly from disk to enrich DSPy requests
2. **Next.js app:** `JsonIstEventRepository.getRecentEvents()` reads from the in-memory cache (which is loaded from disk on first access)

---

### 2.3 Postgres / Other DB Stubs

#### PostgreSQL Stub
- **File:** `src/lib/ist/repositories/postgresIstEventRepository.ts`
- **Status:** **Not implemented** - all methods throw errors
- **Interface:** Implements `IstEventRepository` interface
- **Future Plans:** 
  - Will use `@/lib/db/pgClient` (not yet created)
  - Will store events in `intent_skill_trajectory_events` table
  - Will map `IstEvent` to/from PostgreSQL jsonb columns

#### Schema Definition
- **File:** `src/lib/ist/schema.sql`
- **Status:** SQL schema exists but is not applied to any database

#### Activation
- **Environment Variable:** `IST_STORAGE_MODE=postgres` (default is `'json'`)
- **Factory:** `src/lib/ist/repositories/index.ts` (line 30-48)
- **Current Behavior:** If `IST_STORAGE_MODE=postgres` is set, the factory will instantiate `PostgresIstEventRepository`, but all operations will fail with "not yet implemented" errors

---

### 2.4 In-Memory Storage

#### MessageAnalysis Repository
- **File:** `src/lib/ist/repository.ts`
- **Class:** `InMemoryIstAnalysisRepository`
- **Interface:** `IstAnalysisRepository`
- **Storage:** In-memory `Map<AnalysisKey, MessageAnalysis>` where `AnalysisKey = `${threadId}::${messageId}``
- **Methods:**
  - `save(analysis: MessageAnalysis): Promise<void>`
  - `get(threadId: string, messageId: string): Promise<MessageAnalysis | null>`
  - `listByThread(threadId: string): Promise<MessageAnalysis[]>`

**Usage:**
- Used by `src/lib/ist/chatIst.ts` via `getIstAnalysisRepository()`
- This is a **temporary cache** - data is lost on server restart
- **Note:** The Cloud Function writes directly to Firestore, bypassing this in-memory repository

#### Chat History Repository
- **File:** `src/lib/ist/repositories/inMemoryChatHistoryRepository.ts`
- **Class:** `InMemoryChatHistoryRepository`
- **Interface:** `ChatHistoryRepository`
- **Storage:** In-memory array (currently unused)
- **Demo Mode:** Returns canned chat history when `IST_DEMO_MODE=true`
- **Methods:**
  - `getRecentMessages(params: GetRecentChatMessagesParams): Promise<ChatMessage[]>`

**Usage:**
- Used by `src/lib/ist/istContextService.ts` to enrich IST context with chat history
- Currently returns empty array (or demo data) - no real chat messages are stored

---

## 3. IST Data Flow (Step-by-Step)

### Path 1: Cloud Function Flow (Primary Production Path)

1. **Student sends message in UI**
   - Frontend component (e.g., `SocraticChat.tsx`) captures user input

2. **Frontend calls Cloud Function**
   - Uses `CallableIstAnalysisEngine` (from `src/lib/ist/engineCallable.ts`)
   - Calls `analyzeMessage` Cloud Function via `httpsCallable(functions, 'analyzeMessage')`
   - Request type: `AnalyzeMessageRequest` (defined in `functions/src/types/analyzeMessage.ts`)

3. **Cloud Function receives request**
   - Entry point: `functions/src/analyzeMessage.ts` (exported from `functions/src/index.ts`)
   - Validates authentication (uses `demo-user` in emulator mode)
   - Extracts `threadId`, `messageText`, `messageId`, `courseId` from request

4. **Cloud Function loads IST context (emulator only)**
   - If `FUNCTIONS_EMULATOR=true`, calls `loadIstContextFromJson()` (line 147)
   - Reads `src/mocks/ist/events.json` from disk
   - Filters by `userId` and `courseId`
   - Returns up to 5 recent IST events as `istHistory` array
   - **Note:** `chatHistory` is empty (JSON file doesn't store separate chat messages)

5. **Cloud Function calls DSPy service**
   - Function: `callDspyService()` (line 19-65)
   - URL: `${DSPY_SERVICE_URL}/api/intent-skill-trajectory` (default: `http://127.0.0.1:8000`)
   - Payload:
     ```json
     {
       "utterance": "student message text",
       "course_context": "Course: {courseId}",
       "chat_history": [],
       "ist_history": [...],  // from JSON file in emulator
       "student_profile": null
     }
     ```

6. **DSPy service returns IST data**
   - Response type: `DSPyISTResponse` (intent: string, skills: string[], trajectory: string[])

7. **Cloud Function maps to MessageAnalysis**
   - Function: `mapDspyToMessageAnalysis()` (line 70-134)
   - Maps intent string to `IntentLabel` enum (heuristic-based)
   - Maps skills array to `MessageAnalysis.skills.items` format
   - Maps trajectory array to `MessageAnalysis.trajectory.suggestedNextNodes` format
   - Adds metadata (processedAt, modelVersion, threadId, messageId, uid)

8. **Cloud Function writes to Firestore**
   - **Location:** `functions/src/analyzeMessage.ts` (line 213-221)
   - **Path:** `threads/{threadId}/analysis/{messageId}`
   - **Method:** `ref.set(analysis, { merge: true })`
   - **Data:** Complete `MessageAnalysis` object

9. **Cloud Function returns MessageAnalysis**
   - Returns to frontend via callable function response

10. **Frontend receives and displays analysis**
    - `CallableIstAnalysisEngine` receives `MessageAnalysis`
    - UI can display intent, skills, trajectory suggestions

### Path 2: Next.js API Route Flow (Alternative Path)

1. **Student sends message in UI**
   - Same as Path 1

2. **Frontend calls Next.js API route**
   - Uses `ApiIstAnalysisEngine` (from `src/lib/ist/engine.ts`)
   - Calls `/api/analyze-message` (Next.js API route)

3. **API route processes request**
   - Entry point: `src/app/api/analyze-message/route.ts`
   - Validates `threadId` and `messageText`
   - Calls `analyzeMessage()` from `src/ai/flows/analyze-message.ts`

4. **Genkit flow processes message**
   - Uses Genkit AI framework (not detailed in this report)
   - **Note:** This path does NOT write to Firestore or JSON - it only returns analysis

5. **API route returns analysis**
   - Returns `MessageAnalysis` to frontend

**Engine Selection:**
- Controlled by `NEXT_PUBLIC_IST_ENGINE_MODE` environment variable
- `'callable'` → uses Cloud Function (Path 1)
- `'api'` (default) → uses Next.js API route (Path 2)

### Path 3: IST Event Extraction (Background, Non-Blocking)

This path runs **in parallel** to the main analysis flow and stores raw IST events to JSON:

1. **Student sends message**
   - Same as Path 1

2. **AI flow triggers IST extraction**
   - Functions like `socraticCourseChat()` (in `src/ai/flows/socratic-course-chat.ts`) call `extractAndStoreIST()` (line 28)
   - This is **non-blocking** - wrapped in `.catch()` to prevent failures from affecting main flow

3. **extractAndStoreIST() builds context**
   - Function: `src/lib/ist/extractIST.ts` (line 30-122)
   - Calls `getIstContextForIstExtraction()` (from `src/lib/ist/istContextService.ts`)
   - Loads recent IST events from JSON repository (via `getIstEventRepository().getRecentEvents()`)
   - Loads recent chat messages from chat repository (currently returns empty/demo data)

4. **extractAndStoreIST() calls DSPy service**
   - Direct HTTP call to `${DSPY_SERVICE_URL}/api/intent-skill-trajectory`
   - Payload includes enriched context (chat_history, ist_history, student_profile)

5. **extractAndStoreIST() stores IST event**
   - Calls `getIstEventRepository().save()` (line 101)
   - Repository writes to `src/mocks/ist/events.json` (if `IST_STORAGE_MODE=json`)
   - **Storage is best-effort** - failures are logged but don't throw errors

6. **IST event is available for future context**
   - Next IST extraction will include this event in `ist_history` array
   - Cloud Function (in emulator) will also read this event when enriching requests

---

## 4. Abstractions & Extension Points

The codebase uses a **repository pattern** with clear interfaces, making it easy to add new storage backends (e.g., Firebase Data Connect, MongoDB, etc.).

### 4.1 IstEventRepository Interface

**File:** `src/lib/ist/repositories/istEventRepository.ts`

**Interface Methods:**
- `save(event: CreateIstEventInput): Promise<IstEvent>`
- `findById(id: string): Promise<IstEvent | null>`
- `findByUserAndCourse(userId: string, courseId: string): Promise<IstEvent[]>`
- `findByUser(userId: string): Promise<IstEvent[]>`
- `findByCourse(courseId: string): Promise<IstEvent[]>`
- `getRecentEvents(params: GetRecentIstEventsParams): Promise<IstEvent[]>`

**Current Implementations:**
1. **JsonIstEventRepository** (`src/lib/ist/repositories/jsonIstEventRepository.ts`)
   - Active implementation
   - Stores to `src/mocks/ist/events.json`

2. **PostgresIstEventRepository** (`src/lib/ist/repositories/postgresIstEventRepository.ts`)
   - Stub implementation (throws errors)
   - Future: will use PostgreSQL/Supabase

**Factory:** `src/lib/ist/repositories/index.ts` - `getIstEventRepository()`
- Selects implementation based on `IST_STORAGE_MODE` environment variable

**Usage Points:**
- `src/lib/ist/extractIST.ts` (line 101) - stores IST events after extraction
- `src/lib/ist/istContextService.ts` (line 78) - loads recent IST events for context
- `functions/src/istContextFromJson.ts` - reads JSON file directly (bypasses repository in Cloud Functions)

**Why it's a good extension point:**
- Clear interface with well-defined methods
- Factory pattern allows easy swapping of implementations
- All calling code depends on the interface, not concrete implementations

---

### 4.2 ChatHistoryRepository Interface

**File:** `src/lib/ist/repositories/chatHistoryRepository.ts`

**Interface Methods:**
- `getRecentMessages(params: GetRecentChatMessagesParams): Promise<ChatMessage[]>`

**Current Implementations:**
1. **InMemoryChatHistoryRepository** (`src/lib/ist/repositories/inMemoryChatHistoryRepository.ts`)
   - Returns empty array (or demo data if `IST_DEMO_MODE=true`)
   - No persistent storage

**Factory:** `src/lib/ist/repositories/index.ts` - `getChatHistoryRepository()`
- Currently only returns `InMemoryChatHistoryRepository` (no env var switching yet)

**Usage Points:**
- `src/lib/ist/istContextService.ts` (line 92) - loads recent chat messages for context

**Why it's a good extension point:**
- Interface is ready for Firestore/Postgres implementations
- Could store chat messages in Firestore collection like `threads/{threadId}/messages/{messageId}`
- Or in a separate `chat_messages` table in Postgres

---

### 4.3 IstAnalysisRepository Interface

**File:** `src/lib/ist/repository.ts`

**Interface Methods:**
- `save(analysis: MessageAnalysis): Promise<void>`
- `get(threadId: string, messageId: string): Promise<MessageAnalysis | null>`
- `listByThread(threadId: string): Promise<MessageAnalysis[]>`

**Current Implementations:**
1. **InMemoryIstAnalysisRepository** (`src/lib/ist/repository.ts`)
   - In-memory Map storage
   - Data lost on server restart

**Factory:** `src/lib/ist/repository.ts` - `getIstAnalysisRepository()`
- Currently only returns `InMemoryIstAnalysisRepository` (no env var switching)

**Usage Points:**
- `src/lib/ist/chatIst.ts` (line 29) - stores analysis after calling engine

**Why it's a good extension point:**
- Could be replaced with Firestore-backed implementation
- **Note:** Cloud Function already writes directly to Firestore, so this repository is only used in Next.js app context
- Could be unified with Firestore writes for consistency

---

### 4.4 IstAnalysisEngine Interface

**File:** `src/lib/ist/engine.ts`

**Interface Methods:**
- `analyzeMessage(req: AnalyzeMessageRequest): Promise<MessageAnalysis>`

**Current Implementations:**
1. **CallableIstAnalysisEngine** (`src/lib/ist/engineCallable.ts`)
   - Calls Cloud Function `analyzeMessage`
   - Writes to Firestore (via Cloud Function)

2. **ApiIstAnalysisEngine** (`src/lib/ist/engine.ts`)
   - Calls Next.js API route `/api/analyze-message`
   - Does NOT write to Firestore (only returns analysis)

**Factory:** `src/lib/ist/engine.ts` - `getIstAnalysisEngine()`
- Selects based on `NEXT_PUBLIC_IST_ENGINE_MODE` environment variable

**Why it's a good extension point:**
- Could add new implementations (e.g., direct DSPy client, mock engine for testing)
- Engine selection is centralized and environment-driven

---

## 5. Config Summary

### Environment Variables

| Variable | Purpose | Default | Used By |
|----------|---------|---------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key | `'demo-api-key'` | `src/firebase.ts` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | `'demo.firebaseapp.com'` | `src/firebase.ts` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | `'demo-no-project'` | `src/firebase.ts` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | `'demo.appspot.com'` | `src/firebase.ts` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | `'1234567890'` | `src/firebase.ts` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | `'demo-app-id'` | `src/firebase.ts` |
| `NEXT_PUBLIC_FIREBASE_USE_EMULATOR` | Enable Firebase emulator connection | `undefined` (disabled) | `src/firebase.ts` |
| `FIRESTORE_EMULATOR_HOST` | Firestore emulator host | `'localhost'` | `src/firebase.ts`, `functions/src/firebaseAdmin.ts` |
| `FIRESTORE_EMULATOR_PORT` | Firestore emulator port | `8080` | `src/firebase.ts` |
| `FIREBASE_FUNCTIONS_EMULATOR_HOST` | Functions emulator host | `'localhost'` | `src/firebase.ts` |
| `FIREBASE_FUNCTIONS_EMULATOR_PORT` | Functions emulator port | `5001` | `src/firebase.ts` |
| `FUNCTIONS_EMULATOR` | Enable Functions emulator mode | `undefined` (disabled) | `functions/src/analyzeMessage.ts` |
| `DSPY_SERVICE_URL` | DSPy microservice base URL | `'http://127.0.0.1:8000'` | `functions/src/analyzeMessage.ts`, `src/lib/ist/extractIST.ts` |
| `IST_STORAGE_MODE` | IST event storage backend | `'json'` | `src/lib/ist/repositories/index.ts` |
| `IST_DEMO_MODE` | Enable demo mode (fake userId/courseId) | `undefined` (disabled) | `src/lib/ist/istContextService.ts`, `src/lib/ist/repositories/inMemoryChatHistoryRepository.ts` |
| `NEXT_PUBLIC_IST_ENGINE_MODE` | IST analysis engine selection | `'api'` | `src/lib/ist/engine.ts` |

### Firebase Configuration

**File:** `firebase.json`
```json
{
  "functions": {
    "source": "functions"
  },
  "emulators": {
    "functions": {
      "port": 5001
    },
    "firestore": {
      "port": 8080
    }
  }
}
```

---

## 6. Notes / Open Questions

### 6.1 Incomplete Implementations

1. **PostgresIstEventRepository** (`src/lib/ist/repositories/postgresIstEventRepository.ts`)
   - All methods throw "not yet implemented" errors
   - SQL schema exists in `src/lib/ist/schema.sql` but is not applied
   - `@/lib/db/pgClient` module does not exist yet

2. **ChatHistoryRepository** (`src/lib/ist/repositories/inMemoryChatHistoryRepository.ts`)
   - Returns empty array (or demo data)
   - No persistent storage for chat messages
   - Chat messages are not stored anywhere in the current architecture

3. **IstAnalysisRepository** (`src/lib/ist/repository.ts`)
   - Only in-memory implementation exists
   - Cloud Function writes directly to Firestore, bypassing this repository
   - Could be unified with Firestore writes for consistency

### 6.2 Data Flow Gaps

1. **IST Events Not Written from Cloud Function**
   - The Cloud Function (`analyzeMessage`) writes `MessageAnalysis` to Firestore but does NOT write IST events to JSON
   - IST events are only written via `extractAndStoreIST()` in Next.js flows
   - This means IST events may be missing if only the Cloud Function path is used

2. **Chat History Not Stored**
   - Chat messages are not persisted anywhere
   - `ChatHistoryRepository` returns empty arrays
   - This limits the ability to enrich DSPy requests with real chat context

3. **Dual Storage Paths**
   - `MessageAnalysis` is stored in Firestore (via Cloud Function)
   - IST events are stored in JSON (via `extractAndStoreIST()`)
   - These are separate data structures - no automatic sync between them

### 6.3 Architecture Observations

1. **Repository Pattern is Well-Designed**
   - Clear interfaces make it easy to swap implementations
   - Factory pattern allows environment-driven selection
   - Good extension points for new storage backends

2. **Emulator vs Production Behavior**
   - Cloud Function reads JSON file directly in emulator mode (bypasses repository)
   - This is a special case - production would need a different approach
   - Consider using the repository abstraction in Cloud Functions too

3. **Non-Blocking IST Extraction**
   - `extractAndStoreIST()` is called asynchronously and errors are caught
   - This is good for resilience but means IST events may be silently lost if storage fails

### 6.4 Potential Improvements

1. **Unify Storage Paths**
   - Consider writing IST events from Cloud Function as well
   - Or have Cloud Function trigger a separate function to extract and store IST events

2. **Add Chat Message Storage**
   - Implement Firestore-backed `ChatHistoryRepository`
   - Store messages in `threads/{threadId}/messages/{messageId}`

3. **Complete Postgres Implementation**
   - Implement `PostgresIstEventRepository`
   - Create `@/lib/db/pgClient` module
   - Apply SQL schema to database

4. **Add Firestore-Backed IstAnalysisRepository**
   - Replace in-memory implementation with Firestore reads
   - Unify with Cloud Function writes

---

## Appendix: Key File Reference

### Storage Configuration
- `src/firebase.ts` - Firebase client SDK initialization
- `functions/src/firebaseAdmin.ts` - Firebase Admin SDK initialization
- `firebase.json` - Firebase emulator configuration

### Repository Interfaces
- `src/lib/ist/repositories/istEventRepository.ts` - IST event repository interface
- `src/lib/ist/repositories/chatHistoryRepository.ts` - Chat history repository interface
- `src/lib/ist/repository.ts` - MessageAnalysis repository interface

### Repository Implementations
- `src/lib/ist/repositories/jsonIstEventRepository.ts` - JSON-based IST event storage
- `src/lib/ist/repositories/postgresIstEventRepository.ts` - Postgres stub (not implemented)
- `src/lib/ist/repositories/inMemoryChatHistoryRepository.ts` - In-memory chat history
- `src/lib/ist/repository.ts` - In-memory MessageAnalysis storage

### Repository Factory
- `src/lib/ist/repositories/index.ts` - Factory for selecting repository implementations

### Data Flow
- `functions/src/analyzeMessage.ts` - Cloud Function that analyzes messages and writes to Firestore
- `src/lib/ist/extractIST.ts` - Extracts IST events and stores to JSON
- `src/lib/ist/istContextService.ts` - Builds IST context from repositories
- `functions/src/istContextFromJson.ts` - Loads IST context from JSON (emulator only)

### Type Definitions
- `functions/src/types/messageAnalysis.ts` - MessageAnalysis type (Firestore document)
- `functions/src/types/analyzeMessage.ts` - AnalyzeMessageRequest type
- `src/lib/ist/types.ts` - IstEvent, ChatMessage, IstContext types

### Engine Abstractions
- `src/lib/ist/engine.ts` - IstAnalysisEngine interface and factory
- `src/lib/ist/engineCallable.ts` - Cloud Function engine implementation
- `src/lib/ist/chatIst.ts` - Helper that uses engine and repository

---

**End of Report**

