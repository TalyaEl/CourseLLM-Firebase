import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TOPICS } from '@/lib/data';
import type { Topic } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

const masteryConfig = {
  strong: {
    label: 'Strong',
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800',
    icon: <CheckCircle2 className="mr-1 h-3 w-3" />,
  },
  needs_practice: {
    label: 'Needs Practice',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800',
    icon: <AlertCircle className="mr-1 h-3 w-3" />,
  },
  weak: {
    label: 'Weak',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800',
    icon: <XCircle className="mr-1 h-3 w-3" />,
  },
};

export function TopicMastery() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Topic Mastery</CardTitle>
        <CardDescription>Your progress on course topics.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {TOPICS.map((topic: Topic) => {
            const config = masteryConfig[topic.mastery];
            return (
              <li key={topic.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="font-medium">{topic.name}</span>
                <Badge variant="outline" className={cn('text-xs', config.className)}>
                  {config.icon}
                  {config.label}
                </Badge>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
