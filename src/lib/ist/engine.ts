import type { AnalyzeMessageRequest } from '../../../functions/src/types/analyzeMessage';
import type { MessageAnalysis } from '../../../functions/src/types/messageAnalysis';
import { CallableIstAnalysisEngine } from './engineCallable';

export interface IstAnalysisEngine {
  analyzeMessage(req: AnalyzeMessageRequest): Promise<MessageAnalysis>;
}

export class ApiIstAnalysisEngine implements IstAnalysisEngine {
  async analyzeMessage(req: AnalyzeMessageRequest): Promise<MessageAnalysis> {
    console.log('[IST] Calling /api/analyze-message with request:', req);
    const res = await fetch('/api/analyze-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`IST API error: ${res.status} ${text}`);
    }

    return (await res.json()) as MessageAnalysis;
  }
}

let cachedEngine: IstAnalysisEngine | null = null;

export function getIstAnalysisEngine(): IstAnalysisEngine {
  if (cachedEngine) {
    return cachedEngine;
  }

  const mode = process.env.NEXT_PUBLIC_IST_ENGINE_MODE ?? 'api';

  if (mode === 'callable') {
    console.log('[IST] Using CallableIstAnalysisEngine (Cloud Function backend).');
    cachedEngine = new CallableIstAnalysisEngine();
  } else {
    console.log('[IST] Using ApiIstAnalysisEngine (Next.js /api/analyze-message backend).');
    cachedEngine = new ApiIstAnalysisEngine();
  }

  return cachedEngine;
}
