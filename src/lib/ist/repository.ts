
import type { MessageAnalysis } from '../../../functions/src/types/messageAnalysis';

export interface IstAnalysisRepository {
  save(analysis: MessageAnalysis): Promise<void>;
  get(threadId: string, messageId: string): Promise<MessageAnalysis | null>;
  listByThread(threadId: string): Promise<MessageAnalysis[]>;
}

type AnalysisKey = string; // e.g. `${threadId}::${messageId}`

function makeKey(threadId: string, messageId: string): AnalysisKey {
  return `${threadId}::${messageId}`;
}

export class InMemoryIstAnalysisRepository implements IstAnalysisRepository {
  private store = new Map<AnalysisKey, MessageAnalysis>();

  async save(analysis: MessageAnalysis): Promise<void> {
    const { threadId, messageId } = analysis.metadata;
    if (!threadId || !messageId) {
      throw new Error(
        'IstAnalysisRepository.save: analysis.metadata.threadId and analysis.metadata.messageId are required'
      );
    }
    const key = makeKey(threadId, messageId);
    this.store.set(key, analysis);
  }

  async get(threadId: string, messageId: string): Promise<MessageAnalysis | null> {
    const key = makeKey(threadId, messageId);
    return this.store.get(key) ?? null;
  }

  async listByThread(threadId: string): Promise<MessageAnalysis[]> {
    const results: MessageAnalysis[] = [];
    for (const analysis of this.store.values()) {
      if (analysis.metadata.threadId === threadId) {
        results.push(analysis);
      }
    }
    return results;
  }
}

let singletonRepo: IstAnalysisRepository | null = null;

export function getIstAnalysisRepository(): IstAnalysisRepository {
  if (!singletonRepo) {
    singletonRepo = new InMemoryIstAnalysisRepository();
  }
  return singletonRepo;
}
