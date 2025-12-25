import { CourseCard } from '@/components/student/CourseCard';
import { COURSES } from '@/lib/data';

export default function StudentDashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-6">My Courses</h1>
      <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {COURSES.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </div>
  );
}
