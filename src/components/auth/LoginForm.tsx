import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, School } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LoginForm() {
  return (
    <Card className="w-full max-w-3xl shadow-2xl">
      <CardHeader className="text-center">
        <CardTitle className="text-4xl font-bold text-primary">CourseCompanion</CardTitle>
        <CardDescription className="text-lg">Your AI-powered Socratic learning assistant.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
        <Link href="/student/dashboard" passHref>
          <Card className="group hover:border-accent hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col items-center text-center p-6 h-full">
            <CardHeader>
              <GraduationCap className="h-16 w-16 mx-auto text-primary group-hover:text-accent transition-colors duration-300" />
              <CardTitle className="mt-4 text-2xl">Student</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Access your courses, chat with your Socratic tutor, and practice your skills.</p>
              <Button variant="ghost" className="mt-4">
                Enter as Student
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/teacher/dashboard" passHref>
          <Card className="group hover:border-accent hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col items-center text-center p-6 h-full">
            <CardHeader>
              <School className="h-16 w-16 mx-auto text-primary group-hover:text-accent transition-colors duration-300" />
              <CardTitle className="mt-4 text-2xl">Teacher</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Manage course materials and view student analytics dashboard.</p>
              <Button variant="ghost" className="mt-4">
                Enter as Teacher
              </Button>
            </CardContent>
          </Card>
        </Link>
      </CardContent>
    </Card>
  );
}
