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

export interface TeacherIstClassReport {
  courseId: string;
  totalEvents: number;
  eventsWithSkills: number;
  uniqueSkillsCount: number;
  topSkills: TeacherIstClassReportSkillStat[];
  gaps: TeacherIstClassReportSkillStat[];
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

/**
 * Compute a teacher-level IST class report for a specific course.
 *
 * share is defined as: count(skill) / totalSkillAssignments (0–1),
 * NOT per-event share. UI should label this clearly as:
 * "Share (% of all skill assignments)".
 */
export function computeTeacherIstClassReport(
  events: IstEventForReport[],
  courseId: string,
  options: TeacherIstClassReportOptions = {}
): TeacherIstClassReport {
  const { maxSkills = 10, gapThreshold = 0.02 } = options;

  const courseEvents = events.filter((e) => e.courseId === courseId);
  const totalEvents = courseEvents.length;

  const skillFreq = new Map<string, number>();
  let eventsWithSkills = 0;

  for (const ev of courseEvents) {
    const rawSkills = Array.isArray(ev.skills) ? ev.skills : [];
    const normalizedForEvent = new Set<string>();

    for (const raw of rawSkills) {
      const normalized = normalizeSkill(raw);
      if (!normalized) continue;
      normalizedForEvent.add(normalized);
    }

    if (normalizedForEvent.size > 0) {
      eventsWithSkills += 1;
      for (const skill of normalizedForEvent) {
        skillFreq.set(skill, (skillFreq.get(skill) ?? 0) + 1);
      }
    }
  }

  const uniqueSkillsCount = skillFreq.size;

  if (uniqueSkillsCount === 0) {
    return {
      courseId,
      totalEvents,
      eventsWithSkills,
      uniqueSkillsCount: 0,
      topSkills: [],
      gaps: [],
      generatedAt: new Date().toISOString(),
    };
  }

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

  // Top skills: sort by count desc, then skill asc
  const topSkills = [...allSkillsStats]
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.skill.localeCompare(b.skill);
    })
    .slice(0, maxSkills);

  // Gaps: skills with share below threshold, sorted ascending by share then skill
  const gaps = allSkillsStats
    .filter((s) => s.share < gapThreshold)
    .sort((a, b) => {
      if (a.share !== b.share) return a.share - b.share;
      return a.skill.localeCompare(b.skill);
    });

  return {
    courseId,
    totalEvents,
    eventsWithSkills,
    uniqueSkillsCount,
    topSkills,
    gaps,
    generatedAt: new Date().toISOString(),
  };
}


