'use client';

import { getFunctions, httpsCallable } from 'firebase/functions';
import type { AnalyzeMessageRequest } from '../../../functions/src/types/analyzeMessage';
import type { MessageAnalysis } from '../../../functions/src/types/messageAnalysis';
import type { IstAnalysisEngine } from './engine';

export class CallableIstAnalysisEngine implements IstAnalysisEngine {
  async analyzeMessage(req: AnalyzeMessageRequest): Promise<MessageAnalysis> {
    console.log('[IST] Calling Cloud Function analyzeMessage with request:', req);
    const functions = getFunctions();
    const callable = httpsCallable<AnalyzeMessageRequest, MessageAnalysis>(
      functions,
      'analyzeMessage'
    );

    const result = await callable(req);

    console.log('[IST] Cloud Function analyzeMessage result:', result.data);
    return result.data;
  }
}
