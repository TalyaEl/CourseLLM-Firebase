/**
 * Pure analytics helpers for teacher-facing IST class reports.
 *
 * These helpers are JSON-first and DataConnect-agnostic. They operate over a
 * simple IstEventForReport[] array and compute deterministic, aggregate
 * statistics for a single course.
 */

export interface IstEventForReport {
  id: string;
  courseId: string;
  createdAt: string;
  // skills may be missing or malformed in the mock dataset, so we keep this loose.
  skills?: unknown;
  // Future-friendly fields from IST / Intent Inspector – currently ignored by v2.
  intent?: unknown;
  trajectory?: unknown;
}

export interface TeacherIstClassReportOptions {
  /**
   * Maximum number of top skills to return.
   * Default: 10
   */
  maxSkills?: number;
  /**
   * Threshold for considering a skill a "gap".
   * Interpreted as share of all skill assignments (0–1).
   * Default: 0.02 (2%).
   */
  gapThreshold?: number;
}

export interface TeacherIstClassReportSkillStat {
  skill: string;
  count: number;
  /**
   * Share of all skill assignments (0–1), not share of events.
   */
  share: number;
}

// V1 report shape (backwards-compatible)
export interface TeacherIstClassReport {
  courseId: string;
  totalEvents: number;
  eventsWithSkills: number;
  uniqueSkillsCount: number;
  topSkills: TeacherIstClassReportSkillStat[];
  gaps: TeacherIstClassReportSkillStat[];
  generatedAt: string;
}

// V2 coverage metrics
export interface TeacherIstClassReportCoverage {
  top1Share: number;
  top5Share: number;
  top10Share: number;
  longTailShare: number;
}

// V2 trend window and delta types
export interface TeacherIstClassReportTrendWindow {
  start: string | null;
  end: string | null;
  events: number;
  skillAssignments: number;
}

export interface TeacherIstClassReportTrendDelta {
  eventsDiff: number;
  skillAssignmentsDiff: number;
  eventsPctChange: number;
  skillAssignmentsPctChange: number;
}

export interface TeacherIstClassReportSkillTrend {
  skill: string;
  last7Count: number;
  prev7Count: number;
  diff: number;
}

export interface TeacherIstClassReportTrends {
  last7Days: TeacherIstClassReportTrendWindow;
  prev7Days: TeacherIstClassReportTrendWindow;
  delta: TeacherIstClassReportTrendDelta;
  risingSkills: TeacherIstClassReportSkillTrend[];
  decliningSkills: TeacherIstClassReportSkillTrend[];
}

// V2 data quality metrics
export interface TeacherIstClassReportDataQuality {
  eventsMissingSkillsField: number;
  eventsSkillsNotArray: number;
  eventsEmptySkillsArray: number;
  invalidSkillEntriesDropped: number;
}

// V2 full report payload
export interface TeacherIstClassReportV2 {
  // Core counts
  courseId: string;
  totalEvents: number;
  eventsWithSkills: number;
  uniqueSkillsCount: number;
  totalSkillAssignments: number;
  avgSkillsPerEvent: number;
  avgSkillsPerSkilledEvent: number;
  firstEventAt: string | null;
  lastEventAt: string | null;

  // Top skills & coverage
  topSkills: TeacherIstClassReportSkillStat[];
  coverage: TeacherIstClassReportCoverage;

  // Gaps
  gapThreshold: number;
  gaps: TeacherIstClassReportSkillStat[];
  gapsCount: number;

  // Trends
  trends: TeacherIstClassReportTrends;

  // Data quality
  dataQuality: TeacherIstClassReportDataQuality;

  // Metadata
  generatedAt: string;
}

/**
 * Normalize a raw skill string into a canonical key.
 *
 * - Trims leading/trailing whitespace
 * - Collapses internal whitespace to a single space
 * - Lowercases
 * - Returns null if the result is empty or only punctuation
 */
export function normalizeSkill(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  // Trim and collapse internal whitespace
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();

  // If, after removing letters/numbers, nothing remains, treat as invalid
  const hasAlnum = /[a-z0-9]/i.test(lower);
  if (!hasAlnum) return null;

  return lower;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function safeParseDate(iso: string | undefined | null): Date | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return new Date(time);
}

/**
 * Compute a UTC day index for a Date (days since Unix epoch).
 */
function getUtcDayIndex(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const utcMs = Date.UTC(year, month, day);
  return Math.floor(utcMs / MS_PER_DAY);
}

function dateFromUtcDayIndex(dayIndex: number): Date {
  return new Date(dayIndex * MS_PER_DAY);
}

/**
 * Compute a teacher-level IST class report v2 for a specific course.
 *
 * share is defined as: count(skill) / totalSkillAssignments (0–1),
 * NOT per-event share. UI should label this clearly as:
 * "Share (% of all skill assignments)".
 */
export function computeTeacherIstClassReportV2(
  events: IstEventForReport[],
  courseId: string,
  options: TeacherIstClassReportOptions = {}
): TeacherIstClassReportV2 {
  const { maxSkills = 10, gapThreshold = 0.02 } = options;

  const courseEvents = events.filter((e) => e.courseId === courseId);
  const totalEvents = courseEvents.length;

  const skillFreq = new Map<string, number>();
  let eventsWithSkills = 0;

  // Data quality counters
  let eventsMissingSkillsField = 0;
  let eventsSkillsNotArray = 0;
  let eventsEmptySkillsArray = 0;
  let invalidSkillEntriesDropped = 0;

  // Track per-event normalized skills and day index for trends.
  interface ProcessedEvent {
    dayIndex: number | null;
    skills: string[]; // normalized, per-event unique
  }

  const processedEvents: ProcessedEvent[] = [];

  let firstDate: Date | null = null;
  let lastDate: Date | null = null;

  for (const ev of courseEvents) {
    const date = safeParseDate(ev.createdAt);
    const dayIndex = date ? getUtcDayIndex(date) : null;

    if (date) {
      if (!firstDate || date < firstDate) {
        firstDate = date;
      }
      if (!lastDate || date > lastDate) {
        lastDate = date;
      }
    }

    const hasSkillsField = Object.prototype.hasOwnProperty.call(ev, "skills");
    if (!hasSkillsField) {
      eventsMissingSkillsField += 1;
    }

    let rawSkills: unknown[] = [];

    if (Array.isArray(ev.skills)) {
      rawSkills = ev.skills;
      if (rawSkills.length === 0) {
        eventsEmptySkillsArray += 1;
      }
    } else if (hasSkillsField && ev.skills !== undefined) {
      // skills is present but not an array
      eventsSkillsNotArray += 1;
    }

    const normalizedForEvent = new Set<string>();

    if (Array.isArray(rawSkills)) {
      for (const raw of rawSkills) {
        const normalized = normalizeSkill(raw);
        if (!normalized) {
          invalidSkillEntriesDropped += 1;
          continue;
        }
        normalizedForEvent.add(normalized);
      }
    }

    if (normalizedForEvent.size > 0) {
      eventsWithSkills += 1;
      for (const skill of normalizedForEvent) {
        skillFreq.set(skill, (skillFreq.get(skill) ?? 0) + 1);
      }
    }

    processedEvents.push({
      dayIndex,
      skills: Array.from(normalizedForEvent),
    });
  }

  const uniqueSkillsCount = skillFreq.size;

  const totalSkillAssignments = Array.from(skillFreq.values()).reduce(
    (sum, count) => sum + count,
    0
  );

  const allSkillsStats: TeacherIstClassReportSkillStat[] = Array.from(
    skillFreq.entries()
  ).map(([skill, count]) => ({
    skill,
    count,
    share: totalSkillAssignments > 0 ? count / totalSkillAssignments : 0,
  }));

  // Core averages
  const avgSkillsPerEvent =
    totalEvents > 0 ? totalSkillAssignments / totalEvents : 0;
  const avgSkillsPerSkilledEvent =
    eventsWithSkills > 0 ? totalSkillAssignments / eventsWithSkills : 0;

  const firstEventAt = firstDate ? firstDate.toISOString() : null;
  const lastEventAt = lastDate ? lastDate.toISOString() : null;

  // Top skills: sort by count desc, then skill asc
  const sortedByCountDesc = [...allSkillsStats].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.skill.localeCompare(b.skill);
  });

  const topSkills = sortedByCountDesc.slice(0, maxSkills);

  // Coverage metrics
  const top1Share = sortedByCountDesc[0]?.share ?? 0;
  const top5Share = sortedByCountDesc
    .slice(0, 5)
    .reduce((sum, s) => sum + s.share, 0);
  const top10Share = sortedByCountDesc
    .slice(0, 10)
    .reduce((sum, s) => sum + s.share, 0);
  const longTailShare = Math.max(0, Math.min(1, 1 - top10Share));

  const coverage: TeacherIstClassReportCoverage = {
    top1Share,
    top5Share,
    top10Share,
    longTailShare,
  };

  // Gaps: skills with share below threshold, sorted ascending by share then skill
  const gaps = allSkillsStats
    .filter((s) => s.share < gapThreshold)
    .sort((a, b) => {
      if (a.share !== b.share) return a.share - b.share;
      return a.skill.localeCompare(b.skill);
    });

  const gapsCount = gaps.length;

  // Trends (last 7 days vs previous 7 days) based on createdAt
  let trends: TeacherIstClassReportTrends;

  if (!lastDate) {
    // No valid dates – return zeroed trend metrics.
    const emptyWindow: TeacherIstClassReportTrendWindow = {
      start: null,
      end: null,
      events: 0,
      skillAssignments: 0,
    };
    const zeroDelta: TeacherIstClassReportTrendDelta = {
      eventsDiff: 0,
      skillAssignmentsDiff: 0,
      eventsPctChange: 0,
      skillAssignmentsPctChange: 0,
    };
    trends = {
      last7Days: emptyWindow,
      prev7Days: emptyWindow,
      delta: zeroDelta,
      risingSkills: [],
      decliningSkills: [],
    };
  } else {
    const baseDayIndex = getUtcDayIndex(lastDate);
    const last7StartIndex = baseDayIndex - 6;
    const prev7StartIndex = baseDayIndex - 13;
    const prev7EndIndex = baseDayIndex - 7;

    let last7Events = 0;
    let last7SkillAssignments = 0;
    let prev7Events = 0;
    let prev7SkillAssignments = 0;

    const skillTrendFreq = new Map<string, { last7: number; prev7: number }>();

    for (const ev of processedEvents) {
      if (ev.dayIndex == null) continue;
      const idx = ev.dayIndex;

      if (idx >= last7StartIndex && idx <= baseDayIndex) {
        last7Events += 1;
        last7SkillAssignments += ev.skills.length;
        for (const skill of ev.skills) {
          const current = skillTrendFreq.get(skill) ?? { last7: 0, prev7: 0 };
          current.last7 += 1;
          skillTrendFreq.set(skill, current);
        }
      } else if (idx >= prev7StartIndex && idx <= prev7EndIndex) {
        prev7Events += 1;
        prev7SkillAssignments += ev.skills.length;
        for (const skill of ev.skills) {
          const current = skillTrendFreq.get(skill) ?? { last7: 0, prev7: 0 };
          current.prev7 += 1;
          skillTrendFreq.set(skill, current);
        }
      }
    }

    const last7Days: TeacherIstClassReportTrendWindow = {
      start: dateFromUtcDayIndex(last7StartIndex).toISOString(),
      end: dateFromUtcDayIndex(baseDayIndex).toISOString(),
      events: last7Events,
      skillAssignments: last7SkillAssignments,
    };

    const prev7Days: TeacherIstClassReportTrendWindow = {
      start: dateFromUtcDayIndex(prev7StartIndex).toISOString(),
      end: dateFromUtcDayIndex(prev7EndIndex).toISOString(),
      events: prev7Events,
      skillAssignments: prev7SkillAssignments,
    };

    const eventsDiff = last7Events - prev7Events;
    const skillAssignmentsDiff = last7SkillAssignments - prev7SkillAssignments;

    const eventsPctChange =
      prev7Events === 0 ? 0 : eventsDiff / prev7Events;
    const skillAssignmentsPctChange =
      prev7SkillAssignments === 0
        ? 0
        : skillAssignmentsDiff / prev7SkillAssignments;

    const delta: TeacherIstClassReportTrendDelta = {
      eventsDiff,
      skillAssignmentsDiff,
      eventsPctChange,
      skillAssignmentsPctChange,
    };

    const risingSkills: TeacherIstClassReportSkillTrend[] = [];
    const decliningSkills: TeacherIstClassReportSkillTrend[] = [];

    for (const [skill, counts] of skillTrendFreq.entries()) {
      const riseDiff = counts.last7 - counts.prev7;
      if (riseDiff > 0) {
        risingSkills.push({
          skill,
          last7Count: counts.last7,
          prev7Count: counts.prev7,
          diff: riseDiff,
        });
      }
      const declineDiff = counts.prev7 - counts.last7;
      if (declineDiff > 0) {
        decliningSkills.push({
          skill,
          last7Count: counts.last7,
          prev7Count: counts.prev7,
          diff: declineDiff,
        });
      }
    }

    risingSkills.sort((a, b) => {
      if (b.diff !== a.diff) return b.diff - a.diff;
      return a.skill.localeCompare(b.skill);
    });

    decliningSkills.sort((a, b) => {
      if (b.diff !== a.diff) return b.diff - a.diff;
      return a.skill.localeCompare(b.skill);
    });

    trends = {
      last7Days,
      prev7Days,
      delta,
      risingSkills: risingSkills.slice(0, 5),
      decliningSkills: decliningSkills.slice(0, 5),
    };
  }

  const dataQuality: TeacherIstClassReportDataQuality = {
    eventsMissingSkillsField,
    eventsSkillsNotArray,
    eventsEmptySkillsArray,
    invalidSkillEntriesDropped,
  };

  return {
    courseId,
    totalEvents,
    eventsWithSkills,
    uniqueSkillsCount,
    totalSkillAssignments,
    avgSkillsPerEvent,
    avgSkillsPerSkilledEvent,
    firstEventAt,
    lastEventAt,
    topSkills,
    coverage,
    gapThreshold,
    gaps,
    gapsCount,
    trends,
    dataQuality,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Backwards-compatible v1 helper that returns a subset of the v2 metrics.
 */
export function computeTeacherIstClassReport(
  events: IstEventForReport[],
  courseId: string,
  options: TeacherIstClassReportOptions = {}
): TeacherIstClassReport {
  const v2 = computeTeacherIstClassReportV2(events, courseId, options);

  return {
    courseId: v2.courseId,
    totalEvents: v2.totalEvents,
    eventsWithSkills: v2.eventsWithSkills,
    uniqueSkillsCount: v2.uniqueSkillsCount,
    topSkills: v2.topSkills,
    gaps: v2.gaps,
    generatedAt: v2.generatedAt,
  };
}
