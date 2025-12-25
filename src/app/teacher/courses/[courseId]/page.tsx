import { getCourseById } from '@/lib/mock-data';
import { notFound } from 'next/navigation';
import { CourseManagementClient } from './_components/course-management-client';

export default async function ManageCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = getCourseById(courseId);

  if (!course) {
    notFound();
  }

  return <CourseManagementClient course={course} />;
}
