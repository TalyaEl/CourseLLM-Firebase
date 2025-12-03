import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GraduationCap, School } from 'lucide-react';
import { CourseWiseLogo } from '@/components/icons';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl">
          <CardHeader className="items-center text-center">
            <div className="mb-4 flex items-center gap-3 text-primary">
              <CourseWiseLogo className="h-10 w-10" />
              <h1 className="text-4xl font-bold font-headline">CourseWise</h1>
            </div>
            <CardTitle className="text-xl font-medium text-foreground">
              Enhancing CS Education
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-8 text-center text-muted-foreground">
              Choose your role to get started.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Link href="/student" passHref>
                <Button variant="outline" className="w-full h-24 flex-col gap-2 transform transition-transform duration-200 hover:scale-105 hover:bg-accent/20">
                  <GraduationCap className="h-8 w-8 text-primary" />
                  <span className="text-lg font-semibold">Student</span>
                </Button>
              </Link>
              <Link href="/teacher" passHref>
                <Button variant="outline" className="w-full h-24 flex-col gap-2 transform transition-transform duration-200 hover:scale-105 hover:bg-accent/20">
                  <School className="h-8 w-8 text-primary" />
                  <span className="text-lg font-semibold">Teacher</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
