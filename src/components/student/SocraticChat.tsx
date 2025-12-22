'use client';

import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, User, Send, Quote, Loader } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { INITIAL_CHAT_MESSAGES, SOCRATIC_RESPONSE } from '@/lib/data';
import { provideSocraticGuidance } from '@/ai/flows/provide-socratic-guidance';
import type { ChatMessage } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export function SocraticChat({ courseName }: { courseName: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (input.trim() === '') return;

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: input,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const loadingMessage: ChatMessage = {
      id: Date.now() + 1,
      role: 'assistant',
      content: '',
      isLoading: true
    };
    setMessages((prev) => [...prev, loadingMessage]);

    try {
      // In a real app, you might select the topic dynamically
      const result = await provideSocraticGuidance({ question: input, courseName, topic: 'Data Structures' });
      
      const assistantMessage: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: result.guidance,
        citations: result.citations,
      };

      setMessages((prev) => prev.map(m => m.isLoading ? assistantMessage : m));
    } catch (error) {
      console.error("AI Error:", error);
      toast({
        variant: "destructive",
        title: "Oh no! Something went wrong.",
        description: "There was a problem communicating with the AI. Please try again.",
      });
      setMessages((prev) => prev.filter(m => !m.isLoading));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="h-[70vh] flex flex-col">
      <CardHeader>
        <CardTitle>Socratic Tutor</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <ScrollArea className="h-full pr-4">
          <div className="space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex items-start gap-4',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <Avatar className="h-9 w-9 border">
                    <AvatarFallback><Bot/></AvatarFallback>
                  </Avatar>
                )}
                <div className={cn('max-w-[75%] space-y-2', message.role === 'user' ? 'order-1' : 'order-2')}>
                  <div
                    className={cn(
                      'p-3 rounded-lg',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {message.isLoading ? (
                      <div className="flex items-center space-x-2">
                        <Loader className="h-5 w-5 animate-spin" />
                        <span>Thinking...</span>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                  {message.citations && message.citations.length > 0 && (
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="item-1">
                        <AccordionTrigger className="text-sm text-muted-foreground hover:no-underline">
                          <Quote className="mr-2 h-4 w-4" />
                          View Citations
                        </AccordionTrigger>
                        <AccordionContent>
                          <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1">
                            {message.citations.map((citation, index) => (
                              <li key={index}>{citation}</li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </div>
                {message.role === 'user' && (
                  <Avatar className="h-9 w-9 border order-2">
                    <AvatarFallback><User/></AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="pt-4 border-t">
        <div className="flex w-full items-center space-x-2">
          <Textarea
            placeholder="Ask a question about your course..."
            className="flex-1 resize-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={isLoading || input.trim() === ''}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
