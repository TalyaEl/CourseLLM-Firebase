import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const courseModel = googleAI.model('gemini-2.5-flash');

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_API_KEY || process.env.LLM_API_KEY
    })
  ],
  model: courseModel,
});