// functions/src/types/messageAnalysis.ts

export type IntentLabel =
  | "ASK_EXPLANATION"
  | "ASK_EXAMPLES"
  | "ASK_STEP_BY_STEP_HELP"
  | "ASK_QUIZ"
  | "ASK_SUMMARY"
  | "ASK_WHAT_TO_LEARN_NEXT"
  | "META_SYSTEM_HELP"
  | "OFF_TOPIC"
  | "OTHER";

export type MessageAnalysis = {
  intent: {
    labels: IntentLabel[];      // all intent labels that apply
    primary: IntentLabel;       // the main/primary intent
    confidence: number;         // 0–1
  };
  skills: {
    items: {
      id: string;               // stable skill/topic id from our learning graph
      displayName?: string;     // human-readable label (optional)
      confidence: number;       // 0–1
      role?: "FOCUS" | "SECONDARY" | "PREREQUISITE";
    }[];
  };
  trajectory: {
    currentNodes: string[];     // current node ids in the learning trajectory
    suggestedNextNodes: {
      id: string;               // suggested next node id
      reason?: string;          // short explanation for the suggestion
      priority?: number;        // 1 = highest priority, larger = lower
    }[];
    status:
      | "ON_TRACK"
      | "STRUGGLING"
      | "TOO_ADVANCED"
      | "REVIEW_NEEDED"
      | "NEW_TOPIC"
      | "UNKNOWN";
  };
  metadata: {
    processedAt: string;        // ISO timestamp
    modelVersion: string;       // e.g. "ist-v1"
    threadId: string;
    messageId?: string | null;
    uid: string;                // user id (from auth)
  };
};
