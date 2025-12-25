import {
  computeTeacherIstClassReportV2,
  IstEventForReport,
  normalizeSkill,
} from "./teacherIstReport";

describe("normalizeSkill", () => {
  it("trims, collapses whitespace, and lowercases", () => {
    expect(normalizeSkill("  Arrays  ")).toBe("arrays");
    expect(normalizeSkill(" linked   lists ")).toBe("linked lists");
  });

  it("returns null for non-string or punctuation-only inputs", () => {
    expect(normalizeSkill(123 as unknown as string)).toBeNull();
    expect(normalizeSkill("!\t ")).toBeNull();
    expect(normalizeSkill("   ")).toBeNull();
  });
});

describe("computeTeacherIstClassReportV2 – core metrics", () => {
  const baseEvents: IstEventForReport[] = [
    {
      id: "1",
      courseId: "c1",
      createdAt: "2025-01-10T10:00:00.000Z",
      skills: ["A", "A", "B"],
    },
    {
      id: "2",
      courseId: "c1",
      createdAt: "2025-01-11T10:00:00.000Z",
      skills: ["b", "C"],
    },
  ];

  it("computes totalSkillAssignments and averages correctly", () => {
    const report = computeTeacherIstClassReportV2(baseEvents, "c1");

    // Per-event unique normalized skills:
    // ev1: {a, b}, ev2: {b, c} => a:1, b:2, c:1 => total = 4
    expect(report.totalSkillAssignments).toBe(4);
    expect(report.totalEvents).toBe(2);
    expect(report.eventsWithSkills).toBe(2);

    expect(report.avgSkillsPerEvent).toBe(4 / 2);
    expect(report.avgSkillsPerSkilledEvent).toBe(4 / 2);
  });

  it("computes coverage metrics based on skill shares", () => {
    const report = computeTeacherIstClassReportV2(baseEvents, "c1");

    // From above: a:1, b:2, c:1 => total 4, so shares: a=0.25, b=0.5, c=0.25
    expect(report.coverage.top1Share).toBeCloseTo(0.5);
    expect(report.coverage.top5Share).toBeCloseTo(1);
    expect(report.coverage.top10Share).toBeCloseTo(1);
    expect(report.coverage.longTailShare).toBeCloseTo(0);
  });
});

describe("computeTeacherIstClassReportV2 – trends", () => {
  it("computes last7 vs prev7 windows and rising/declining skills", () => {
    const events: IstEventForReport[] = [
      // Last 7 days window (anchor on 2025-01-14)
      {
        id: "1",
        courseId: "c1",
        createdAt: "2025-01-14T10:00:00.000Z",
        skills: ["skill-a"],
      },
      {
        id: "2",
        courseId: "c1",
        createdAt: "2025-01-10T10:00:00.000Z",
        skills: ["skill-a", "skill-b"],
      },
      // Previous 7 days window
      {
        id: "3",
        courseId: "c1",
        createdAt: "2025-01-07T10:00:00.000Z",
        skills: ["skill-a", "skill-b"],
      },
      {
        id: "4",
        courseId: "c1",
        createdAt: "2025-01-05T10:00:00.000Z",
        skills: ["skill-b"],
      },
    ];

    const report = computeTeacherIstClassReportV2(events, "c1");

    // Events: last7 has 2, prev7 has 2
    expect(report.trends.last7Days.events).toBe(2);
    expect(report.trends.prev7Days.events).toBe(2);

    // Skill assignments: per-event unique skills
    // last7: ev1 {a}, ev2 {a,b} => 3
    // prev7: ev3 {a,b}, ev4 {b} => 3
    expect(report.trends.last7Days.skillAssignments).toBe(3);
    expect(report.trends.prev7Days.skillAssignments).toBe(3);

    // Rising/declining skills
    const rising = report.trends.risingSkills;
    const declining = report.trends.decliningSkills;

    // skill-a appears 2 times in last7 and 1 in prev7 => diff = +1 => rising
    const risingA = rising.find((s) => s.skill === "skill-a");
    expect(risingA).toBeDefined();
    expect(risingA?.last7Count).toBe(2);
    expect(risingA?.prev7Count).toBe(1);

    // skill-b appears 1 time in last7 and 2 in prev7 => diff = +1 for prev7 => declining
    const decliningB = declining.find((s) => s.skill === "skill-b");
    expect(decliningB).toBeDefined();
    expect(decliningB?.last7Count).toBe(1);
    expect(decliningB?.prev7Count).toBe(2);
  });
});

*** End Patch}]}*** End Patch

*** End Patch

*** End Patch}]}*** End Patch

*** End Patch

*** End Patch}]}*** End Patch

*** End Patch

*** End Patch}]}*** End Patch

*** End Patch

*** End Patch}]}*** End Patch

*** End Patch

*** End Patch}]}*** End Patch


