'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { TOPICS } from '@/lib/data';
import type { QuizQuestion } from '@/lib/types';
// Note: We're now using the DSPy service instead of the Genkit flow
// import { generatePracticeQuiz } from '@/ai/flows/generate-practice-quiz';
import { useToast } from '@/hooks/use-toast';

type QuizState = 'initial' | 'loading' | 'active' | 'submitted';

// NOTE: This function is no longer used since we now get structured JSON from DSPy service.
// Kept for reference/fallback. The new flow uses structured JSON with correctIndex.
// Helper function to parse the AI-generated quiz string (legacy Genkit format)
function parseQuiz(quizString: string): QuizQuestion[] {
  try {
    const questions: QuizQuestion[] = [];
    const questionBlocks = quizString.split(/\d+\.\s+/).filter(Boolean);

    questionBlocks.forEach((block, index) => {
      const lines = block.trim().split('\n');
      const questionText = lines[0];
      const options = lines.slice(1, -1).map(line => line.replace(/^[a-d]\)\s*/, ''));
      const correctAnswerLine = lines.slice(-1)[0];
      const correctAnswerMatch = correctAnswerLine.match(/Correct Answer: [a-d]\) (.+)/);
      const correctAnswer = correctAnswerMatch ? correctAnswerMatch[1] : '';

      if (questionText && options.length > 0 && correctAnswer) {
        questions.push({
          id: `q${index + 1}`,
          question: questionText,
          options: options,
          correctAnswer: correctAnswer,
        });
      }
    });
    return questions;
  } catch (error) {
    console.error('Failed to parse quiz string:', error);
    return [];
  }
}

export function PracticeQuiz() {
  const [quizState, setQuizState] = useState<QuizState>('initial');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState<number | null>(null);
  const { toast } = useToast();

  const handleGenerateQuiz = async () => {
    if (!selectedTopic) return;
    setQuizState('loading');
    
    try {
        // Call the new DSPy service via Next.js API route
        const response = await fetch('/api/dspy/quiz', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            topic: selectedTopic,
            level: 'medium', // Default level, can be made configurable later
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.detail || 'Failed to generate quiz');
        }

        const result = await response.json();
        
        // Transform DSPy response to match QuizQuestion format
        // DSPy returns: { questions: [{ question, options, correctIndex }] }
        // Component expects: QuizQuestion[] with { id, question, options, correctAnswer }
        const transformedQuestions: QuizQuestion[] = result.questions.map((q: any, index: number) => ({
          id: `q${index + 1}`,
          question: q.question,
          options: q.options,
          correctAnswer: q.options[q.correctIndex], // Convert index to answer text
        }));

        if (transformedQuestions.length === 0) {
          throw new Error("No questions generated.");
        }
        
        setQuestions(transformedQuestions);
        setQuizState('active');
    } catch (e) {
        console.error("Quiz generation failed:", e);
        toast({
            variant: "destructive",
            title: "Oh no! Something went wrong.",
            description: e instanceof Error ? e.message : "There was a problem generating the quiz. Please try again.",
        });
        setQuizState('initial');
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = () => {
    let correctAnswers = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) {
        correctAnswers++;
      }
    });
    setScore((correctAnswers / questions.length) * 100);
    setQuizState('submitted');
  };
  
  const resetQuiz = () => {
    setQuizState('initial');
    setSelectedTopic(null);
    setQuestions([]);
    setAnswers({});
    setScore(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Practice Quiz</CardTitle>
        <CardDescription>Test your understanding of course topics.</CardDescription>
      </CardHeader>
      <CardContent>
        {quizState === 'initial' && (
          <div className="space-y-4 max-w-sm mx-auto text-center">
            <p>Select a topic to generate a short practice quiz.</p>
            <Select onValueChange={setSelectedTopic}>
              <SelectTrigger>
                <SelectValue placeholder="Select a topic" />
              </SelectTrigger>
              <SelectContent>
                {TOPICS.map((topic) => (
                  <SelectItem key={topic.id} value={topic.name}>
                    {topic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleGenerateQuiz} disabled={!selectedTopic}>
              Generate Quiz
            </Button>
          </div>
        )}

        {quizState === 'loading' && (
            <div className="flex flex-col items-center justify-center space-y-4 h-48">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Generating your quiz on {selectedTopic}...</p>
            </div>
        )}

        {quizState === 'active' && (
          <div className="space-y-8">
            {questions.map((q, index) => (
              <div key={q.id}>
                <p className="font-semibold mb-4">
                  {index + 1}. {q.question}
                </p>
                <RadioGroup onValueChange={(value) => handleAnswerChange(q.id, value)}>
                  <div className="space-y-2">
                    {q.options.map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={`${q.id}-${option}`} />
                        <Label htmlFor={`${q.id}-${option}`}>{option}</Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            ))}
            <Button onClick={handleSubmit} disabled={Object.keys(answers).length !== questions.length}>
              Submit Quiz
            </Button>
          </div>
        )}

        {(quizState === 'submitted' && score !== null) && (
            <div className="space-y-6">
                <Alert variant={score > 70 ? 'default' : 'destructive'} className="bg-opacity-20">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Quiz Submitted!</AlertTitle>
                    <AlertDescription className="text-lg font-bold">
                        Your score: {score.toFixed(0)}%
                    </AlertDescription>
                </Alert>
                <div className="space-y-4">
                    {questions.map(q => (
                        <div key={q.id} className="p-4 border rounded-lg">
                            <p className="font-semibold">{q.question}</p>
                            <div className="mt-2 text-sm space-y-1">
                                <p className={answers[q.id] === q.correctAnswer ? 'text-green-600' : 'text-red-600'}>
                                    Your answer: {answers[q.id]} {answers[q.id] === q.correctAnswer ? <CheckCircle2 className="inline h-4 w-4 ml-1"/> : <XCircle className="inline h-4 w-4 ml-1" />}
                                </p>
                                {answers[q.id] !== q.correctAnswer && <p className="text-green-700">Correct answer: {q.correctAnswer}</p>}
                            </div>
                        </div>
                    ))}
                </div>
                <Button onClick={resetQuiz}>Take another quiz</Button>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
