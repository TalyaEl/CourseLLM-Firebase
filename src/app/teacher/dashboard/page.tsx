import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Users, BarChart3, AlertTriangle } from 'lucide-react';
import { AnalyticsChart } from '@/components/teacher/AnalyticsChart';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function TeacherDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Analytics Overview</h1>
        <Button asChild>
            <Link href="/teacher/materials">Manage Course Materials</Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Students
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">128</div>
            <p className="text-xs text-muted-foreground">
              in CS 101: Data Structures
            </p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              At-Risk Students
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              Based on mastery levels below 50%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Most Practiced Topic
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Recursion</div>
            <p className="text-xs text-muted-foreground">
              +18% from last week
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Average Mastery Level per Topic</CardTitle>
          <CardDescription>
            Anonymized class-wide average mastery scores for each topic.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnalyticsChart />
        </CardContent>
      </Card>
    </div>
  );
}
