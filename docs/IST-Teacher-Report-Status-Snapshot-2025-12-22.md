# IST Teacher Report Status Snapshot - December 22, 2025

**Last Updated:** December 22, 2025  
This snapshot continues from the “IST Teacher Report Status Snapshot - December 17, 2025”.

## 1. High-Level Summary

- **Next.js 15 routing warning resolved**: Fixed the `params.courseId must be awaited` app router warning by making the dynamic course page async and properly awaiting `params` (and `searchParams` where used).
- **Teacher IST analytics upgraded to v2**: Extended `computeTeacherIstClassReportV2` to compute richer course-level metrics (coverage, trends, data quality) while keeping the module pure and JSON/DataConnect agnostic.
- **Existing v1 API preserved**: Kept `computeTeacherIstClassReport(...)` working by having it delegate to v2 and return a backward-compatible subset for the current UI.
- **Teacher IST report UI redesigned**: Replaced the simple table view with a more structured layout (KPI cards, trends, skills, gaps, and data quality), powered by the new v2 analytics output.
- **Privacy guarantees reinforced**: Confirmed that the teacher report remains fully aggregated at course level only, with no user IDs, thread IDs, message IDs, or raw utterance text rendered.
- **Manual verification pass completed**: Generated a report for `cs-demo-101` from the mock dataset and captured example numbers to validate the new metrics and layout.

## 2. Fixes / Stability

- **Issue**: Next.js 15 App Router produced a warning/error about dynamic route params:
  - `params.courseId must be awaited` (sync dynamic API usage warning on `[courseId]/page.tsx`).
- **Change**:
  - Updated the `app/teacher/courses/[courseId]/page.tsx` page to be `async`.
  - Explicitly `await`ed `params` (and `searchParams` where applicable) before using them.
- **Outcome**:
  - The dynamic route now complies with the Next.js 15 App Router expectations.
  - The warning has been removed and the teacher course route is stable under navigation and reload.

## 3. Teacher IST Report v2 (Analytics + UI)

**File:** `src/features/ist/reports/teacherIstReport.ts`

- **New v2 analytics entry point**
  - Added `computeTeacherIstClassReportV2(events, courseId, options)` that operates over `IstEventForReport[]` and returns a richer `TeacherIstClassReportV2` payload.
  - Input type `IstEventForReport` has been extended to optionally accept future `intent` and `trajectory` fields (ignored for now), while remaining tolerant of missing/invalid `skills`.

- **New core metrics**
  - **`totalSkillAssignments`**: Sum of per-event, de-duplicated, normalized skill counts across all course events.
  - **`avgSkillsPerEvent`**: `totalSkillAssignments / totalEvents` (0-safe).
  - **`avgSkillsPerSkilledEvent`**: `totalSkillAssignments / eventsWithSkills` (0-safe).
  - **Observation window**:
    - **`firstEventAt`**: Earliest valid `createdAt` in-course (ISO string) or `null`.
    - **`lastEventAt`**: Latest valid `createdAt` in-course (ISO string) or `null`.

- **Coverage metrics**
  - **`coverage.top1Share`**: Share of all skill assignments contributed by the single most frequent skill.
  - **`coverage.top5Share`**: Combined share for the top 5 skills.
  - **`coverage.top10Share`**: Combined share for the top 10 skills.
  - **`coverage.longTailShare`**: `1 - top10Share` clamped to \[0, 1\], representing everything outside the top 10.

- **Gaps**
  - **`gapThreshold`**: Configurable (default `0.02` = 2% of all skill assignments).
  - **`gaps`**: Skills whose share is **strictly below** `gapThreshold`, sorted by share asc then skill asc.
  - **`gapsCount`**: Total number of skills currently treated as “gaps”.

- **Trends (Last 7 vs Previous 7 days)**
  - Based on UTC day-bucketing of `createdAt`.
  - **`trends.last7Days`**:
    - `start` / `end` (ISO day boundaries for the last 7-day window).
    - `events`: Count of events in the last 7 days.
    - `skillAssignments`: Sum of per-event unique skills in the last 7 days.
  - **`trends.prev7Days`**:
    - Matching fields for the preceding 7-day window.
  - **`trends.delta`**:
    - `eventsDiff`: `last7.events - prev7.events`.
    - `skillAssignmentsDiff`: `last7.skillAssignments - prev7.skillAssignments`.
    - `eventsPctChange`: Relative change vs previous window (0 when previous is 0).
    - `skillAssignmentsPctChange`: Relative change vs previous window (0 when previous is 0).
  - **Skill trends**:
    - **`risingSkills`**: Top 5 skills by `(last7Count - prev7Count)` > 0, sorted by diff desc then skill asc.
    - **`decliningSkills`**: Top 5 skills by `(prev7Count - last7Count)` > 0, sorted by diff desc then skill asc.

- **Data quality metrics**
  - **`eventsMissingSkillsField`**: Events where `skills` is not present at all.
  - **`eventsSkillsNotArray`**: Events where `skills` is present but not an array.
  - **`eventsEmptySkillsArray`**: Events with an empty `skills` array.
  - **`invalidSkillEntriesDropped`**: Count of individual skill entries dropped by `normalizeSkill` (non-strings, empty after trimming, or punctuation-only).

- **Normalization and counting rules (unchanged from v1, now surfaced)**
  - If `skills` missing or not an array ⇒ treat as `[]`.
  - `normalizeSkill`:
    - Trim, collapse internal whitespace to a single space, lowercase, drop punctuation-only.
  - Per-event de-duplication:
    - Skills are de-duplicated per event via a `Set`, so multiple mentions of the same normalized skill in a single event count as **one assignment**.

- **v1 compatibility**
  - **Existing export preserved**: `computeTeacherIstClassReport(...)` remains exported.
  - Implementation now calls `computeTeacherIstClassReportV2` internally and returns a subset:
    - `courseId`, `totalEvents`, `eventsWithSkills`, `uniqueSkillsCount`, `topSkills`, `gaps`, `generatedAt`.
  - Existing UI imports and behavior remain intact while new UI can adopt the richer v2 shape.

## 4. Teacher IST Report v2 (UI Improvements)

**File:** `src/app/teacher/courses/[courseId]/_components/TeacherClassIstReport.tsx`

- **Executive Summary KPI cards**
  - Top-of-page grid of KPI cards including:
    - Total events.
    - Events with skills (count + percentage of total events).
    - Unique skills.
    - Total skill assignments.
    - Average skills per skilled event.
    - Top skill (name + share of all skill assignments).
    - Top 10 concentration (top10Share as a percentage).
    - Observation window (first/last event dates).

- **Trends section**
  - Compact 7d vs previous 7d summary table showing events and skill assignments for each window and their relative Δ (% change).
  - Two side-by-side lists:
    - **Rising skills (top 5)** with counts `(prev → last)` and positive diffs.
    - **Declining skills (top 5)** with counts `(prev → last)` and negative diffs.

- **Skills section with search**
  - A single **“Search skills…”** text input that filters both Top Skills and Gaps tables client-side by skill name (case-insensitive).
  - **Top Skills table**:
    - Shows the v2 `topSkills` (up to 10 by default, but filtered by search).
    - Columns: Skill, Count, Share (% of all skill assignments).
    - Clarifying helper text that shares are over **all skill assignments**, not events.

- **Gaps section with “Show all / Show first 20”**
  - “Potential skill gaps” table driven by v2 `gaps` and `gapThreshold`.
  - By default, shows only the first 20 rows for readability.
  - Includes a toggle button:
    - “Show all (N)” to reveal all matching gaps.
    - “Show first 20” to collapse again.
  - Gaps table is also filtered by the same skill search input.

- **Data Quality cards**
  - Bottom section renders four small cards using `dataQuality`:
    - Events missing skills field.
    - Events with non-array skills.
    - Events with empty skills array.
    - Invalid skill entries dropped.
  - Includes a short explanatory note that these metrics help interpret the reliability of the IST data.

- **Privacy emphasis**
  - The UI renders only:
    - Aggregated numeric counts.
    - Normalized skill names.
    - Derived coverage, trend, and quality metrics at **course level**.
  - It does **not** render:
    - `userId`, `threadId`, `messageId`.
    - Any raw `utterance` or student message text.
  - The “IST Class Report” remains explicitly framed as an **aggregated class-level dashboard**, not a per-student report.

## 5. Manual Verification Snapshot

For the mock course **`cs-demo-101`**, after clicking **“Generate IST Class Report”**, we observed the following example metrics from the v2 analytics + UI:

- **Core metrics**
  - `totalEvents` = **100**
  - `eventsWithSkills` = **90**
  - `uniqueSkillsCount` = **74**
  - `totalSkillAssignments` = **183**

- **Coverage**
  - Top skill **“recursion”** share ≈ **6.6%** of all skill assignments.
  - Top 10 concentration ≈ **40.4%** of all skill assignments.

- **Trends (Last 7 vs Previous 7 days)**
  - `last7Days`: **70 events**, **122** skill assignments.
  - `prev7Days`: **30 events**, **61** skill assignments.
  - Delta cards and rising/declining skills lists populated as expected based on the mock date distribution.

- **Data quality snapshot**
  - `eventsMissingSkillsField` = **4**
  - `eventsEmptySkillsArray` = **4**
  - `invalidSkillEntriesDropped` = **4**
  - (Events with non-array skills were present only in controlled mock edge cases and counted accordingly.)

These numbers are from the current mock dataset and are intended as a sanity check that the new metrics and layout behave as expected end-to-end.

## 6. Known Limitations / Next Steps

- **Skill search coverage**
  - Current search filters **Top Skills** and **Gaps**, but does not surface all mid-tier skills that fall outside top 10 and above the gap threshold.
  - Next step: consider an additional “All skills” view or pagination so that search can span the full skill universe, not just extremes.

- **Trend percent change edge cases**
  - When the previous 7-day window has zero events or assignments, percent change currently falls back to `0%`.
  - Next step: render this as **“N/A”** or a special state to avoid misinterpreting a division-by-zero fallback as “no change”.

- **Clarify “total skill assignments” definition**
  - Today this is defined as **per-event, de-duplicated normalized skills** (i.e., multiple mentions of the same skill in one event count once).
  - Next step: make this more explicit in the UI copy or add a short “info” tooltip to avoid confusion with raw token/label counts.

- **Controls for gaps and time window**
  - Gap threshold is currently fixed at 2% and the time windows are fixed at “last 7 vs previous 7 days”.
  - Next step (optional polish):
    - Add a **gap threshold selector** (e.g., 1–10%) so teachers can tune sensitivity to gaps.
    - Add a simple **date range filter** or alternative presets (e.g., last 30 days) for more flexible trend analysis.


