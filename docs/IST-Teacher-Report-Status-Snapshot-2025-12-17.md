# IST Teacher Report Status Snapshot - December 17, 2025

## 1. High-Level Overview

**Project**: CourseWise – AI-powered tutoring for CS courses using Next.js 15, Firebase/Genkit, DSPy, and Firebase Data Connect.

**Scope of this snapshot**: Progress since the **IST / Data Connect Status Snapshot – December 11, 2025**, focusing on the new **Teacher-side “IST Class Report” (JSON-first MVP)** feature.

**Goal of the feature**: Give teachers a **class-wide view** of which skills are appearing in IST events for a course, without exposing any per-student or per-message details. This sets the stage for later wiring the same UI to Firebase Data Connect instead of mocks.

---

## 2. What Was Implemented (Since 2025-12-11)

### 2.1 Pure Analytics Module for Teacher Reports

- **File**: `src/features/ist/reports/teacherIstReport.ts`
- **Key exports**:
  - `normalizeSkill(raw: unknown): string | null`
    - Trims, collapses whitespace, lowercases, and discards empty/punctuation-only strings.
  - `computeTeacherIstClassReport(events, courseId, options?): TeacherIstClassReport`
    - Accepts an array of `IstEventForReport` and a `courseId`.
    - Computes:
      - `totalEvents` (all events for the course).
      - `eventsWithSkills` (events with at least one normalized skill).
      - `uniqueSkillsCount` (size of the normalized skill set).
      - `topSkills` (up to 10 skills, sorted by count desc, skill asc).
      - `gaps` (skills with `share < 0.02`).
    - **Share definition**: `share = count / totalSkillAssignments` (fraction of all skill assignments, not per-event).
      - UI labels this as **“Share (% of all skill assignments)”** to avoid confusion.

### 2.2 Teacher IST Class Report UI (JSON-first)

- **Course list (teacher)**:
  - **File**: `src/app/teacher/courses/page.tsx`
  - The **“Reports”** button on each course card is now **enabled** and routes to:
    - `/teacher/courses/<courseId>?view=ist-report`
  - For the Data Structures & Algorithms course, after the id change (see below), this is now:
    - `/teacher/courses/cs-demo-101?view=ist-report`

- **Course management page (teacher)**:
  - **File**: `src/app/teacher/courses/[courseId]/_components/course-management-client.tsx`
  - The course management client now includes a third tab:
    - Tabs: `Course Materials`, `Learning Objectives`, **`IST Class Report`**.
    - `TabsTrigger value="ist-report"` labeled **“IST Class Report”**.
    - `TabsContent value="ist-report"` mounts the new report component.

- **Teacher IST report component**:
  - **File**: `src/app/teacher/courses/[courseId]/_components/TeacherClassIstReport.tsx`
  - Props: `{ courseId: string }`.
  - UI states:
    - **Idle**: Instructions text, inviting the teacher to click **“Generate IST Class Report”**.
    - **Loading**: Simple loading copy *“Generating IST class report…”*.
    - **Success**: Renders the aggregated report.
    - **Empty**: No events found for this course in the dataset.
    - **Error**: Datasource or parsing error (with an `Alert` and a clear message).
  - **Privacy**:
    - The component only displays **aggregated metrics**:
      - `totalEvents`, `eventsWithSkills`, `uniqueSkillsCount`.
      - Top skills and gaps summaries.
    - It explicitly **does not read or display** `userId`, `threadId`, `messageId`, or `utterance`.
    - The copy clarifies: *“This view does not include any per-student or identity details.”*

---

## 3. Data Source: JSON-First, Runtime Fetch (No-Store)

### 3.1 Mock Dataset

- **File**: `public/mocks/ist/teacher-class-events.json`
- **Format**: Array of event objects (`IstEventForReport`):
  - `id: string`
  - `courseId: string`
  - `createdAt: string` (ISO)
  - `skills?: unknown` (usually `string[]`; noise allowed)
- **Current scope**:
  - Contains multiple events for the course `cs-demo-101` (Data Structures & Algorithms).
  - Intentionally includes noise:
    - Events with `skills: []`.
    - Events with missing `skills` field.
    - Casing/whitespace variants (`"Recursion"`, `" recursion "`, `"   recursion\t"`).
    - Some weird-whitespace/low-signal entries (`"!\t "`, `"  "`).
    - Duplicate-ish patterns to exercise robustness (we do **not** dedupe; we just count frequencies).

### 3.2 Runtime Loading Behaviour

- **In `TeacherClassIstReport`**:
  - Fetch call:
    - `fetch("/mocks/ist/teacher-class-events.json", { cache: "no-store" })`.
  - This ensures:
    - Any edits to the JSON file are reflected on the **next button click**.
    - No build-time or Turbopack caching surprises for the teacher report.
  - Flow:
    1. On click:
       - Set local status to `loading`.
       - Fetch the JSON.
    2. Parse JSON as `IstEventForReport[]`.
    3. Filter by `courseId === props.courseId` (e.g. `cs-demo-101`).
    4. Pass the filtered events to `computeTeacherIstClassReport(...)`.
    5. Update status to `success`/`empty`/`error` based on the result.

---

## 4. Analytics Definition (Teacher-Wide Report)

### 4.1 Metrics and Denominator

For a given course:

- `totalEvents`:
  - Number of events in the dataset for that `courseId`, regardless of skills.
- `eventsWithSkills`:
  - Number of events with at least one **valid**, normalized skill.
- `uniqueSkillsCount`:
  - Number of distinct normalized skill strings observed.
- `topSkills`:
  - At most 10 skills, sorted by:
    - `count` (descending), then
    - `skill` (alphabetical) for deterministic ordering.
  - Each entry has:
    - `skill: string`
    - `count: number`
    - `share: number` (0–1)
- `gaps`:
  - Subset of skills where:
    - `share < 0.02` (i.e., **less than 2% of all skill assignments**).
  - Sorted ascending by `share` then `skill` (weakest coverage first).

**Important denominator**:

- `totalSkillAssignments` is computed as the sum of skill counts across the aggregated dataset:
  - `totalSkillAssignments = sum(count(skill))`
- For each skill:
  - `share = count(skill) / totalSkillAssignments`
- UI copy explicitly says:
  - *“Share (% of all skill assignments)”* to distinguish this from per-event percentages.

### 4.2 Data Cleaning and Normalization

- For each event:
  - If `skills` is missing or not an array → treat as `[]`.
  - Each element in `skills` is passed through `normalizeSkill(raw)`:
    - `trim()` + collapse internal whitespace to single spaces.
    - `toLowerCase()`.
    - Discard if the result is empty or composed only of punctuation/whitespace.
  - Per-event, we use a `Set` to avoid counting the same normalized skill twice for that one event (but duplicates across events count as expected).
- Events:
  - contribute to `eventsWithSkills` only if they produce at least one normalized skill.
  - are still counted in `totalEvents` regardless of skills.

---

## 5. UI Flow (End-to-End Teacher Experience)

### 5.1 Navigation and URLs

1. **Teacher course list**:
   - Navigate to:
     - `http://localhost:9002/teacher/courses`
   - Find the **Data Structures & Algorithms** course.
   - Click **“Reports”**.
   - Expected URL:
     - `http://localhost:9002/teacher/courses/cs-demo-101?view=ist-report`

2. **Course management page**:
   - Tabs visible:
     - `Course Materials`
     - `Learning Objectives`
     - `IST Class Report`
   - Click the **“IST Class Report”** tab if not already selected.

3. **Generate class report**:
   - Click **“Generate IST Class Report”**.
   - The component:
     - Fetches `/mocks/ist/teacher-class-events.json` with `cache: "no-store"`.
     - Filters events for `courseId: "cs-demo-101"`.
     - Computes the teacher report and renders the metrics.

At no point does the teacher UI expose per-student or per-message identifiers; it is strictly **course-level aggregation**.

---

## 6. Bug Fix: Mistaken `"use server"` on Analytics Module

### 6.1 Problem

- **File**: `src/features/ist/reports/teacherIstReport.ts`
- Initially, the file began with:
  - `"use server";`
- This caused Turbopack to treat the file as a **Server Actions module**, leading to:
  - **Error**: *“Server Actions must be async functions.”*
- However, `teacherIstReport.ts` only exports **synchronous** helpers (`normalizeSkill`, `computeTeacherIstClassReport`) and is imported directly by the **client** component `TeacherClassIstReport.tsx`.

### 6.2 Fix

- Removed the `"use server"` directive from the top of `teacherIstReport.ts`.
- Result:
  - The file is now a plain shared utility module.
  - Client components can import and use its pure functions without triggering Server Actions constraints.
  - Next.js dev server compiles successfully without Server Actions errors.

---

## 7. Course ID Alignment: `cs202` → `cs-demo-101`

### 7.1 Previous Mismatch

- **Mock courses** came from `src/lib/mock-data.ts`, where the Data Structures & Algorithms course had:
  - `id: "cs202"`.
- The **teacher IST mock dataset** uses:
  - `courseId: "cs-demo-101"`.
- Result:
  - Teacher UI routed to `/teacher/courses/cs202`.
  - `TeacherClassIstReport` filtered events by `courseId: "cs202"` → no matches in the JSON dataset → **empty reports**.

### 7.2 Change

- **File**: `src/lib/mock-data.ts`
- Updated the course id:
  - From:
    - `id: 'cs202'`
  - To:
    - `id: 'cs-demo-101'`
- Updated related `studentProgress` entry:
  - From:
    - `{ studentId: 'student-1', courseId: 'cs202', ... }`
  - To:
    - `{ studentId: 'student-1', courseId: 'cs-demo-101', ... }`

### 7.3 Outcome

- `/teacher/courses` now builds links based on `course.id === "cs-demo-101"`.
- `/teacher/courses/cs-demo-101?view=ist-report` passes `courseId="cs-demo-101"` into the report component.
- The JSON dataset and the teacher UI are now aligned, and the report correctly includes events for the Data Structures & Algorithms course.

---

## 8. Manual Verification Results (Current Behaviour)

Using the current mock dataset and teacher UI:

- **Course**: `cs-demo-101` (Data Structures & Algorithms)
- **Route**: `http://localhost:9002/teacher/courses/cs-demo-101?view=ist-report`

After clicking **“Generate IST Class Report”**:

- **Overview metrics**:
  - `totalEvents = 100`
  - `eventsWithSkills = 90`
  - `uniqueSkillsCount = 74`

- **Top skills (sample)**:
  - `recursion` – `count = 12`, `share ≈ 12%` of all skill assignments
  - `arrays` – `count = 10`, `share ≈ 10%`
  - `linked lists` – `count = 10`, `share ≈ 10%`
  - (Others follow in deterministic order: by `count` desc, then `skill` asc.)

- **Gaps behaviour**:
  - Skills with a single occurrence (`count = 1`) have:
    - `share ≈ 0.55%` (depending on totalSkillAssignments).
  - These skills appear in the **“Potential Skill Gaps”** table because:
    - `share < 0.02` (2% threshold).
  - No skill with `share ≥ 2%` appears in the gaps section, confirming the threshold is applied consistently.

---

## 9. Known Limitations / Next Steps

1. **Dataset size and distribution**
   - Current JSON dataset is smaller than the **target spec** (1,200 events: 800/300/100 per course).
   - Next steps:
     - Expand `public/mocks/ist/teacher-class-events.json` to:
       - 800 events for `cs-demo-101`
       - 300 events for `cs-demo-102`
       - 100 older events for `cs-demo-archived`
     - Maintain:
       - Noise percentages (empty/missing skills, casing variants, duplicates).
       - Zipf-like distribution for skills.

2. **URL-driven tab selection**
   - Current behaviour:
     - Query parameter `?view=ist-report` does **not yet** auto-select the IST tab.
   - Next step:
     - Read `view` from `searchParams` on the course page and pass as `defaultValue` to `Tabs` (or manage via state) so that `view=ist-report` opens directly on the report tab.

3. **Swap JSON loader to Data Connect**
   - The teacher report currently reads from JSON mocks only.
   - Next step:
     - Introduce a `loadIstEventsForReport` abstraction that can:
       - In emulator/dev: read from Data Connect (IstEvent table) via the generated SDK.
       - In this MVP: still support JSON as a fallback.
     - Ensure the `TeacherClassIstReport` component remains unchanged apart from calling the new loader.

4. **Performance & UX polish**
   - With larger datasets, consider:
     - Using `useTransition` (already in place) plus subtle loading indicators.
     - Possibly moving computation into a server action in the future (separate from the analytics core), while keeping `teacherIstReport.ts` pure and shared.

---

**Last Updated**: December 17, 2025  
**Status**: ✅ Teacher IST Class Report (JSON-first MVP) implemented and aligned with mock dataset; ready for dataset expansion and future Data Connect wiring.


