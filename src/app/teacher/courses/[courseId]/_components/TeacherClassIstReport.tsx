"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  computeTeacherIstClassReport,
  type IstEventForReport,
  type TeacherIstClassReport,
} from "@/features/ist/reports/teacherIstReport";

type Props = {
  courseId: string;
};

type Status = "idle" | "loading" | "success" | "empty" | "error";

export function TeacherClassIstReport({ courseId }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [report, setReport] = useState<TeacherIstClassReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

        const computed = computeTeacherIstClassReport(courseEvents, courseId, {
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

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>IST Class Report</CardTitle>
          <CardDescription>
            Aggregated IST skills overview for this course (no per-student details).
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
            uses mock IST events from the local emulator and does not include any per-student or
            identity details.
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
          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-semibold mb-2">Overview</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">
                    Total IST events (this course)
                  </div>
                  <div className="text-lg font-semibold">{report.totalEvents}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">
                    Events with at least one skill
                  </div>
                  <div className="text-lg font-semibold">{report.eventsWithSkills}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">
                    Unique skills observed
                  </div>
                  <div className="text-lg font-semibold">{report.uniqueSkillsCount}</div>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Share values below are computed as a percentage of{" "}
                <strong>all skill assignments</strong> across IST events, not a percentage of
                events.
              </p>
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-2">Top Skills</h3>
              {report.topSkills.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No skills were detected in IST events for this course.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-1 pr-4">Skill</th>
                        <th className="text-right py-1 pr-4">Count</th>
                        <th className="text-right py-1">Share (% of all skill assignments)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.topSkills.map((s) => (
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
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-2">Potential Skill Gaps</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Skills that appear in fewer than{" "}
                <strong>2% of all skill assignments</strong> across IST events for this course.
              </p>
              {report.gaps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No low-coverage skills detected at the current threshold.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-1 pr-4">Skill</th>
                        <th className="text-right py-1 pr-4">Count</th>
                        <th className="text-right py-1">Share (% of all skill assignments)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.gaps.map((s) => (
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
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


