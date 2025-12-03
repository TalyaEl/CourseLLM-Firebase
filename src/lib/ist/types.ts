/**
 * Type definitions for IST (Intent-Skill-Trajectory) events.
 * 
 * These types match the PostgreSQL schema defined in schema.sql,
 * but are used for both JSON-based and future Postgres storage.
 */

/**
 * Complete IST event with all fields (including generated ones).
 */
export interface IstEvent {
  /** Unique identifier (generated if not provided) */
  id: string;
  /** ISO timestamp of when the event was created */
  createdAt: string;
  /** Optional user ID who generated the event */
  userId?: string | null;
  /** Optional course ID context */
  courseId?: string | null;
  /** The original student utterance/question */
  utterance: string;
  /** Optional course context (course name, topic, etc.) */
  courseContext?: string | null;
  /** Extracted intent (short sentence) */
  intent: string;
  /** Array of skills/concepts identified */
  skills: string[];
  /** Array of suggested learning trajectory steps */
  trajectory: string[];
}

/**
 * Input type for creating a new IST event.
 * Omits auto-generated fields (id, createdAt).
 */
export interface CreateIstEventInput {
  userId?: string | null;
  courseId?: string | null;
  utterance: string;
  courseContext?: string | null;
  intent: string;
  skills: string[];
  trajectory: string[];
}

/**
 * Role type for chat messages in the conversation history.
 */
export type ChatMessageRole = 'student' | 'tutor' | 'system';

/**
 * Represents a single message in the chat conversation history.
 */
export interface ChatMessage {
  /** Optional unique identifier for the message */
  id?: string;
  /** Role of the message sender */
  role: ChatMessageRole;
  /** Content of the message */
  content: string;
  /** Optional ISO timestamp of when the message was created */
  createdAt?: string;
}

/**
 * Minimal student profile that can be enriched with learning analytics.
 * Used to provide context about the student's skill level and progress.
 */
export interface StudentProfile {
  /** Skills the student has demonstrated proficiency in */
  strongSkills: string[];
  /** Skills the student needs to improve */
  weakSkills: string[];
  /** Optional description of the student's current course progress */
  courseProgress?: string | null;
}

/**
 * Context object that aggregates all information the IST extractor might need
 * to provide more accurate and personalized intent-skill-trajectory extraction.
 */
export interface IstContext {
  /** The current student utterance being analyzed */
  currentUtterance: string;
  /** Optional course context (course name, topic, etc.) */
  courseContext?: string | null;

  /** Optional user ID who generated the utterance */
  userId?: string | null;
  /** Optional course ID context */
  courseId?: string | null;

  /** Recent chat messages for conversational context */
  recentChatMessages: ChatMessage[];
  /** Recent IST events for pattern recognition and continuity */
  recentIstEvents: IstEvent[];

  /** Optional student profile for personalized trajectory suggestions */
  studentProfile?: StudentProfile | null;
}

