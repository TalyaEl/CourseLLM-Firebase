// functions/src/types/analyzeMessage.ts

export type AnalyzeMessageRequest = {
  threadId: string;
  messageText: string;
  messageId?: string;
  courseId?: string;
  language?: string;          // e.g. "en", "he"
  maxHistoryMessages?: number;
};
