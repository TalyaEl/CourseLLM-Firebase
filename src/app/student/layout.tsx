import { AppShell } from '@/components/layout/app-shell';
import {
  GraduationCap,
  LayoutDashboard,
  BookOpen,
} from 'lucide-react';

const studentNavItems = [
  { href: '/student', label: 'Dashboard', icon: <LayoutDashboard /> },
  { href: '/student/courses', label: 'My Courses', icon: <BookOpen /> },
  { href: '/student/assessments', label: 'Assessments', icon: <GraduationCap /> },
];

const user = {
  name: 'Alex Johnson',
  email: 'alex.j@university.edu',
  avatar: 'https://i.pravatar.cc/150?u=student-1',
};

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell navItems={studentNavItems} user={user}>
      {children}
    </AppShell>
  );
}
