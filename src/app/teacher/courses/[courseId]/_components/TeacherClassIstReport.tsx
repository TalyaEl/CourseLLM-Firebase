"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  computeTeacherIstClassReportV2,
  type IstEventForReport,
  type TeacherIstClassReportV2,
} from "@/features/ist/reports/teacherIstReport";

type Props = {
  courseId: string;
};

type Status = "idle" | "loading" | "success" | "empty" | "error";

export function TeacherClassIstReport({ courseId }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [report, setReport] = useState<TeacherIstClassReportV2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [skillSearch, setSkillSearch] = useState<string>("");
  const [showAllGaps, setShowAllGaps] = useState<boolean>(false);

  const isLoading = status === "loading" || isPending;

  const handleGenerate = () => {
    setError(null);
    setStatus("loading");

    startTransition(async () => {
      try {
        const res = await fetch("/mocks/ist/teacher-class-events.json", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`Failed to load IST mock dataset (status ${res.status})`);
        }

        const data = (await res.json()) as IstEventForReport[];
        const courseEvents = data.filter((e) => e.courseId === courseId);

        const computed = computeTeacherIstClassReportV2(courseEvents, courseId, {
          maxSkills: 10,
          gapThreshold: 0.02,
        });

        if (computed.totalEvents === 0) {
          setReport(null);
          setStatus("empty");
          return;
        }

        setReport(computed);
        setStatus("success");
      } catch (err: any) {
        console.error("[TeacherClassIstReport] Failed to generate report", err);
        setError(err?.message ?? "Unknown error while generating IST class report");
        setReport(null);
        setStatus("error");
      }
    });
  };

  const eventsWithSkillsPct =
    report && report.totalEvents > 0
      ? (report.eventsWithSkills / report.totalEvents) * 100
      : 0;

  const topSkill = report?.topSkills[0] ?? null;

  const normalizedSearch = skillSearch.trim().toLowerCase();

  const filteredTopSkills = useMemo(() => {
    if (!report) return [];
    if (!normalizedSearch) return report.topSkills;
    return report.topSkills.filter((s) =>
      s.skill.toLowerCase().includes(normalizedSearch)
    );
  }, [report, normalizedSearch]);

  const filteredGaps = useMemo(() => {
    if (!report) return [];
    if (!normalizedSearch) return report.gaps;
    return report.gaps.filter((s) =>
      s.skill.toLowerCase().includes(normalizedSearch)
    );
  }, [report, normalizedSearch]);

  const visibleGaps = useMemo(() => {
    if (!report) return [];
    if (showAllGaps) return filteredGaps;
    return filteredGaps.slice(0, 20);
  }, [report, filteredGaps, showAllGaps]);

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>IST Class Report</CardTitle>
          <CardDescription>
            Aggregated IST overview for this course. No per-student identifiers, messages, or
            identities are shown.
          </CardDescription>
        </div>
        <Button onClick={handleGenerate} disabled={isLoading}>
          {isLoading ? "Generating..." : "Generate IST Class Report"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "idle" && (
          <p className="text-sm text-muted-foreground">
            Click the button above to generate the latest IST class report for this course. This view
            uses mock IST events from the local emulator and only shows course-level aggregates.
          </p>
        )}

        {status === "loading" && (
          <p className="text-sm text-muted-foreground">
            Generating IST class report&hellip;
          </p>
        )}

        {status === "empty" && (
          <Alert>
            <AlertTitle>No IST events found</AlertTitle>
            <AlertDescription>
              There are currently no IST events for this course in the mock dataset. Try generating
              new activity in the emulator and click the button again.
            </AlertDescription>
          </Alert>
        )}

        {status === "error" && (
          <Alert variant="destructive">
            <AlertTitle>Could not generate report</AlertTitle>
            <AlertDescription>
              {error ??
                "An unexpected error occurred while loading the IST mock dataset. Please check the JSON file format and try again."}
            </AlertDescription>
          </Alert>
        )}

        {status === "success" && report && (
          <div className="space-y-8">
            {/* Executive Summary */}
            <section>
              <h3 className="text-sm font-semibold mb-3">Executive Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div className="rounded-md border p-3 space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">Total events</div>
                  <div className="text-lg font-semibold">{report.totalEvents}</div>
                </div>
                <div className="rounded-md border p-3 space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">
                    Events with skills
                  </div>
                  <div className="text-lg font-semibold">
                    {report.eventsWithSkills}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({eventsWithSkillsPct.toFixed(1)}
                      {"%"})
                    </span>
                  </div>
                </div>
                <div className="rounded-md border p-3 space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">Unique skills</div>
                  <div className="text-lg font-semibold">{report.uniqueSkillsCount}</div>
                </div>
                <div className="rounded-md border p-3 space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">
                    Total skill assignments
                  </div>
                  <div className="text-lg font-semibold">{report.totalSkillAssignments}</div>
                </div>
                <div className="rounded-md border p-3 space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">
                    Avg skills / skilled event
                  </div>
                  <div className="text-lg font-semibold">
                    {report.avgSkillsPerSkilledEvent.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-md border p-3 space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">Top skill</div>
                  {topSkill ? (
                    <div className="text-lg font-semibold">
                      {topSkill.skill}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({(topSkill.share * 100).toFixed(1)}
                        {"% of assignments"})
                      </span>
                    </div>
                  ) : (
                    <div className="text-lg font-semibold text-muted-foreground">—</div>
                  )}
                </div>
                <div className="rounded-md border p-3 space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">
                    Top 10 concentration
                  </div>
                  <div className="text-lg font-semibold">
                    {(report.coverage.top10Share * 100).toFixed(1)}
                    {"%"}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Share of all skill assignments accounted for by the top 10 skills.
                  </p>
                </div>
                <div className="rounded-md border p-3 space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">Observation window</div>
                  <div className="text-xs text-muted-foreground">
                    {report.firstEventAt && report.lastEventAt
                      ? `${new Date(report.firstEventAt).toLocaleDateString()} – ${new Date(
                          report.lastEventAt
                        ).toLocaleDateString()}`
                      : "N/A"}
                  </div>
                </div>
              </div>
            </section>

            {/* Trends */}
            <section className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <h3 className="text-sm font-semibold">Trends (Last 7 days vs Previous 7)</h3>
                <p className="text-xs text-muted-foreground">
                  Windows are computed using event timestamps (UTC); this is a coarse directional
                  signal, not a formal experiment.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
                {/* Summary table */}
                <div className="lg:col-span-1 rounded-md border p-3">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b text-[11px] text-muted-foreground">
                        <th className="text-left py-1 pr-2" />
                        <th className="text-right py-1 pr-2">Events</th>
                        <th className="text-right py-1">Skill assignments</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b last:border-0">
                        <td className="py-1 pr-2 font-medium">Last 7 days</td>
                        <td className="py-1 pr-2 text-right">
                          {report.trends.last7Days.events}
                        </td>
                        <td className="py-1 text-right">
                          {report.trends.last7Days.skillAssignments}
                        </td>
                      </tr>
                      <tr className="border-b last:border-0">
                        <td className="py-1 pr-2 font-medium">Prev 7 days</td>
                        <td className="py-1 pr-2 text-right">
                          {report.trends.prev7Days.events}
                        </td>
                        <td className="py-1 text-right">
                          {report.trends.prev7Days.skillAssignments}
                        </td>
                      </tr>
                      <tr className="border-b last:border-0">
                        <td className="py-1 pr-2 font-medium">Δ (relative)</td>
                        <td className="py-1 pr-2 text-right">
                          {(report.trends.delta.eventsPctChange * 100).toFixed(1)}
                          {"%"}
                        </td>
                        <td className="py-1 text-right">
                          {(report.trends.delta.skillAssignmentsPctChange * 100).toFixed(1)}
                          {"%"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Rising / declining skills */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="text-xs uppercase text-emerald-600 dark:text-emerald-400">
                      Rising skills (top 5)
                    </div>
                    {report.trends.risingSkills.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No skills increased in frequency compared to the previous 7 days.
                      </p>
                    ) : (
                      <ul className="space-y-1 text-xs">
                        {report.trends.risingSkills.map((s) => (
                          <li
                            key={s.skill}
                            className="flex items-center justify-between border-b last:border-0 py-1"
                          >
                            <span>{s.skill}</span>
                            <span className="text-muted-foreground">
                              +{s.diff} ({s.prev7Count} → {s.last7Count})
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="text-xs uppercase text-red-600 dark:text-red-400">
                      Declining skills (top 5)
                    </div>
                    {report.trends.decliningSkills.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No skills decreased in frequency compared to the previous 7 days.
                      </p>
                    ) : (
                      <ul className="space-y-1 text-xs">
                        {report.trends.decliningSkills.map((s) => (
                          <li
                            key={s.skill}
                            className="flex items-center justify-between border-b last:border-0 py-1"
                          >
                            <span>{s.skill}</span>
                            <span className="text-muted-foreground">
                              -{s.diff} ({s.prev7Count} → {s.last7Count})
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Skill search + tables */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-sm font-semibold">Skills</h3>
                <div className="flex items-center gap-2 w-full sm:w-72">
                  <input
                    type="text"
                    value={skillSearch}
                    onChange={(e) => setSkillSearch(e.target.value)}
                    placeholder="Search skills…"
                    className="flex-1 rounded-md border px-2 py-1 text-sm bg-background"
                  />
                </div>
              </div>

              {/* Top skills */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                  Top skills (by frequency)
                </h4>
                {filteredTopSkills.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No skills match the current filters.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="text-left py-1 pr-4">Skill</th>
                          <th className="text-right py-1 pr-4">Count</th>
                          <th className="text-right py-1">
                            Share (% of all skill assignments)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTopSkills.map((s) => (
                          <tr key={s.skill} className="border-b last:border-0">
                            <td className="py-1 pr-4">{s.skill}</td>
                            <td className="py-1 pr-4 text-right">{s.count}</td>
                            <td className="py-1 text-right">
                              {(s.share * 100).toFixed(1)}
                              {"%"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Shares are computed over{" "}
                  <strong>all skill assignments</strong> across IST events, not a percentage of
                  events.
                </p>
              </div>

              {/* Gaps */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                      Potential skill gaps
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Skills that appear in fewer than{" "}
                      <strong>{(report.gapThreshold * 100).toFixed(1)}%</strong> of all skill
                      assignments for this course.
                    </p>
                  </div>
                  {filteredGaps.length > 20 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllGaps((v) => !v)}
                    >
                      {showAllGaps
                        ? "Show first 20"
                        : `Show all (${filteredGaps.length.toString()})`}
                    </Button>
                  )}
                </div>

                {visibleGaps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No low-coverage skills detected at the current threshold and filters.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="text-left py-1 pr-4">Skill</th>
                          <th className="text-right py-1 pr-4">Count</th>
                          <th className="text-right py-1">
                            Share (% of all skill assignments)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleGaps.map((s) => (
                          <tr key={s.skill} className="border-b last:border-0">
                            <td className="py-1 pr-4">{s.skill}</td>
                            <td className="py-1 pr-4 text-right">{s.count}</td>
                            <td className="py-1 text-right">
                              {(s.share * 100).toFixed(2)}
                              {"%"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            {/* Data quality */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Data quality</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div className="rounded-md border p-3 space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">
                    Events missing skills field
                  </div>
                  <div className="text-lg font-semibold">
                    {report.dataQuality.eventsMissingSkillsField}
                  </div>
                </div>
                <div className="rounded-md border p-3 space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">
                    Events with non-array skills
                  </div>
                  <div className="text-lg font-semibold">
                    {report.dataQuality.eventsSkillsNotArray}
                  </div>
                </div>
                <div className="rounded-md border p-3 space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">
                    Events with empty skills array
                  </div>
                  <div className="text-lg font-semibold">
                    {report.dataQuality.eventsEmptySkillsArray}
                  </div>
                </div>
                <div className="rounded-md border p-3 space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">
                    Invalid skill entries dropped
                  </div>
                  <div className="text-lg font-semibold">
                    {report.dataQuality.invalidSkillEntriesDropped}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                These metrics help you assess how clean and complete the underlying IST signals are
                before drawing conclusions from the report.
              </p>
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


