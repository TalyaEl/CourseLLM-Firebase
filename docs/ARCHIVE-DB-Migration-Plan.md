# IST DB Migration Plan – From JSON/Firestore to DataConnect/GraphQL

**Project:** CourseWise / IST Pipeline  
**Date:** 2025-12-06  
**Objective:** Incremental migration from JSON files and direct Firestore writes to Firebase Data Connect (PostgreSQL + GraphQL) while preserving the existing repository pattern architecture.

---

## 1. Target Architecture (Conceptual)

### 1.1 Overview

The target architecture maintains the existing **repository pattern** as the primary abstraction layer, with Firebase Data Connect serving as the underlying database accessed through GraphQL queries and mutations. This design:

- **Preserves** the clean separation between business logic and data storage
- **Enables** type-safe data access through generated GraphQL SDKs
- **Supports** incremental migration without breaking existing functionality
- **Provides** a relational database foundation (PostgreSQL) for complex queries and relationships

### 1.2 Database Schema Design

Firebase Data Connect uses **Cloud SQL for PostgreSQL** with GraphQL schema definitions. Based on the current data structures identified in the Database & Data Pipes Report, we propose the following tables:

#### Table: `ist_events`

Stores raw IST (Intent-Skill-Trajectory) extraction events from student utterances.

```graphql
type IstEvent @table {
  id: UUID! @default(expr: "uuid_generate_v4()")
  created_at: Timestamp! @default(expr: "NOW()")
  user_id: String
  course_id: String
  utterance: String!
  course_context: String
  intent: String!
  skills: JSONB!  # Array of strings stored as JSONB
  trajectory: JSONB!  # Array of strings stored as JSONB
}
```

**Key Fields:**
- `id`: Primary key (UUID, auto-generated)
- `created_at`: Timestamp for sorting/filtering
- `user_id`: Foreign key to users (nullable for anonymous events)
- `course_id`: Foreign key to courses (nullable)
- `utterance`: Original student message text
- `intent`: Extracted intent as string
- `skills`: Array of skill strings (stored as JSONB for flexibility)
- `trajectory`: Array of trajectory step strings (stored as JSONB)

**Indexes:**
- `idx_ist_events_user_id_created_at` on `(user_id, created_at DESC)` for efficient recent event queries
- `idx_ist_events_course_id_created_at` on `(course_id, created_at DESC)` for course-specific queries

---

#### Table: `message_analyses`

Stores structured `MessageAnalysis` objects (the enriched analysis results written to Firestore today).

```graphql
type MessageAnalysis @table {
  id: UUID! @default(expr: "uuid_generate_v4()")
  thread_id: String!
  message_id: String!
  user_id: String!
  processed_at: Timestamp! @default(expr: "NOW()")
  model_version: String!
  
  # Intent data (stored as JSONB for flexibility)
  intent_labels: JSONB!  # Array of IntentLabel strings
  primary_intent: String!
  intent_confidence: Float!
  
  # Skills data (stored as JSONB)
  skills_items: JSONB!  # Array of {id, displayName, confidence, role}
  
  # Trajectory data (stored as JSONB)
  current_nodes: JSONB!  # Array of node IDs
  suggested_next_nodes: JSONB!  # Array of {id, reason, priority}
  trajectory_status: String!  # ON_TRACK, STRUGGLING, etc.
}
```

**Key Fields:**
- `id`: Primary key (UUID)
- `thread_id`, `message_id`: Composite key equivalent to Firestore path `threads/{threadId}/analysis/{messageId}`
- `user_id`: Foreign key to users
- `intent_labels`, `primary_intent`, `intent_confidence`: Intent analysis results
- `skills_items`: Array of skill objects (JSONB for nested structure)
- `current_nodes`, `suggested_next_nodes`, `trajectory_status`: Trajectory analysis

**Indexes:**
- `idx_message_analyses_thread_message` on `(thread_id, message_id)` for direct lookups
- `idx_message_analyses_user_processed` on `(user_id, processed_at DESC)` for user history
- `idx_message_analyses_thread_processed` on `(thread_id, processed_at DESC)` for thread history

**Note:** We store complex nested structures (skills, trajectory) as JSONB rather than normalized tables for simplicity. This can be normalized later if needed.

---

#### Table: `chat_messages`

Stores individual chat messages in conversations (currently not persisted).

```graphql
type ChatMessage @table {
  id: UUID! @default(expr: "uuid_generate_v4()")
  thread_id: String!
  user_id: String!
  course_id: String
  role: String!  # 'student', 'tutor', 'system'
  content: String!
  created_at: Timestamp! @default(expr: "NOW()")
}
```

**Key Fields:**
- `id`: Primary key (UUID)
- `thread_id`: Links messages to conversation threads
- `user_id`: Message author
- `role`: Message role (student/tutor/system)
- `content`: Message text
- `created_at`: Timestamp for chronological ordering

**Indexes:**
- `idx_chat_messages_thread_created` on `(thread_id, created_at ASC)` for thread history
- `idx_chat_messages_user_course_created` on `(user_id, course_id, created_at DESC)` for user/course history

---

#### Table: `students` (Optional, for future expansion)

Stores student profile information for personalized learning.

```graphql
type Student @table {
  id: UUID! @default(expr: "uuid_generate_v4()")
  firebase_uid: String! @unique  # Links to Firebase Auth
  email: String
  name: String
  created_at: Timestamp! @default(expr: "NOW()")
  updated_at: Timestamp! @default(expr: "NOW()")
}
```

**Note:** This table is **optional and not required** for Phases 0-3. It provides a foundation for future student profile features once Firebase Auth is fully integrated. For the initial migration, we can work with just `user_id: String` columns populated with simple identifiers like `"demo-user"` in emulator mode.

---

### 1.5 Authentication & Authorization Assumptions (Current State)

**Important:** This migration plan is designed to work with the **current auth reality** of the project, which does not yet have a fully developed Firebase Auth integration.

#### Current Auth Reality

- **No rich Firebase Auth integration yet** - The project primarily works in emulator mode
- **Fallback to "demo-user"** - Cloud Functions often use `request.auth?.uid ?? "demo-user"` pattern
- **Backend-only access** - All DataConnect usage in Phases 0-3 will be from backend code only:
  - Cloud Functions (e.g., `analyzeMessage`)
  - Next.js server-side (API routes, server components)
  - **NOT from browser/client-side code** - Frontend does not talk directly to DataConnect yet
- **Simple user_id strings** - `user_id` fields are just strings (e.g., `"demo-user"`, `"demo-user-1"`), not fully trusted/verified Firebase Auth UIDs
- **No row-level security yet** - Complex per-user authorization and row-level security are **future work**, not part of Phases 0-3

#### DataConnect / GraphQL Auth Strategy

For Phases 0-3, we use a **simple, backend-only auth model**:

- **Backend service identity** - DataConnect queries/mutations are authenticated using the project's service account or backend credentials
- **No client-side GraphQL** - The GraphQL API is not exposed directly to browsers
- **Simple @auth directives** - GraphQL schemas use minimal auth (e.g., `@auth(level: ADMIN)` or service account level) rather than per-user authorization
- **Future tightening** - Once Firebase Auth is fully integrated, we can add:
  - Row-level security rules
  - Per-user authorization checks
  - `@auth(level: USER)` directives that verify Firebase Auth tokens
  - Client-side DataConnect SDK usage with proper auth

#### Why Backend-Only for Now?

- **Simplifies auth** - No need to handle Firebase Auth tokens in GraphQL layer yet
- **Avoids exposing GraphQL directly** - Keeps DataConnect API internal to backend services
- **Matches current architecture** - Aligns with how the project currently works (backend calls, emulator mode)
- **Easy to extend later** - Once Firebase Auth is integrated, we can add client-side access and row-level security without changing the data model

#### Migration Path for Auth

1. **Phases 0-3:** Backend-only, simple service account auth, `user_id` as plain strings
2. **Future (Post-Phase 4):** Integrate Firebase Auth, add row-level security, enable client-side DataConnect SDK

---

### 1.3 GraphQL Schema Structure

The GraphQL schema will define queries and mutations for each repository interface:

#### Queries

```graphql
# IST Events
# NOTE: @auth directive uses ADMIN/SERVICE level for backend-only access in Phases 0-3
# Future: Can be tightened to @auth(level: USER) with Firebase Auth integration
query GetRecentIstEvents(
  $userId: String!
  $courseId: String
  $limit: Int = 10
) @auth(level: ADMIN) {
  istEvents(
    userId: $userId
    courseId: $courseId
    limit: $limit
    orderBy: created_at_DESC
  ) {
    id
    created_at
    user_id
    course_id
    utterance
    course_context
    intent
    skills
    trajectory
  }
}

query GetIstEventById($id: UUID!) @auth(level: ADMIN) {
  istEvent(id: $id) {
    id
    created_at
    user_id
    course_id
    utterance
    course_context
    intent
    skills
    trajectory
  }
}

# Message Analyses
query GetMessageAnalysis(
  $threadId: String!
  $messageId: String!
) @auth(level: ADMIN) {
  messageAnalysis(threadId: $threadId, messageId: $messageId) {
    id
    thread_id
    message_id
    user_id
    processed_at
    model_version
    intent_labels
    primary_intent
    intent_confidence
    skills_items
    current_nodes
    suggested_next_nodes
    trajectory_status
  }
}

query ListMessageAnalysesByThread(
  $threadId: String!
  $limit: Int = 50
) @auth(level: ADMIN) {
  messageAnalyses(threadId: $threadId, limit: $limit, orderBy: processed_at_DESC) {
    id
    message_id
    processed_at
    primary_intent
    trajectory_status
  }
}

# Chat Messages
query GetRecentChatMessages(
  $userId: String!
  $courseId: String
  $limit: Int = 10
) @auth(level: ADMIN) {
  chatMessages(userId: $userId, courseId: $courseId, limit: $limit, orderBy: created_at_DESC) {
    id
    thread_id
    user_id
    course_id
    role
    content
    created_at
  }
}
```

#### Mutations

```graphql
# IST Events
mutation CreateIstEvent(
  $userId: String
  $courseId: String
  $utterance: String!
  $courseContext: String
  $intent: String!
  $skills: JSONB!
  $trajectory: JSONB!
) @auth(level: ADMIN) {
  createIstEvent(
    userId: $userId
    courseId: $courseId
    utterance: $utterance
    courseContext: $courseContext
    intent: $intent
    skills: $skills
    trajectory: $trajectory
  ) {
    id
    created_at
  }
}

# Message Analyses
mutation CreateMessageAnalysis(
  $threadId: String!
  $messageId: String!
  $userId: String!
  $modelVersion: String!
  $intentLabels: JSONB!
  $primaryIntent: String!
  $intentConfidence: Float!
  $skillsItems: JSONB!
  $currentNodes: JSONB!
  $suggestedNextNodes: JSONB!
  $trajectoryStatus: String!
) @auth(level: ADMIN) {
  createMessageAnalysis(
    threadId: $threadId
    messageId: $messageId
    userId: $userId
    modelVersion: $modelVersion
    intentLabels: $intentLabels
    primaryIntent: $primaryIntent
    intentConfidence: $intentConfidence
    skillsItems: $skillsItems
    currentNodes: $currentNodes
    suggestedNextNodes: $suggestedNextNodes
    trajectoryStatus: $trajectoryStatus
  ) {
    id
    processed_at
  }
}

# Chat Messages
mutation CreateChatMessage(
  $threadId: String!
  $userId: String!
  $courseId: String
  $role: String!
  $content: String!
) @auth(level: ADMIN) {
  createChatMessage(
    threadId: $threadId
    userId: $userId
    courseId: $courseId
    role: $role
    content: $content
  ) {
    id
    created_at
  }
}
```

### 1.4 Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│  (Components: SocraticChat, IntentInspector, etc.)       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Repository Interfaces                       │
│  • IstEventRepository                                   │
│  • ChatHistoryRepository                                │
│  • IstAnalysisRepository                                │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│         Repository Implementations                       │
│  • DataConnectIstEventRepository (NEW)                  │
│  • DataConnectChatHistoryRepository (NEW)               │
│  • DataConnectIstAnalysisRepository (NEW)               │
│  • JsonIstEventRepository (LEGACY - phased out)          │
│  • InMemoryIstAnalysisRepository (LEGACY - keep)        │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│        Firebase Data Connect SDK                         │
│  (Generated Type-Safe GraphQL Client)                   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│         GraphQL API Layer                                │
│  (Queries & Mutations defined in schema)                │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│      Cloud SQL for PostgreSQL                           │
│  (Tables: ist_events, message_analyses, chat_messages) │
└─────────────────────────────────────────────────────────┘
```

**Key Points:**
- The repository pattern remains the **single source of truth** for data access
- All business logic (IST extraction, analysis, etc.) depends on repositories, not on specific DB implementations
- Firebase Data Connect SDK is only used within repository implementations
- **Backend-only access** - DataConnect is accessed from Cloud Functions and Next.js server-side code, not from browser/client
- Frontend and Cloud Functions use the same repository interfaces

---

## 2. Where to Hook into the Existing Code

Based on the Database & Data Pipes Report, the following interfaces and files are the **primary hook points** for integrating the new DB layer:

### 2.1 IST Events Repository

**Interface:** `src/lib/ist/repositories/istEventRepository.ts`

**Current Implementations:**
- `JsonIstEventRepository` (`src/lib/ist/repositories/jsonIstEventRepository.ts`) - Active
- `PostgresIstEventRepository` (`src/lib/ist/repositories/postgresIstEventRepository.ts`) - Stub (throws errors)

**Recommendation:**
- **Create new implementation:** `DataConnectIstEventRepository` in `src/lib/ist/repositories/dataConnectIstEventRepository.ts`
- **Update factory:** `src/lib/ist/repositories/index.ts` - Add `'data_connect'` mode to `getIstEventRepository()`
- **Keep JSON as fallback:** During migration, support dual-write (write to both Data Connect and JSON) when `IST_STORAGE_MODE=data_connect_with_json_fallback`

**Implementation Strategy:**
```typescript
// src/lib/ist/repositories/dataConnectIstEventRepository.ts
import { DataConnect } from '@firebase/data-connect';
import type { IstEventRepository, GetRecentIstEventsParams } from './istEventRepository';
import type { IstEvent, CreateIstEventInput } from '../types';

export class DataConnectIstEventRepository implements IstEventRepository {
  private dataConnect: DataConnect;

  constructor(dataConnect: DataConnect) {
    this.dataConnect = dataConnect;
  }

  async save(event: CreateIstEventInput): Promise<IstEvent> {
    // Call GraphQL mutation: CreateIstEvent
    const result = await this.dataConnect.mutate('CreateIstEvent', {
      userId: event.userId,
      courseId: event.courseId,
      utterance: event.utterance,
      courseContext: event.courseContext,
      intent: event.intent,
      skills: JSON.stringify(event.skills),
      trajectory: JSON.stringify(event.trajectory),
    });
    return this.mapToIstEvent(result.data.createIstEvent);
  }

  async getRecentEvents(params: GetRecentIstEventsParams): Promise<IstEvent[]> {
    // Call GraphQL query: GetRecentIstEvents
    const result = await this.dataConnect.query('GetRecentIstEvents', {
      userId: params.userId,
      courseId: params.courseId ?? null,
      limit: params.limit ?? 10,
    });
    return result.data.istEvents.map(this.mapToIstEvent);
  }

  // ... implement other interface methods
}
```

**Usage Points:**
- `src/lib/ist/extractIST.ts` (line 101) - Calls `getIstEventRepository().save()`
- `src/lib/ist/istContextService.ts` (line 78) - Calls `getIstEventRepository().getRecentEvents()`

**Migration Approach:**
- Phase 1: Add `DataConnectIstEventRepository` alongside `JsonIstEventRepository`
- Phase 2: Enable dual-write mode (write to both)
- Phase 3: Switch reads to Data Connect, keep JSON as backup
- Phase 4: Remove JSON writes, keep JSON read as fallback only

---

### 2.2 Chat History Repository

**Interface:** `src/lib/ist/repositories/chatHistoryRepository.ts`

**Current Implementation:**
- `InMemoryChatHistoryRepository` (`src/lib/ist/repositories/inMemoryChatHistoryRepository.ts`) - Returns empty/demo data

**Recommendation:**
- **Create new implementation:** `DataConnectChatHistoryRepository` in `src/lib/ist/repositories/dataConnectChatHistoryRepository.ts`
- **Update factory:** `src/lib/ist/repositories/index.ts` - Add mode selection to `getChatHistoryRepository()`
- **Add write points:** Identify where chat messages are created (currently not persisted) and add repository calls

**Implementation Strategy:**
```typescript
// src/lib/ist/repositories/dataConnectChatHistoryRepository.ts
import { DataConnect } from '@firebase/data-connect';
import type { ChatHistoryRepository, GetRecentChatMessagesParams } from './chatHistoryRepository';
import type { ChatMessage } from '../types';

export class DataConnectChatHistoryRepository implements ChatHistoryRepository {
  private dataConnect: DataConnect;

  constructor(dataConnect: DataConnect) {
    this.dataConnect = dataConnect;
  }

  async getRecentMessages(params: GetRecentChatMessagesParams): Promise<ChatMessage[]> {
    const result = await this.dataConnect.query('GetRecentChatMessages', {
      userId: params.userId,
      courseId: params.courseId ?? null,
      limit: params.limit ?? 10,
    });
    return result.data.chatMessages.map(this.mapToChatMessage);
  }

  // Optional: Add save method for writing messages
  async save(message: ChatMessage): Promise<void> {
    await this.dataConnect.mutate('CreateChatMessage', {
      threadId: message.threadId, // Need to add threadId to ChatMessage type
      userId: message.userId, // Need to add userId to ChatMessage type
      role: message.role,
      content: message.content,
    });
  }
}
```

**Usage Points:**
- `src/lib/ist/istContextService.ts` (line 92) - Calls `getChatHistoryRepository().getRecentMessages()`

**Migration Approach:**
- Phase 2: Implement `DataConnectChatHistoryRepository`
- Phase 2: Add write points in chat components (e.g., `SocraticChat.tsx`) to persist messages
- Phase 2: Update `istContextService` to use Data Connect for reads

---

### 2.3 Message Analysis Repository

**Interface:** `src/lib/ist/repository.ts` (`IstAnalysisRepository`)

**Current Implementation:**
- `InMemoryIstAnalysisRepository` - In-memory Map, data lost on restart

**Current Direct Firestore Write:**
- `functions/src/analyzeMessage.ts` (line 214-220) - Writes directly to Firestore, bypassing repository

**Recommendation:**
- **Create new implementation:** `DataConnectIstAnalysisRepository` in `src/lib/ist/repositories/dataConnectIstAnalysisRepository.ts`
- **Refactor Cloud Function:** Update `functions/src/analyzeMessage.ts` to use repository instead of direct Firestore write
- **Support dual-write:** During migration, write to both Data Connect and Firestore

**Implementation Strategy:**
```typescript
// src/lib/ist/repositories/dataConnectIstAnalysisRepository.ts
import { DataConnect } from '@firebase/data-connect';
import type { IstAnalysisRepository } from '../repository';
import type { MessageAnalysis } from '../../../functions/src/types/messageAnalysis';

export class DataConnectIstAnalysisRepository implements IstAnalysisRepository {
  private dataConnect: DataConnect;

  constructor(dataConnect: DataConnect) {
    this.dataConnect = dataConnect;
  }

  async save(analysis: MessageAnalysis): Promise<void> {
    await this.dataConnect.mutate('CreateMessageAnalysis', {
      threadId: analysis.metadata.threadId,
      messageId: analysis.metadata.messageId ?? 'unknown',
      userId: analysis.metadata.uid,
      modelVersion: analysis.metadata.modelVersion,
      intentLabels: JSON.stringify(analysis.intent.labels),
      primaryIntent: analysis.intent.primary,
      intentConfidence: analysis.intent.confidence,
      skillsItems: JSON.stringify(analysis.skills.items),
      currentNodes: JSON.stringify(analysis.trajectory.currentNodes),
      suggestedNextNodes: JSON.stringify(analysis.trajectory.suggestedNextNodes),
      trajectoryStatus: analysis.trajectory.status,
    });
  }

  async get(threadId: string, messageId: string): Promise<MessageAnalysis | null> {
    const result = await this.dataConnect.query('GetMessageAnalysis', {
      threadId,
      messageId,
    });
    return result.data.messageAnalysis ? this.mapToMessageAnalysis(result.data.messageAnalysis) : null;
  }

  async listByThread(threadId: string): Promise<MessageAnalysis[]> {
    const result = await this.dataConnect.query('ListMessageAnalysesByThread', {
      threadId,
      limit: 50,
    });
    return result.data.messageAnalyses.map(this.mapToMessageAnalysis);
  }
}
```

**Refactoring Cloud Function:**
```typescript
// functions/src/analyzeMessage.ts (modified)
import { getIstAnalysisRepository } from './repositories'; // Need to create this in functions/

export const analyzeMessage = onCall(async (request: CallableRequest<AnalyzeMessageRequest>): Promise<MessageAnalysis> => {
  // ... existing validation and DSPy call ...

  const analysis = await runIstAnalysis({ ...data, messageId, uid });

  // NEW: Use repository instead of direct Firestore write
  const repo = getIstAnalysisRepository(); // Factory selects based on env var
  await repo.save(analysis);

  // OPTIONAL: Keep Firestore write during migration (dual-write)
  if (process.env.ENABLE_FIRESTORE_DUAL_WRITE === 'true') {
    const db = getFirestore();
    const ref = db.collection('threads').doc(data.threadId).collection('analysis').doc(messageId);
    await ref.set(analysis, { merge: true });
  }

  return analysis;
});
```

**Migration Approach:**
- Phase 3: Create `DataConnectIstAnalysisRepository`
- Phase 3: Refactor Cloud Function to use repository
- Phase 3: Enable dual-write mode (Data Connect + Firestore)
- Phase 4: Switch reads to Data Connect, keep Firestore as fallback
- Phase 4: Remove Firestore writes

---

### 2.4 Repository Factory Updates

**File:** `src/lib/ist/repositories/index.ts`

**Current Factory:**
```typescript
export function getIstEventRepository(): IstEventRepository {
  const mode = process.env.IST_STORAGE_MODE || 'json';
  switch (mode) {
    case 'json': return new JsonIstEventRepository();
    case 'postgres': return new PostgresIstEventRepository(); // Throws errors
    default: throw new Error(`Unknown IST_STORAGE_MODE: ${mode}`);
  }
}
```

**Updated Factory (after migration):**
```typescript
export function getIstEventRepository(): IstEventRepository {
  const mode = process.env.IST_STORAGE_MODE || 'json';
  const dataConnect = getDataConnectInstance(); // Helper to initialize SDK

  switch (mode) {
    case 'json':
      return new JsonIstEventRepository();
    case 'data_connect':
      return new DataConnectIstEventRepository(dataConnect);
    case 'data_connect_with_json_fallback':
      // Dual-write mode: write to both, read from Data Connect
      return new DualWriteIstEventRepository(
        new DataConnectIstEventRepository(dataConnect),
        new JsonIstEventRepository()
      );
    case 'postgres':
      // Deprecated, but keep for backwards compatibility
      return new PostgresIstEventRepository();
    default:
      throw new Error(`Unknown IST_STORAGE_MODE: ${mode}`);
  }
}
```

**Environment Variable Strategy:**
- `IST_STORAGE_MODE=json` - Current behavior (JSON only)
- `IST_STORAGE_MODE=data_connect` - New DB only
- `IST_STORAGE_MODE=data_connect_with_json_fallback` - Dual-write during migration
- `IST_ANALYSIS_STORAGE_MODE=data_connect` - Separate flag for MessageAnalysis repository
- `CHAT_HISTORY_STORAGE_MODE=data_connect` - Separate flag for ChatHistory repository

---

## 3. Step-by-Step Migration Plan (Phased)

### Phase 0 – Research & Setup (No Code Changes to Business Logic)

**Duration:** 1-2 weeks  
**Goal:** Set up Firebase Data Connect infrastructure and define schemas

#### Tasks

1. **Set up Firebase Data Connect project**
   - Enable Firebase Data Connect in Firebase Console
   - Create Cloud SQL for PostgreSQL instance (development tier)
   - Configure connection settings and authentication

2. **Define GraphQL schemas**
   - Create `dataconnect/` directory in project root
   - Define schema files:
     - `dataconnect/schema/ist_events.graphql`
     - `dataconnect/schema/message_analyses.graphql`
     - `dataconnect/schema/chat_messages.graphql`
   - Define queries and mutations in:
     - `dataconnect/queries/get_recent_ist_events.graphql`
     - `dataconnect/mutations/create_ist_event.graphql`
     - (Similar files for other operations)

3. **Generate TypeScript SDKs**
   - Run `firebase dataconnect:sdk:generate` to generate type-safe SDKs
   - Verify SDK files are generated in `dataconnect/generated/`

4. **Create helper module for Data Connect initialization**
   - File: `src/lib/dataConnect/client.ts`
   - Export `getDataConnectInstance()` function that initializes and returns Data Connect client
   - **Backend-only initialization** - Handle server-side (Next.js API routes/server components) and Cloud Functions initialization
   - Use service account or project credentials for authentication (not client-side Firebase Auth)
   - **Note:** Client-side (browser) initialization is deferred until Firebase Auth is fully integrated

5. **Set up development database**
   - Run migrations to create tables (or use Data Connect's automatic table creation)
   - Seed with sample data for testing
   - Verify GraphQL queries work in Firebase Console

6. **Documentation**
   - Document schema decisions and rationale
   - Create migration guide for TAs

**Deliverables:**
- ✅ Firebase Data Connect project configured
- ✅ GraphQL schemas defined and validated
- ✅ TypeScript SDKs generated
- ✅ Development database with sample data
- ✅ Helper module for Data Connect client initialization

**No breaking changes** - This phase only adds infrastructure, no code changes to business logic.

**Auth Notes for Phase 0:**
- All DataConnect access in this phase is **backend-only** (Cloud Functions, Next.js server-side)
- GraphQL schemas use `@auth(level: ADMIN)` for service account authentication
- `user_id` fields are simple strings (e.g., `"demo-user"`), not verified Firebase Auth UIDs
- Row-level security and per-user authorization are **not implemented** in this phase

---

### Phase 1 – Wire IST Events to the New DB (alongside JSON)

**Duration:** 2-3 weeks  
**Goal:** Implement `DataConnectIstEventRepository` and enable dual-write mode

#### Tasks

1. **Implement DataConnectIstEventRepository**
   - File: `src/lib/ist/repositories/dataConnectIstEventRepository.ts`
   - Implement all methods from `IstEventRepository` interface:
     - `save(event: CreateIstEventInput): Promise<IstEvent>`
     - `findById(id: string): Promise<IstEvent | null>`
     - `findByUserAndCourse(userId: string, courseId: string): Promise<IstEvent[]>`
     - `findByUser(userId: string): Promise<IstEvent[]>`
     - `findByCourse(courseId: string): Promise<IstEvent[]>`
     - `getRecentEvents(params: GetRecentIstEventsParams): Promise<IstEvent[]>`
   - Use generated Data Connect SDK for GraphQL operations
   - Map between `IstEvent` TypeScript types and GraphQL response types

2. **Implement DualWriteIstEventRepository (optional, for safety)**
   - File: `src/lib/ist/repositories/dualWriteIstEventRepository.ts`
   - Wraps two repositories (Data Connect + JSON)
   - `save()` writes to both repositories
   - `getRecentEvents()` reads from Data Connect, falls back to JSON on error
   - Useful during migration for data safety

3. **Update repository factory**
   - File: `src/lib/ist/repositories/index.ts`
   - Add `'data_connect'` case to `getIstEventRepository()`
   - Add `'data_connect_with_json_fallback'` case for dual-write mode
   - Initialize Data Connect client (via `getDataConnectInstance()`)

4. **Update environment variable handling**
   - Document `IST_STORAGE_MODE` options:
     - `json` (default, current behavior)
     - `data_connect` (new DB only)
     - `data_connect_with_json_fallback` (dual-write mode)
   - Update `.env.example` with new variable

5. **Test IST event writes**
   - Enable `IST_STORAGE_MODE=data_connect_with_json_fallback` in development
   - Run `extractAndStoreIST()` flow (via `socraticCourseChat` or test script)
   - Verify events are written to both Data Connect and JSON
   - Verify events can be read from Data Connect

6. **Test IST event reads**
   - Enable `IST_STORAGE_MODE=data_connect` in development
   - Verify `istContextService.getIstContextForIstExtraction()` loads events from Data Connect
   - Verify Cloud Function `loadIstContextFromJson()` still works (for backwards compatibility)

7. **Update Cloud Function IST context loading (optional)**
   - File: `functions/src/istContextFromJson.ts`
   - Add option to load from Data Connect instead of JSON file
   - Keep JSON as fallback for emulator mode
   - Controlled by `IST_CONTEXT_SOURCE` env var (`json` | `data_connect` | `auto`)

**Deliverables:**
- ✅ `DataConnectIstEventRepository` implemented and tested
- ✅ Repository factory supports new storage modes
- ✅ Dual-write mode verified (events in both DBs)
- ✅ Read operations verified (Data Connect as primary, JSON as fallback)

**Backwards Compatibility:**
- Default `IST_STORAGE_MODE=json` maintains current behavior
- JSON file continues to work for existing code paths
- Cloud Function can still read from JSON in emulator mode

**Auth Notes for Phase 1:**
- All DataConnect access in this phase is **backend-only** (from `extractAndStoreIST()` in Next.js server-side code)
- We continue to use simple `user_id` strings (e.g., `"demo-user"` in emulator, or `"demo-user-1"` from demo mode)
- No Firebase Auth verification is performed - `user_id` is passed through as-is from the calling code
- Stronger per-user auth rules will be added later, once Firebase Auth is fully integrated

---

### Phase 2 – Introduce Persistent Chat History

**Duration:** 2 weeks  
**Goal:** Implement persistent chat message storage and retrieval

#### Tasks

1. **Implement DataConnectChatHistoryRepository**
   - File: `src/lib/ist/repositories/dataConnectChatHistoryRepository.ts`
   - Implement `getRecentMessages()` method
   - Add optional `save()` method for writing messages (not in interface yet, but needed)

2. **Extend ChatHistoryRepository interface (if needed)**
   - File: `src/lib/ist/repositories/chatHistoryRepository.ts`
   - Add `save(message: ChatMessage): Promise<void>` method
   - Update `InMemoryChatHistoryRepository` to implement new method (no-op or in-memory store)

3. **Update repository factory**
   - File: `src/lib/ist/repositories/index.ts`
   - Add `CHAT_HISTORY_STORAGE_MODE` environment variable
   - Update `getChatHistoryRepository()` to support `'data_connect'` mode

4. **Add chat message write points**
   - File: `src/components/student/SocraticChat.tsx`
   - After user sends message, call `getChatHistoryRepository().save()` to persist
   - After AI responds, call `getChatHistoryRepository().save()` to persist tutor message
   - Wrap in try-catch (non-blocking, like IST extraction)

5. **Update istContextService to use real chat history**
   - File: `src/lib/ist/istContextService.ts`
   - When `CHAT_HISTORY_STORAGE_MODE=data_connect`, load real messages from Data Connect
   - Verify chat history is included in IST context for DSPy requests

6. **Test chat history flow**
   - Send messages in UI
   - Verify messages are saved to Data Connect
   - Verify `istContextService` loads recent messages
   - Verify DSPy requests include chat history

**Deliverables:**
- ✅ `DataConnectChatHistoryRepository` implemented
- ✅ Chat messages persisted to Data Connect
- ✅ Chat history loaded in IST context
- ✅ DSPy requests enriched with real chat history

**Backwards Compatibility:**
- `InMemoryChatHistoryRepository` still returns empty/demo data if `CHAT_HISTORY_STORAGE_MODE` not set
- Existing code paths continue to work

**Auth Notes for Phase 2:**
- All DataConnect access in this phase is **backend-only** (from Next.js server-side code when saving/loading chat messages)
- Chat messages use simple `user_id` strings (e.g., `"demo-user"`) - no Firebase Auth verification
- The `students` table is **not required** for this phase - we work with plain `user_id: String` columns
- Future: Once Firebase Auth is integrated, we can add foreign key relationships to a `students` table

---

### Phase 3 – Unify Message Analysis Storage

**Duration:** 2-3 weeks  
**Goal:** Migrate MessageAnalysis storage from Firestore to Data Connect

#### Tasks

1. **Implement DataConnectIstAnalysisRepository**
   - File: `src/lib/ist/repositories/dataConnectIstAnalysisRepository.ts`
   - Implement all methods from `IstAnalysisRepository` interface:
     - `save(analysis: MessageAnalysis): Promise<void>`
     - `get(threadId: string, messageId: string): Promise<MessageAnalysis | null>`
     - `listByThread(threadId: string): Promise<MessageAnalysis[]>`
   - Map between `MessageAnalysis` TypeScript types and GraphQL types

2. **Create repository factory for Cloud Functions**
   - File: `functions/src/repositories/index.ts` (new file)
   - Export `getIstAnalysisRepository()` function
   - Support modes: `firestore` (current), `data_connect`, `data_connect_with_firestore_fallback`
   - Initialize Data Connect client for Cloud Functions environment

3. **Refactor Cloud Function to use repository**
   - File: `functions/src/analyzeMessage.ts`
   - Replace direct Firestore write (line 214-220) with repository call:
     ```typescript
     const repo = getIstAnalysisRepository();
     await repo.save(analysis);
     ```
   - Add dual-write mode: if `ENABLE_FIRESTORE_DUAL_WRITE=true`, also write to Firestore
   - Keep Firestore write as fallback during migration

4. **Update Next.js repository factory**
   - File: `src/lib/ist/repository.ts`
   - Add `IST_ANALYSIS_STORAGE_MODE` environment variable
   - Update `getIstAnalysisRepository()` to support `'data_connect'` mode
   - Keep `InMemoryIstAnalysisRepository` as default for backwards compatibility

5. **Test MessageAnalysis writes**
   - Enable `IST_ANALYSIS_STORAGE_MODE=data_connect_with_firestore_fallback` in Cloud Function
   - Call `analyzeMessage` Cloud Function
   - Verify analysis is written to both Data Connect and Firestore
   - Verify analysis can be read from Data Connect

6. **Test MessageAnalysis reads**
   - Update UI components to read from Data Connect (if needed)
   - Verify `IntentInspector` or similar components can load analyses from Data Connect
   - Keep Firestore reads as fallback

7. **Data migration script (optional)**
   - Create script to migrate existing Firestore analyses to Data Connect
   - File: `scripts/migrate_firestore_to_dataconnect.ts`
   - Read from Firestore `threads/{threadId}/analysis/{messageId}`
   - Write to Data Connect via `DataConnectIstAnalysisRepository`
   - Run as one-time migration

**Deliverables:**
- ✅ `DataConnectIstAnalysisRepository` implemented
- ✅ Cloud Function uses repository instead of direct Firestore write
- ✅ Dual-write mode verified (analyses in both DBs)
- ✅ Read operations verified (Data Connect as primary, Firestore as fallback)
- ✅ Optional: Existing Firestore data migrated to Data Connect

**Backwards Compatibility:**
- Default `IST_ANALYSIS_STORAGE_MODE=firestore` maintains current behavior
- Firestore continues to work for existing code paths
- UI can read from either source during migration

**Auth Notes for Phase 3:**
- All DataConnect access in this phase is **backend-only** (from Cloud Functions and Next.js server-side code)
- Cloud Function continues to use `request.auth?.uid ?? "demo-user"` pattern - this `uid` is passed as `user_id` to DataConnect
- No Firebase Auth token verification in DataConnect layer - `user_id` is trusted as-is from the backend service
- Stronger per-user authorization (e.g., users can only read their own analyses) will be added later when Firebase Auth is integrated

---

### Phase 4 – Cleanup & Hardening

**Duration:** 1-2 weeks  
**Goal:** Remove legacy storage, add tests, and improve observability

#### Tasks

1. **Remove JSON as primary storage**
   - Update `getIstEventRepository()` factory to deprecate `'json'` mode
   - Keep JSON read as fallback only (for backwards compatibility)
   - Update documentation to recommend `data_connect` mode

2. **Remove or complete Postgres stub**
   - File: `src/lib/ist/repositories/postgresIstEventRepository.ts`
   - Decision: Remove if Data Connect replaces it, or complete if needed for non-Firebase deployments
   - Update factory to remove `'postgres'` case if removed

3. **Add unit tests for repositories**
   - File: `tests/unit/repositories/dataConnectIstEventRepository.test.ts`
   - File: `tests/unit/repositories/dataConnectChatHistoryRepository.test.ts`
   - File: `tests/unit/repositories/dataConnectIstAnalysisRepository.test.ts`
   - Mock Data Connect SDK, test all repository methods

4. **Add integration tests**
   - File: `tests/integration/dataconnect/repositories.test.ts`
   - Test against real Data Connect instance (development database)
   - Verify CRUD operations work end-to-end

5. **Add observability hooks**
   - Add logging to repository methods (success/failure counts)
   - Add error tracking (e.g., Sentry integration)
   - Add performance metrics (query latency, mutation latency)
   - File: `src/lib/ist/repositories/observability.ts` (helper module)

6. **Update documentation**
   - Update `Database-Data-Pipes-Report.md` with new architecture
   - Create `DATACONNECT_MIGRATION_GUIDE.md` for TAs
   - Document environment variables and their effects
   - Document how to switch between storage modes

7. **Performance optimization**
   - Review GraphQL query performance
   - Add database indexes if needed (via Data Connect schema)
   - Optimize JSONB field queries if needed

8. **Security review (basic)**
   - Verify `@auth(level: ADMIN)` directives in GraphQL schema work correctly with service account
   - **Note:** Per-user authorization (users can only access their own data) is deferred until Firebase Auth integration
   - Review data access patterns for security issues
   - Document future security enhancements needed when Firebase Auth is added

**Deliverables:**
- ✅ Legacy storage modes deprecated or removed
- ✅ Unit and integration tests added
- ✅ Observability hooks in place
- ✅ Documentation updated
- ✅ Performance optimized
- ✅ Security reviewed

**Backwards Compatibility:**
- Fallback modes (JSON read, Firestore read) remain for emergency rollback
- Environment variables allow switching back to legacy modes if needed

---

## 4. Minimal-Change Strategy

### 4.1 Keeping Current Path Functional

The currently working path **UI → Cloud Function → DSPy → Firestore → IntentInspector** must remain fully functional during migration. Here's how:

#### Strategy 1: Environment Variable Feature Flags

All new code paths are **opt-in** via environment variables:

- **Default behavior (no changes):**
  - `IST_STORAGE_MODE=json` (or unset) → Uses JSON, no changes
  - `IST_ANALYSIS_STORAGE_MODE=firestore` (or unset) → Uses Firestore, no changes
  - `CHAT_HISTORY_STORAGE_MODE=memory` (or unset) → Uses in-memory, no changes

- **New behavior (opt-in):**
  - `IST_STORAGE_MODE=data_connect` → Uses Data Connect for IST events
  - `IST_ANALYSIS_STORAGE_MODE=data_connect` → Uses Data Connect for analyses
  - `CHAT_HISTORY_STORAGE_MODE=data_connect` → Uses Data Connect for chat

- **Migration mode (dual-write):**
  - `IST_STORAGE_MODE=data_connect_with_json_fallback` → Writes to both, reads from Data Connect
  - `IST_ANALYSIS_STORAGE_MODE=data_connect_with_firestore_fallback` → Writes to both, reads from Data Connect

#### Strategy 2: Repository Pattern Abstraction

The repository pattern ensures that **business logic never directly depends on storage implementations**:

- `extractAndStoreIST()` calls `getIstEventRepository().save()` - doesn't know if it's JSON or Data Connect
- `istContextService` calls `getIstEventRepository().getRecentEvents()` - doesn't know the source
- Cloud Function calls `getIstAnalysisRepository().save()` - doesn't know if it's Firestore or Data Connect

This means **switching storage modes requires zero code changes** - only environment variable updates.

#### Strategy 3: Gradual Rollout

1. **Development environment:** Enable Data Connect modes, test thoroughly
2. **Staging environment:** Enable dual-write modes, verify data consistency
3. **Production environment:** Enable Data Connect as primary, keep legacy as fallback
4. **Production (final):** Remove legacy writes, keep reads as emergency fallback

### 4.2 Feature Flag Implementation

Create a centralized configuration module:

```typescript
// src/lib/config/storage.ts
export const StorageConfig = {
  istEvents: {
    mode: process.env.IST_STORAGE_MODE || 'json',
    enableDualWrite: process.env.IST_STORAGE_DUAL_WRITE === 'true',
  },
  messageAnalyses: {
    mode: process.env.IST_ANALYSIS_STORAGE_MODE || 'firestore',
    enableDualWrite: process.env.IST_ANALYSIS_DUAL_WRITE === 'true',
  },
  chatHistory: {
    mode: process.env.CHAT_HISTORY_STORAGE_MODE || 'memory',
  },
} as const;
```

Use this config in repository factories to select implementations.

### 4.3 Rollback Plan

If issues arise during migration:

1. **Immediate rollback:** Set environment variables back to legacy modes
   - `IST_STORAGE_MODE=json`
   - `IST_ANALYSIS_STORAGE_MODE=firestore`
   - `CHAT_HISTORY_STORAGE_MODE=memory`

2. **Data recovery:** If Data Connect writes failed but legacy writes succeeded, data is safe in JSON/Firestore

3. **Code rollback:** Git revert to previous commit if needed (but shouldn't be necessary due to feature flags)

### 4.4 Testing Strategy

1. **Unit tests:** Mock Data Connect SDK, test repository implementations
2. **Integration tests:** Test against real Data Connect instance (development DB)
3. **Dual-write tests:** Verify data is written to both storages correctly
4. **Fallback tests:** Verify reads fall back to legacy storage on Data Connect errors
5. **End-to-end tests:** Test full flow (UI → Cloud Function → Data Connect → UI)

---

## 5. Final Summary for the Course Staff

### How to Explain This Plan to the Course Staff

**Motivation: Why Data Connect / GraphQL?**

The current architecture uses JSON files for IST event history and direct Firestore writes for message analyses. While functional, this approach has limitations:

- **JSON files** are not scalable, difficult to query, and don't support concurrent writes well
- **Direct Firestore writes** bypass the repository pattern, making it harder to swap storage backends
- **No unified data model** - IST events, analyses, and chat messages are stored in different places with different access patterns

Firebase Data Connect provides a **modern, scalable solution** that:
- Uses **PostgreSQL** (Cloud SQL) for robust relational data management
- Exposes data through **GraphQL** for type-safe, efficient queries
- **Generates type-safe SDKs** that reduce bugs and improve developer experience
- **Future-ready for Firebase Auth** - Once Firebase Authentication is fully integrated, DataConnect can seamlessly add row-level security and per-user authorization

**Preserving Architecture Principles**

This migration plan **maintains the existing microservice/repository architecture** that the project already follows:

- **Repository interfaces remain unchanged** - all business logic continues to depend on abstractions, not concrete implementations
- **Clean separation of concerns** - data storage is isolated behind repository interfaces
- **Easy to test** - repositories can be mocked or swapped for testing
- **Incremental migration** - each repository can be migrated independently

The only difference is that repository implementations now use GraphQL/Data Connect instead of JSON files or direct Firestore calls. The **architecture pattern remains the same**.

**Incremental, Testable, and Reversible**

The plan is designed for **zero-downtime migration**:

- **Feature flags** allow switching between storage modes via environment variables - no code changes needed
- **Dual-write modes** ensure data is written to both old and new systems during migration, providing safety
- **Fallback mechanisms** allow reads to fall back to legacy storage if Data Connect fails
- **Each phase is independently testable** - we can verify Phase 1 works before starting Phase 2
- **Complete rollback is possible** - simply change environment variables back to legacy modes

This approach allows TAs to:
- **Test the new system** in development without affecting production
- **Gradually roll out** to production with confidence
- **Roll back immediately** if any issues arise
- **Run both systems in parallel** during migration for data safety

The migration is **low-risk, high-value** - it modernizes the data layer while preserving all existing functionality and architectural principles.

**Authentication Strategy: Auth-Light for Now, Future-Proof for Later**

This migration plan is deliberately **auth-light** for the initial phases. We use simple backend-only authentication (service account level) and treat `user_id` as plain strings (like `"demo-user"` in emulator mode). This matches the current reality of the project, which doesn't yet have a fully developed Firebase Auth integration. However, the design is **fully compatible** with future integration of proper Firebase Auth and DataConnect row-level security. Once Firebase Auth is integrated, we can:

- Add `@auth(level: USER)` directives to GraphQL queries/mutations
- Implement row-level security rules (e.g., users can only access their own data)
- Enable client-side DataConnect SDK usage with Firebase Auth tokens
- Add foreign key relationships to a `students` table with verified Firebase UIDs

The data model and repository interfaces are designed to support this future enhancement without requiring major refactoring. The migration plan prioritizes **getting the data layer working correctly first**, then **tightening security** as a separate, well-defined follow-up task.

---

## Appendix: File Structure After Migration

```
project-root/
├── dataconnect/                    # NEW: Firebase Data Connect schemas
│   ├── schema/
│   │   ├── ist_events.graphql
│   │   ├── message_analyses.graphql
│   │   └── chat_messages.graphql
│   ├── queries/
│   │   ├── get_recent_ist_events.graphql
│   │   ├── get_message_analysis.graphql
│   │   └── get_recent_chat_messages.graphql
│   ├── mutations/
│   │   ├── create_ist_event.graphql
│   │   ├── create_message_analysis.graphql
│   │   └── create_chat_message.graphql
│   └── generated/                  # Auto-generated SDKs
│       └── index.ts
├── src/
│   ├── lib/
│   │   ├── dataConnect/            # NEW: Data Connect client helpers
│   │   │   └── client.ts
│   │   ├── ist/
│   │   │   ├── repositories/
│   │   │   │   ├── istEventRepository.ts          # Interface (unchanged)
│   │   │   │   ├── jsonIstEventRepository.ts      # Legacy (kept for fallback)
│   │   │   │   ├── dataConnectIstEventRepository.ts  # NEW
│   │   │   │   ├── dualWriteIstEventRepository.ts     # NEW (migration helper)
│   │   │   │   ├── chatHistoryRepository.ts       # Interface (unchanged)
│   │   │   │   ├── inMemoryChatHistoryRepository.ts  # Legacy (kept)
│   │   │   │   ├── dataConnectChatHistoryRepository.ts  # NEW
│   │   │   │   └── dataConnectIstAnalysisRepository.ts  # NEW
│   │   │   └── repository.ts                      # IstAnalysisRepository (unchanged)
│   │   └── config/
│   │       └── storage.ts                          # NEW: Storage config
│   └── ...
├── functions/
│   └── src/
│       ├── repositories/           # NEW: Repository factory for Cloud Functions
│       │   └── index.ts
│       └── analyzeMessage.ts       # Modified: Uses repository instead of direct Firestore
└── tests/
    ├── unit/
    │   └── repositories/           # NEW: Unit tests for Data Connect repositories
    └── integration/
        └── dataconnect/            # NEW: Integration tests
```

---

**End of Migration Plan**

