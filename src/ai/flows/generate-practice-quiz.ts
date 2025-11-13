'use server';

/**
 * @fileOverview Practice quiz generation flow for students.
 *
 * - generatePracticeQuiz - A function that generates a practice quiz on a specific topic.
 * - GeneratePracticeQuizInput - The input type for the generatePracticeQuiz function.
 * - GeneratePracticeQuizOutput - The return type for the generatePracticeQuiz function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePracticeQuizInputSchema = z.object({
  topic: z.string().describe('The topic for which to generate a practice quiz.'),
});
export type GeneratePracticeQuizInput = z.infer<
  typeof GeneratePracticeQuizInputSchema
>;

const GeneratePracticeQuizOutputSchema = z.object({
  quiz: z.string().describe('The generated practice quiz.'),
});
export type GeneratePracticeQuizOutput = z.infer<
  typeof GeneratePracticeQuizOutputSchema
>;

export async function generatePracticeQuiz(
  input: GeneratePracticeQuizInput
): Promise<GeneratePracticeQuizOutput> {
  return generatePracticeQuizFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePracticeQuizPrompt',
  input: {schema: GeneratePracticeQuizInputSchema},
  output: {schema: GeneratePracticeQuizOutputSchema},
  prompt: `You are a teaching assistant creating practice quizzes for university students.

  Generate a short quiz on the topic of {{{topic}}}. The quiz should consist of 3 multiple choice questions.

  Format the output as a string that can be presented directly to the user.
  
  For each question, provide 4 options, labeled a), b), c), and d).
  
  After all questions, include a section with the correct answers, clearly indicating the correct choice for each question. For example: 'Correct Answer: c) The correct choice'.
  
  Do not include a preamble. Start directly with the first question.
  
  Example of a single question format:
  1. What is a data structure?
  a) A way to store and organize data
  b) A programming language
  c) A type of computer
  d) An algorithm
  
  Example for answer format at the end:
  Correct Answer: a) A way to store and organize data
  `,
});

const generatePracticeQuizFlow = ai.defineFlow(
  {
    name: 'generatePracticeQuizFlow',
    inputSchema: GeneratePracticeQuizInputSchema,
    outputSchema: GeneratePracticeQuizOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
