
import { getIstAnalysisEngine } from '@/lib/ist/engine';
import { getIstAnalysisRepository } from '@/lib/ist/repository';
import type { AnalyzeMessageRequest } from '../../../functions/src/types/analyzeMessage';
import type { MessageAnalysis } from '../../../functions/src/types/messageAnalysis';

export async function analyzeAndStoreIstForMessage(params: {
  threadId: string;
  messageId: string;
  courseId?: string;
  language?: string;
  maxHistoryMessages?: number;
  messageText: string;
}): Promise<MessageAnalysis> {
  const engine = getIstAnalysisEngine();
  const repo = getIstAnalysisRepository();

  const request: AnalyzeMessageRequest = {
    threadId: params.threadId,
    messageId: params.messageId,
    courseId: params.courseId,
    language: params.language ?? 'en',
    maxHistoryMessages: params.maxHistoryMessages ?? 10,
    messageText: params.messageText,
  };

  const analysis = await engine.analyzeMessage(request);

  await repo.save(analysis);

  return analysis;
}
