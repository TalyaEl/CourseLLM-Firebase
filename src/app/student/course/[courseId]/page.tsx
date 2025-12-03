import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SocraticChat } from '@/components/student/SocraticChat';
import { PracticeQuiz } from '@/components/student/PracticeQuiz';
import { TopicMastery } from '@/components/student/TopicMastery';
import { COURSES } from '@/lib/data';
import { notFound } from 'next/navigation';
import { MessageSquare, Puzzle } from 'lucide-react';

export default function CoursePage({ params }: { params: { courseId: string } }) {
  const course = COURSES.find((c) => c.id === params.courseId);

  if (!course) {
    notFound();
  }

  return (
    <div className="flex flex-col">
       <h1 className="text-3xl font-bold tracking-tight mb-6">{course.name}</h1>
      <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="chat">
            <TabsList className="grid w-full grid-cols-2 h-12">
              <TabsTrigger value="chat" className="h-10 text-base">
                <MessageSquare className="mr-2 h-5 w-5"/>
                Socratic Chat
                </TabsTrigger>
              <TabsTrigger value="quiz" className="h-10 text-base">
                <Puzzle className="mr-2 h-5 w-5" />
                Practice Quiz
              </TabsTrigger>
            </TabsList>
            <TabsContent value="chat" className="mt-6">
              <SocraticChat courseName={course.name} />
            </TabsContent>
            <TabsContent value="quiz" className="mt-6">
              <PracticeQuiz />
            </TabsContent>
          </Tabs>
        </div>
        <div className="lg:col-span-1">
          <TopicMastery />
        </div>
      </div>
    </div>
  );
}
