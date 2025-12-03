import Link from 'next/link';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Course } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { ArrowRight } from 'lucide-react';

type CourseCardProps = {
  course: Course;
};

export function CourseCard({ course }: CourseCardProps) {
  const placeholder = PlaceHolderImages.find((p) => p.id === course.image);

  return (
    <Card className="flex flex-col h-full overflow-hidden transition-all hover:shadow-lg">
      <CardHeader className="p-0">
        {placeholder && (
          <div className="aspect-[3/2] w-full overflow-hidden">
            <Image
              src={placeholder.imageUrl}
              alt={placeholder.description}
              width={600}
              height={400}
              className="object-cover w-full h-full"
              data-ai-hint={placeholder.imageHint}
            />
          </div>
        )}
        <div className="p-6">
          <CardTitle>{course.name}</CardTitle>
          <CardDescription className="pt-2">{course.description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-grow" />
      <CardFooter>
        <Button asChild className="w-full">
          <Link href={`/student/course/${course.id}`}>
            Go to course <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
