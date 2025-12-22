'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MessageAnalysisInputSchema = z.object({
  messageText: z.string().describe("The student's latest chat message."),
  messageHistory: z.array(z.string()).optional().describe("Recent chat history for context."),
});

const IntentEnum = z.enum(['ASK_EXPLANATION', 'ASK_EXAMPLES', 'OFF_TOPIC', 'OTHER']);
const TrajectoryStatusEnum = z.enum(['ON_TRACK', 'STRUGGLING', 'UNKNOWN']);

const MessageAnalysisOutputSchema = z.object({
  intent: z.object({
    primary: IntentEnum.describe("The primary intent of the user."),
    confidence: z.number().describe("Confidence score between 0 and 1."),
  }),
  skills: z.array(z.string()).describe("List of technical topics or skills identified in the message."),
  trajectory: z.object({
    status: TrajectoryStatusEnum.describe("Assessment of whether the student is on track based on this interaction."),
    reasoning: z.string().optional().describe("Brief explanation for the status."),
  })
});

export type MessageAnalysisInput = z.infer<typeof MessageAnalysisInputSchema>;
export type MessageAnalysisOutput = z.infer<typeof MessageAnalysisOutputSchema>;

const analysisPrompt = ai.definePrompt({
  name: 'analyzeMessagePrompt',
  input: { schema: MessageAnalysisInputSchema },
  output: { schema: MessageAnalysisOutputSchema },
  prompt: `
    You are an advanced educational analytics engine.
    Analyze the following student message to extract structured data about their intent, the skills they are discussing, and their learning trajectory status.

    **Context (History):**
    {{messageHistory}}

    **Current Message:**
    {{messageText}}

    **Instructions:**
    1. Classify the INTENT into one of: ASK_EXPLANATION, ASK_EXAMPLES, OFF_TOPIC, OTHER.
    2. Extract key SKILLS or TOPICS mentioned (e.g., "Recursion", "Python Lists").
    3. Assess the TRAJECTORY:
       - 'ON_TRACK': User asks relevant questions or shows understanding.
       - 'STRUGGLING': User expresses confusion, frustration, or repeats mistakes.
       - 'UNKNOWN': Not enough info.
  `,
});

export const analyzeMessageFlow = ai.defineFlow(
  {
    name: 'analyzeMessageFlow',
    inputSchema: MessageAnalysisInputSchema,
    outputSchema: MessageAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await analysisPrompt(input);
    return output!;
  }
);