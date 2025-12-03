from __future__ import annotations

import os
import json
from typing import List, Optional, Literal
from pydantic import BaseModel

import dspy

try:
    import json_repair
except ImportError:
    json_repair = None  # Optional dependency


# ---------------------------------------------------------------------
# LM configuration (provider-agnostic, defaults to OpenAI)
# ---------------------------------------------------------------------

_LM_CONFIGURED = False


def _configure_lm_once() -> None:
    """
    Configure DSPy with an LM instance exactly once.

    Provider is controlled via env vars:
      - LLM_PROVIDER: "openai" (default) or "gemini"
      - LLM_MODEL: optional, overrides the default model string
      - OPENAI_API_KEY: for OpenAI
      - GEMINI_API_KEY or GOOGLE_API_KEY: for Gemini
    """
    global _LM_CONFIGURED
    if _LM_CONFIGURED:
        return

    provider = os.getenv("LLM_PROVIDER", "openai").lower().strip()
    model = os.getenv("LLM_MODEL", "").strip() or None

    if provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is not set. "
                "Please set OPENAI_API_KEY in your .env file or environment variables."
            )
        
        # Validate that it's not a placeholder value
        api_key_upper = api_key.upper()
        if "PASTE" in api_key_upper or "HERE" in api_key_upper or api_key_upper.startswith("YOUR_"):
            raise RuntimeError(
                "OPENAI_API_KEY appears to be a placeholder value. "
                "Please set a real API key in your .env file (dspy_service/.env)."
            )
        
        # This is a litellm-style model name used by dspy.LM.
        if not model:
            model = "openai/gpt-4o-mini"

        lm = dspy.LM(model=model, api_key=api_key)

    elif provider == "gemini":
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY or GOOGLE_API_KEY is not set. "
                "Please set one of them in your .env file or environment variables."
            )
        
        # Validate that it's not a placeholder value
        api_key_upper = api_key.upper()
        if "PASTE" in api_key_upper or "HERE" in api_key_upper or api_key_upper.startswith("YOUR_"):
            raise RuntimeError(
                "GEMINI_API_KEY or GOOGLE_API_KEY appears to be a placeholder value. "
                "Please set a real API key in your .env file (dspy_service/.env)."
            )
        
        # This is a litellm-style Gemini model name.
        if not model:
            model = "gemini/gemini-1.5-flash"

        lm = dspy.LM(model=model, api_key=api_key)

    else:
        raise RuntimeError(
            f"Unsupported LLM_PROVIDER '{provider}'. "
            "Use 'openai' (default) or 'gemini'."
        )

    dspy.configure(lm=lm)
    _LM_CONFIGURED = True


# ---------------------------------------------------------------------
# Data models for rich context (mirrors Pydantic models in app.py)
# ---------------------------------------------------------------------

class ChatMessage(BaseModel):
    """Represents a single message in the chat conversation history."""
    role: Literal["student", "tutor", "system"]
    content: str
    created_at: Optional[str] = None  # ISO timestamp string


class IstHistoryItem(BaseModel):
    """Represents a single IST event from history."""
    intent: str
    skills: List[str]
    trajectory: List[str]
    created_at: Optional[str] = None  # ISO timestamp string


class StudentProfile(BaseModel):
    """Student profile with skill assessments."""
    strong_skills: List[str] = []
    weak_skills: List[str] = []
    course_progress: Optional[str] = None


# ---------------------------------------------------------------------
# Intent – Skill – Trajectory Signature and Module
# ---------------------------------------------------------------------


class IntentSkillTrajectorySignature(dspy.Signature):
    """
    You are an IST (Intent–Skills–Trajectory) extractor for a CS tutoring system.

    Your job:
    - Understand what the student is trying to achieve right now (intent).
    - Identify which CS skills or concepts are relevant (skills).
    - Suggest next learning steps that build on this student's history (trajectory).

    Consider all provided context:
    - The student_profile shows their strengths, weaknesses, and progress.
    - The ist_history shows previous learning patterns and trajectories (DO NOT repeat identical steps).
    - The chat_history shows the conversation flow.
    - The course_context provides topic/syllabus information.

    You MUST always return:
      - intent: 1 short English sentence describing what the student is trying to do or ask.
      - skills: 3–7 key CS skills or concepts as an array of strings.
      - trajectory: 3–5 concrete next learning steps that build on (not repeat) previous trajectories.

    Never leave skills or trajectory empty.
    Return ONLY a JSON object with keys: intent, skills, trajectory.
    """

    utterance = dspy.InputField(
        desc="Current student question/utterance (can be in Hebrew or any language)."
    )
    course_context = dspy.InputField(
        desc="Course context (course name, topic, week, syllabus snippet). May be empty.",
        default="",
    )
    # STEP 5: Extended context fields (optional, defaults handled in forward method)
    chat_history = dspy.InputField(
        desc="Recent chat history formatted as readable text. Shows conversation flow between student and tutor. May be empty.",
        default="",
    )
    ist_history = dspy.InputField(
        desc="Recent IST history formatted as readable text. Shows previous intents, skills, and trajectories. Use this to avoid repetition and build progression. May be empty.",
        default="",
    )
    student_profile = dspy.InputField(
        desc="Student learning profile formatted as readable text. Shows strong skills, weak skills, and course progress. Use this to personalize recommendations. May be empty.",
        default="",
    )

    intent = dspy.OutputField(
        desc="Short English sentence describing the student's intent."
    )
    skills = dspy.OutputField(
        desc="List of specific skills or concepts the student needs."
    )
    trajectory = dspy.OutputField(
        desc="List of concrete next-learning actions, in order."
    )


class IntentSkillTrajectoryModule(dspy.Module):
    """
    DSPy module that uses the above signature to extract:
    - intent
    - skills[]
    - trajectory[]
    from a student's utterance.
    """

    def __init__(self) -> None:
        super().__init__()
        self.predict = dspy.Predict(IntentSkillTrajectorySignature)

    def forward(
        self,
        utterance: str,
        course_context: Optional[str] = "",
        chat_history: List[ChatMessage] = None,
        ist_history: List[IstHistoryItem] = None,
        student_profile: Optional[StudentProfile] = None,
    ) -> dict:
        """
        Run the LM via DSPy with enriched context and normalize the outputs to a clean dict:

        {
          "intent": str,
          "skills": List[str],
          "trajectory": List[str],
        }
        
        STEP 5: Now accepts and uses chat_history, ist_history, and student_profile
        to provide more context-aware IST extraction.
        """
        import traceback
        
        # Normalize inputs - convert from app.py Pydantic models to dspy_flows models if needed
        if chat_history is None:
            chat_history = []
        else:
            # Convert app.py ChatMessage models to dspy_flows ChatMessage models
            chat_history = [
                ChatMessage(**msg.model_dump() if hasattr(msg, 'model_dump') else msg.dict())
                if not isinstance(msg, ChatMessage) else msg
                for msg in chat_history
            ]
        
        if ist_history is None:
            ist_history = []
        else:
            # Convert app.py IstHistoryItem models to dspy_flows IstHistoryItem models
            ist_history = [
                IstHistoryItem(**item.model_dump() if hasattr(item, 'model_dump') else item.dict())
                if not isinstance(item, IstHistoryItem) else item
                for item in ist_history
            ]
        
        # Convert student_profile if provided
        if student_profile is not None and not isinstance(student_profile, StudentProfile):
            if hasattr(student_profile, 'model_dump'):
                student_profile = StudentProfile(**student_profile.model_dump())
            elif hasattr(student_profile, 'dict'):
                student_profile = StudentProfile(**student_profile.dict())
            elif isinstance(student_profile, dict):
                student_profile = StudentProfile(**student_profile)
        
        # Build formatted context sections for the prompt
        profile_section = self._build_profile_section(student_profile)
        ist_history_section = self._build_ist_history_section(ist_history)
        chat_history_section = self._build_chat_history_section(chat_history)
        
        # Format context as readable strings for the LLM (DSPy will inject these into the prompt)
        chat_history_formatted = chat_history_section
        ist_history_formatted = ist_history_section
        student_profile_formatted = profile_section
        
        try:
            # STEP 5: Pass enriched context to the predictor
            # The formatted strings will be included in the prompt via the signature input fields
            pred = self.predict(
                utterance=utterance,
                course_context=course_context or "",
                chat_history=chat_history_formatted,
                ist_history=ist_history_formatted,
                student_profile=student_profile_formatted,
            )
        except Exception as e:
            print(f"[IST] DSPy predict() failed: {type(e).__name__}: {e}")
            print(f"[IST] Traceback:\n{traceback.format_exc()}")
            # Return a safe fallback
            return {
                "intent": "Unable to extract intent - parsing error occurred.",
                "skills": ["Error parsing skills"],
                "trajectory": ["Review the error logs", "Retry the request"],
            }

        # Safely extract raw fields from DSPy prediction
        # Handle both structured output (attribute-based) and JSON fallback mode
        intent_raw = None
        raw_skills = None
        raw_traj = None
        
        try:
            # Method 1: Try standard attribute access (structured output mode)
            intent_raw = getattr(pred, "intent", None)
            raw_skills = getattr(pred, "skills", None)
            raw_traj = getattr(pred, "trajectory", None)
            
            # Method 2: If attributes are None or empty, try dict access
            if (intent_raw is None or raw_skills is None or raw_traj is None):
                if hasattr(pred, "__dict__"):
                    pred_dict = pred.__dict__
                    if intent_raw is None:
                        intent_raw = pred_dict.get("intent", None)
                    if raw_skills is None:
                        raw_skills = pred_dict.get("skills", None)
                    if raw_traj is None:
                        raw_traj = pred_dict.get("trajectory", None)
                elif isinstance(pred, dict):
                    if intent_raw is None:
                        intent_raw = pred.get("intent", None)
                    if raw_skills is None:
                        raw_skills = pred.get("skills", None)
                    if raw_traj is None:
                        raw_traj = pred.get("trajectory", None)
            
            # Method 3: If we still have None values, try parsing as JSON string
            # (This handles the case when DSPy falls back to JSON mode)
            if (intent_raw is None or raw_skills is None or raw_traj is None):
                # Check if pred itself is a string that might be JSON
                if isinstance(pred, str):
                    try:
                        parsed = json.loads(pred)
                        if isinstance(parsed, dict):
                            if intent_raw is None:
                                intent_raw = parsed.get("intent", None)
                            if raw_skills is None:
                                raw_skills = parsed.get("skills", None)
                            if raw_traj is None:
                                raw_traj = parsed.get("trajectory", None)
                    except (json.JSONDecodeError, ValueError):
                        pass
                
                # Check if any individual field is a JSON string
                for field_name, field_value in [("intent", intent_raw), ("skills", raw_skills), ("trajectory", raw_traj)]:
                    if field_value is not None and isinstance(field_value, str):
                        # Try to parse if it looks like JSON
                        if field_value.strip().startswith("{") or field_value.strip().startswith("["):
                            try:
                                parsed = json.loads(field_value)
                                if field_name == "intent" and intent_raw is None:
                                    if isinstance(parsed, dict):
                                        intent_raw = parsed.get("intent", None)
                                    else:
                                        intent_raw = str(parsed)
                                elif field_name == "skills" and raw_skills is None:
                                    if isinstance(parsed, list):
                                        raw_skills = parsed
                                    elif isinstance(parsed, dict):
                                        raw_skills = parsed.get("skills", None)
                                elif field_name == "trajectory" and raw_traj is None:
                                    if isinstance(parsed, list):
                                        raw_traj = parsed
                                    elif isinstance(parsed, dict):
                                        raw_traj = parsed.get("trajectory", None)
                            except (json.JSONDecodeError, ValueError):
                                # If json_repair is available, try it
                                if json_repair is not None:
                                    try:
                                        parsed = json_repair.repair_json(field_value)
                                        parsed = json.loads(parsed)
                                        if field_name == "intent" and intent_raw is None:
                                            intent_raw = parsed.get("intent") if isinstance(parsed, dict) else str(parsed)
                                        elif field_name == "skills" and raw_skills is None:
                                            raw_skills = parsed if isinstance(parsed, list) else (parsed.get("skills") if isinstance(parsed, dict) else None)
                                        elif field_name == "trajectory" and raw_traj is None:
                                            raw_traj = parsed if isinstance(parsed, list) else (parsed.get("trajectory") if isinstance(parsed, dict) else None)
                                    except Exception:
                                        pass
            
            # Set defaults if still None
            if intent_raw is None:
                intent_raw = ""
            if raw_skills is None:
                raw_skills = []
            if raw_traj is None:
                raw_traj = []
            
            # Debug logging
            print(f"[IST] Extracted fields - intent type: {type(intent_raw)}, skills type: {type(raw_skills)}, trajectory type: {type(raw_traj)}")
            
        except Exception as e:
            print(f"[IST] Error extracting fields from DSPy prediction: {type(e).__name__}: {e}")
            print(f"[IST] Prediction object type: {type(pred)}")
            if hasattr(pred, "__dict__"):
                print(f"[IST] Prediction __dict__ keys: {list(pred.__dict__.keys())[:10]}")
            # Fallback to safe defaults
            intent_raw = ""
            raw_skills = []
            raw_traj = []

        # Normalize intent to string
        intent = (str(intent_raw) if intent_raw is not None else "").strip()

        def normalize_list(value) -> List[str]:
            """
            Normalize LM output into a list of non-empty strings.

            Supports:
              - already-a-list → return cleaned list
              - JSON array string (e.g., '["item1", "item2"]') → parse JSON
              - newline / bullet / comma separated string → split and parse
            """
            # Case 1: Already a list
            if isinstance(value, list):
                result = [str(x).strip() for x in value if str(x).strip()]
                print(f"[IST] Normalized list from list type: {len(result)} items")
                return result

            # Case 2: String that might be a JSON array
            if isinstance(value, str):
                text = value.strip()
                
                # Try to parse as JSON array string first
                if text.startswith("[") and text.endswith("]"):
                    try:
                        parsed = json.loads(text)
                        if isinstance(parsed, list):
                            # Successfully parsed JSON array
                            result = [str(x).strip() for x in parsed if str(x).strip()]
                            if result:
                                print(f"[IST] Normalized list from JSON string: {len(result)} items")
                                return result
                    except (json.JSONDecodeError, ValueError) as e:
                        # JSON parsing failed, try json_repair if available
                        if json_repair is not None:
                            try:
                                repaired = json_repair.repair_json(text)
                                parsed = json.loads(repaired)
                                if isinstance(parsed, list):
                                    result = [str(x).strip() for x in parsed if str(x).strip()]
                                    if result:
                                        print(f"[IST] Normalized list from repaired JSON: {len(result)} items")
                                        return result
                            except Exception:
                                pass
                        print(f"[IST] Failed to parse as JSON, falling back to string splitting: {str(e)[:100]}")
                
                # Case 3: Fallback to string splitting if JSON parsing failed or not JSON format
                # Remove surrounding brackets/quotes that might be left over from failed JSON parsing
                text = text.strip("[]\"'")
                text = text.replace("\r", "\n")
                pieces: List[str] = []

                for line in text.split("\n"):
                    line = line.strip(" -•\t")
                    if not line:
                        continue
                    # Allow comma / semicolon separated items in the same line.
                    for chunk in line.replace(";", ",").split(","):
                        # Clean up quotes and whitespace
                        chunk = chunk.strip(" -•\t\"'[]")
                        if chunk:
                            pieces.append(chunk)

                if pieces:
                    print(f"[IST] Normalized list from string splitting: {len(pieces)} items")
                return pieces

            # Fallback: unknown type
            print(f"[IST] Unknown value type for normalization: {type(value)}")
            return []

        skills = normalize_list(raw_skills)
        trajectory = normalize_list(raw_traj)

        # Fallbacks so we NEVER return empty lists
        if not skills and intent:
            skills = [f"Understand: {intent}"]

        if not trajectory and intent:
            trajectory = [
                "Review the relevant lecture notes or slides.",
                "Watch a short explanation video on this topic.",
                "Solve 1–3 simple practice problems about this topic.",
            ]

        if not intent:
            intent = "Student is asking for help with a course concept."

        return {
            "intent": intent,
            "skills": skills,
            "trajectory": trajectory,
        }
    
    def _build_profile_section(self, student_profile: Optional[StudentProfile]) -> str:
        """Build a formatted string for the student profile section."""
        if not student_profile:
            return "Student learning profile: (no data available)"
        
        parts = []
        if student_profile.strong_skills:
            parts.append(f"  - Strong skills: {', '.join(student_profile.strong_skills[:10])}")
        if student_profile.weak_skills:
            parts.append(f"  - Weak skills: {', '.join(student_profile.weak_skills[:10])}")
        if student_profile.course_progress:
            parts.append(f"  - Course progress: {student_profile.course_progress}")
        
        if parts:
            return "Student learning profile:\n" + "\n".join(parts)
        return "Student learning profile: (no detailed data available)"
    
    def _build_ist_history_section(self, ist_history: List[IstHistoryItem]) -> str:
        """Build a formatted string for the IST history section."""
        if not ist_history:
            return "Recent IST events: (none available)"
        
        parts = []
        # Show up to 5 most recent events
        for i, event in enumerate(ist_history[:5], 1):
            skills_str = ", ".join(event.skills[:5])  # Limit skills shown per event
            parts.append(
                f"  {i}. Intent: {event.intent[:100]}...\n"
                f"     Skills: {skills_str}\n"
                f"     Trajectory: {len(event.trajectory)} steps"
            )
        
        return f"Recent IST events ({len(ist_history)} total):\n" + "\n".join(parts)
    
    def _build_chat_history_section(self, chat_history: List[ChatMessage]) -> str:
        """Build a formatted string for the chat history section."""
        if not chat_history:
            return "Recent chat history: (none available)"
        
        parts = []
        # Show up to 10 most recent messages
        for msg in chat_history[-10:]:
            role_emoji = {
                "student": "👤",
                "tutor": "🤖",
                "system": "⚙️"
            }.get(msg.role, "•")
            content_preview = msg.content[:150] + "..." if len(msg.content) > 150 else msg.content
            parts.append(f"  {role_emoji} [{msg.role}]: {content_preview}")
        
        return f"Recent chat history ({len(chat_history)} messages):\n" + "\n".join(parts)


# ---------------------------------------------------------------------
# Global module instance + initializer used by FastAPI app
# ---------------------------------------------------------------------

ist_extractor: Optional[IntentSkillTrajectoryModule] = None


def initialize_ist_extractor() -> IntentSkillTrajectoryModule:
    """
    Configure the LM (once) and create the global IST extractor module.

    This function is called from app.py on startup.
    """
    global ist_extractor
    _configure_lm_once()
    ist_extractor = IntentSkillTrajectoryModule()
    return ist_extractor
