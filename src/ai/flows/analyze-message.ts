'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { MessageAnalysis } from '../../../functions/src/types/messageAnalysis';
import type { AnalyzeMessageRequest } from '../../../functions/src/types/analyzeMessage';

// Zod schema for the AnalyzeMessageRequest type
const AnalyzeMessageRequestSchema = z.object({
  threadId: z.string(),
  messageText: z.string(),
  messageId: z.string().optional(),
  courseId: z.string().optional(),
  language: z.string().optional(),
  maxHistoryMessages: z.number().optional(),
});

// Zod schema for the MessageAnalysis type
const MessageAnalysisSchema = z.object({
  intent: z.object({
    labels: z.array(z.string()),
    primary: z.string(),
    confidence: z.number(),
  }),
  skills: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        displayName: z.string().optional(),
        confidence: z.number(),
        role: z.enum(['FOCUS', 'SECONDARY', 'PREREQUISITE']).optional(),
      })
    ),
  }),
  trajectory: z.object({
    currentNodes: z.array(z.string()),
    suggestedNextNodes: z.array(
      z.object({
        id: z.string(),
        reason: z.string().optional(),
        priority: z.number().optional(),
      })
    ),
    status: z.enum([
      'ON_TRACK',
      'STRUGGLING',
      'TOO_ADVANCED',
      'REVIEW_NEEDED',
      'NEW_TOPIC',
      'UNKNOWN',
    ]),
  }),
  metadata: z.object({
    processedAt: z.string(),
    modelVersion: z.string(),
    threadId: z.string(),
    messageId: z.string().nullable().optional(),
    uid: z.string(),
  }),
});

export async function analyzeMessage(
  input: AnalyzeMessageRequest
): Promise<MessageAnalysis> {
  return analyzeMessageFlow(input);
}

const analyzeMessageFlow = ai.defineFlow(
  {
    name: 'analyzeMessageFlow',
    inputSchema: AnalyzeMessageRequestSchema,
    outputSchema: MessageAnalysisSchema,
  },
  async (input): Promise<MessageAnalysis> => {
    // 🔧 Placeholder implementation that matches the new MessageAnalysis type.
    // Later we will replace this with a real LLM call + mapper.
    return {
      intent: {
        labels: ['ASK_EXPLANATION'],
        primary: 'ASK_EXPLANATION',
        confidence: 0.95,
      },
      skills: {
        items: [
          {
            id: 'bayes-theorem',
            displayName: 'Bayes Theorem',
            confidence: 0.9,
            role: 'FOCUS',
          },
          {
            id: 'probability',
            displayName: 'Probability',
            confidence: 0.98,
            role: 'PREREQUISITE',
          },
        ],
      },
      trajectory: {
        currentNodes: ['introduction-to-probability'],
        suggestedNextNodes: [
          {
            id: 'bayes-theorem-explained',
            reason: 'The user is asking a direct question about this topic.',
            priority: 1,
          },
        ],
        status: 'ON_TRACK',
      },
      metadata: {
        processedAt: new Date().toISOString(),
        modelVersion: 'ist-v1',
        threadId: input.threadId,
        messageId: input.messageId ?? null,
        uid: 'user-placeholder', // TODO: wire to real uid from auth
      },
    };
  }
);
