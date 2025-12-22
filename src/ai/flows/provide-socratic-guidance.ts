'use server';

/**
 * @fileOverview A Socratic guidance AI agent.
 *
 * - provideSocraticGuidance - A function that provides Socratic guidance to students.
 * - ProvideSocraticGuidanceInput - The input type for the provideSocraticGuidance function.
 * - ProvideSocraticGuidanceOutput - The return type for the provideSocraticGuidance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProvideSocraticGuidanceInputSchema = z.object({
  question: z.string().describe('The student	 question about the course material.'),
  courseName: z.string().describe('The name of the course.'),
  topic: z.string().describe('The topic the student is asking about.'),
});

export type ProvideSocraticGuidanceInput = z.infer<typeof ProvideSocraticGuidanceInputSchema>;

const ProvideSocraticGuidanceOutputSchema = z.object({
  guidance: z.string().describe('The Socratic guidance provided by the AI.'),
  citations: z.array(z.string()).describe('The citations from the RAG system.'),
});

export type ProvideSocraticGuidanceOutput = z.infer<typeof ProvideSocraticGuidanceOutputSchema>;

export async function provideSocraticGuidance(input: ProvideSocraticGuidanceInput): Promise<ProvideSocraticGuidanceOutput> {
  return provideSocraticGuidanceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'provideSocraticGuidancePrompt',
  input: {schema: ProvideSocraticGuidanceInputSchema},
  output: {schema: ProvideSocraticGuidanceOutputSchema},
  prompt: `You are a Socratic Tutor for the course {{courseName}}. Your goal is to guide the student to the answer, not to give them the answer directly. Use Socratic questioning techniques to help the student arrive at the solution themselves. The student is asking about the topic: {{topic}}.\n\nStudent Question: {{question}}\n\nProvide Socratic Guidance:`,
});

const provideSocraticGuidanceFlow = ai.defineFlow(
  {
    name: 'provideSocraticGuidanceFlow',
    inputSchema: ProvideSocraticGuidanceInputSchema,
    outputSchema: ProvideSocraticGuidanceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    // Placeholder for RAG system integration and citation retrieval
    const citations = ['Citation 1', 'Citation 2'];
    return {
      guidance: output!.guidance,
      citations: citations,
    };
  }
);
