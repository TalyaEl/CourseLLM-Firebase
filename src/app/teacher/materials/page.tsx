import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ContentUploader } from '@/components/teacher/ContentUploader';
import { FileText, Clock } from 'lucide-react';

const materials = [
    { name: 'Chapter 1 - Intro.pdf', status: 'Indexed', icon: <FileText className="h-4 w-4" /> },
    { name: 'Lecture 2 - Arrays.ppt', status: 'Indexed', icon: <FileText className="h-4 w-4" /> },
    { name: 'Chapter 3 - Recursion.pdf', status: 'Indexing...', icon: <Clock className="h-4 w-4 animate-spin" /> },
];

export default function MaterialsPage() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
            <CardTitle>Course Material Management</CardTitle>
            <CardDescription>
            Upload and manage materials for the RAG indexing system.
            </CardDescription>
        </div>
        <ContentUploader />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              <TableHead className="w-[150px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materials.map((material) => (
              <TableRow key={material.name}>
                <TableCell className="font-medium">{material.name}</TableCell>
                <TableCell>
                  <Badge variant={material.status === 'Indexed' ? 'default' : 'secondary'} className={material.status === 'Indexed' ? 'bg-green-100 text-green-800' : ''}>
                    {material.icon}
                    <span className="ml-2">{material.status}</span>
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
