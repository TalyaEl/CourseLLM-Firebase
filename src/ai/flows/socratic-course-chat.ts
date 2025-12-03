'use server';

/**
 * @fileOverview Implements a Socratic chat flow for students to interact with course content.
 */
import { courseModel } from '../genkit'; 
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { extractAndStoreIST } from '@/lib/ist/extractIST';

const SocraticCourseChatInputSchema = z.object({
  courseMaterial: z
    .string()
    .describe('The course material content to chat with, including all relevant text, formulas, and diagrams.'),
  studentQuestion: z.string().describe('The student\'s question about the course material.'),
});
export type SocraticCourseChatInput = z.infer<typeof SocraticCourseChatInputSchema>;

const SocraticCourseChatOutputSchema = z.object({
  response: z.string().describe('The AI-generated Socratic response to guide the student.'),
});
export type SocraticCourseChatOutput = z.infer<typeof SocraticCourseChatOutputSchema>;

export async function socraticCourseChat(input: SocraticCourseChatInput): Promise<SocraticCourseChatOutput> {
  // Extract IST from the student's question (best-effort, non-blocking)
  // Use a short snippet of course material as context
  const courseContext = input.courseMaterial.substring(0, 200) + '...';
  extractAndStoreIST({
    utterance: input.studentQuestion,
    courseContext,
    userId: undefined, // TODO: Pass user ID if available from auth context
    courseId: undefined, // TODO: Pass course ID if available from route params
  }).catch((err) => {
    // Already logged in extractAndStoreIST, just prevent unhandled rejection
    console.error('[IST] Unhandled error in IST extraction:', err);
  });

  // Continue with normal flow
  return socraticCourseChatFlow(input);
}

const enforceCompliance = ai.defineTool({
  name: 'enforceCompliance',
  description: 'Ensures that the AI response strictly complies with the provided course material. If the AI response is not compliant, return an error message to the user.',
  inputSchema: z.object({
    courseMaterial: z
      .string()
      .describe('The course material content to check against.'),
    response: z.string().describe('The AI-generated response to validate.'),
  }),
  outputSchema: z.boolean().describe('Returns true if the response complies with the course material, otherwise returns false.'),
}, async (input) => {
  // TODO: Implement the compliance check logic here.
  console.log(`Course Material: ${input.courseMaterial}`);
  console.log(`AI Response: ${input.response}`);
  return true;
});

const socraticPrompt = ai.definePrompt({
  name: 'socraticCourseChatPrompt',
  model: courseModel, 
  input: { schema: SocraticCourseChatInputSchema },
  output: { schema: SocraticCourseChatOutputSchema },
  tools: [enforceCompliance],
  prompt: `You are a Socratic tutor guiding a student through course material. Ask questions that encourage critical thinking and deeper understanding, referencing only the provided course material.

Course Material:
{{courseMaterial}}

Student Question:
{{studentQuestion}}

Response:`,
});

const socraticCourseChatFlow = ai.defineFlow(
  {
    name: 'socraticCourseChatFlow',
    inputSchema: SocraticCourseChatInputSchema,
    outputSchema: SocraticCourseChatOutputSchema,
  },
  async input => {
    const { output } = await socraticPrompt(input);

    const complianceResult = await enforceCompliance({
      courseMaterial: input.courseMaterial,
      response: output!.response,
    });

    if (!complianceResult) {
      return { response: 'I am unable to provide a compliant response based on the course materials.' };
    }

    return output!;
  }
);