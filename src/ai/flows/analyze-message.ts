'use server';

/**
 * @fileoverview Analyzes a student's message to extract intent, skills, and learning trajectory.
 * This flow is designed to be used in a Socratic learning environment.
 */

import { ai } from '@/ai/genkit';
import { courseModel } from '@/ai/genkit';
import { z } from 'zod';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// Check if the DATABASE_URL environment variable is set
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is missing. Please check your .env file.");
}

// 1. Corrected Zod Output Schema
const MessageAnalysisSchema = z.object({
  intent: z.object({
    primary: z
      .enum([
        'GREETING',
        'END_CONVERSATION',
        'ASK_EXPLANATION',
        'ASK_QUESTION',
        'PROVIDE_ANSWER',
        'OFF_TOPIC',
      ])
      .describe("The primary classified intent of the student's message."),
    confidence: z.number().describe('The confidence score of the intent classification.'),
  }),
  skills: z
    .array(z.string())
    .describe(
      'A list of skills or topics the student is engaging with, based on the course material.'
    ),
  trajectory: z.object({
    status: z
      .enum(['ON_TRACK', 'OFF_TRACK', 'NEUTRAL'])
      .describe("The assessment of the student's learning trajectory status."),
    reasoning: z.string().describe('The reasoning behind the trajectory assessment.'),
  }),
});

// Define the schema for the analysis-saving tool
const SaveAnalysisSchema = z.object({
  threadId: z.string(),
  messageId: z.string(),
  analysis: MessageAnalysisSchema,
});

// Initialize the PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Tool to save the analysis of a student's message to the PostgreSQL database.
 */
const saveAnalysis = ai.defineTool(
  {
    name: 'saveAnalysis',
    description: 'Saves the message analysis to the PostgreSQL database.',
    inputSchema: SaveAnalysisSchema,
    outputSchema: z.void(),
  },
  async ({ threadId, messageId, analysis }) => {
    const client = await pool.connect();
    try {
      const query = `
        INSERT INTO interaction_analysis (id, thread_id, message_id, intent, skills, trajectory, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `;
      const values = [
        uuidv4(),
        threadId,
        messageId,
        JSON.stringify(analysis.intent),
        JSON.stringify(analysis.skills),
        JSON.stringify(analysis.trajectory),
      ];
      await client.query(query, values);
    } catch (error) {
      console.error('Error saving analysis to PostgreSQL:', error);
      throw error;
    } finally {
      client.release();
    }
  }
);

// 2 & 3. Corrected Prompt Definition and Genkit API Usage
const analysisPrompt = ai.definePrompt(
    {
      name: 'analysisPrompt',
      model: courseModel,
      input: {
        schema: z.object({ message: z.string() }),
      },
      output: {
        schema: MessageAnalysisSchema,
      },
      prompt: `Analyze the following student message to classify their intent, identify the skills they are engaging with, and assess their learning trajectory.

      Student Message: "{message}"

      You must output a JSON object that strictly adheres to the following schema:
      {
        "intent": {
            "primary": "classification of the intent",
            "confidence": 0.9
        },
        "skills": ["list", "of", "skills"],
        "trajectory": {
            "status": "assessment of the trajectory",
            "reasoning": "reasoning for the trajectory assessment"
        }
      }

      Possible values for 'intent.primary': 'GREETING', 'END_CONVERSATION', 'ASK_EXPLANATION', 'ASK_QUESTION', 'PROVIDE_ANSWER', 'OFF_TOPIC'.
      Possible values for 'trajectory.status': 'ON_TRACK', 'OFF_TRACK', 'NEUTRAL'.
      `,
    },
  );


/**
 * The main flow for analyzing a student's message.
 */
export const analyzeMessageFlow = ai.defineFlow(
  {
    name: 'analyzeMessageFlow',
    inputSchema: z.object({
      message: z.string(),
      threadId: z.string(),
      messageId: z.string(),
    }),
    outputSchema: MessageAnalysisSchema,
  },
  async ({ message, threadId, messageId }) => {

    const analysisResponse = await analysisPrompt({message});
    const analysis = analysisResponse.output;

    if (!analysis) {
        throw new Error("Failed to get a valid analysis from the AI model.");
    }

    // 4. Maintain PostgreSQL Logic
    await saveAnalysis({
      threadId,
      messageId,
      analysis,
    });

    return analysis;
  }
);
