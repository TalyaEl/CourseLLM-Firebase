'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload } from 'lucide-react';

export function ContentUploader() {
  const { toast } = useToast();

  const handleUpload = () => {
    // This is a mock for the prototype.
    toast({
      title: 'File Upload',
      description: 'In a real app, this would open a file dialog.',
    });
  };

  return (
    <Button onClick={handleUpload}>
      <Upload className="mr-2 h-4 w-4" />
      Upload Files
    </Button>
  );
}
