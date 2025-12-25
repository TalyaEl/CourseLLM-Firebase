'use server';
/**
 * @fileOverview An AI agent that summarizes uploaded course materials.
 *
 * - summarizeUploadedMaterial - A function that handles the summarization process.
 * - SummarizeUploadedMaterialInput - The input type for the summarizeUploadedMaterial function.
 * - SummarizeUploadedMaterialOutput - The return type for the summarizeUploadedMaterial function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeUploadedMaterialInputSchema = z.object({
  materialText: z
    .string()
    .describe('The text content of the uploaded course material.'),
});
export type SummarizeUploadedMaterialInput = z.infer<typeof SummarizeUploadedMaterialInputSchema>;

const SummarizeUploadedMaterialOutputSchema = z.object({
  summary: z
    .string()
    .describe('A concise summary of the uploaded course material.'),
});
export type SummarizeUploadedMaterialOutput = z.infer<typeof SummarizeUploadedMaterialOutputSchema>;

export async function summarizeUploadedMaterial(
  input: SummarizeUploadedMaterialInput
): Promise<SummarizeUploadedMaterialOutput> {
  return summarizeUploadedMaterialFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeUploadedMaterialPrompt',
  input: {schema: SummarizeUploadedMaterialInputSchema},
  output: {schema: SummarizeUploadedMaterialOutputSchema},
  prompt: `You are an expert summarizer of course materials.

  Please provide a concise summary of the following material:

  {{{materialText}}}
  `,
});

const summarizeUploadedMaterialFlow = ai.defineFlow(
  {
    name: 'summarizeUploadedMaterialFlow',
    inputSchema: SummarizeUploadedMaterialInputSchema,
    outputSchema: SummarizeUploadedMaterialOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
