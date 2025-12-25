from __future__ import annotations

import os
import json
import re
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

    Context Analysis:
    - Use the course_context to understand the current topic (e.g., Data Structures, Algorithms).
    - The student_profile shows their strengths and weaknesses (personalize your suggestions).
    - The ist_history shows previous learning patterns (DO NOT repeat identical trajectories).
    - The chat_history shows the conversation flow (use recent messages for context).

    Intent Categories (pick the most relevant):
    - "Clarification": Student asks for explanation of a concept
    - "Debugging": Student is trying to fix code or logic
    - "Review": Student wants to understand something covered before
    - "New Topic": Student is learning something new
    - "Validation": Student wants feedback on their solution

    CRITICAL OUTPUT FORMAT:
    You MUST return ONLY a raw JSON object with NO markdown code blocks.
    Do NOT include ```json or ``` markers.
    Do NOT include any text before or after the JSON.
    The JSON must be valid and parseable.

    JSON structure (EXACT, no variations):
    {
      "intent": "One short English sentence describing what the student needs",
      "skills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
      "trajectory": ["step1", "step2", "step3", "step4", "step5"]
    }

    Field Requirements:
    - intent: string (1 sentence, under 100 characters)
    - skills: array of 4-7 strings (specific CS concepts, not generic)
    - trajectory: array of 4-5 strings (actionable learning steps)

    Rules:
    - NEVER wrap in ```json or ```
    - NEVER include explanations outside the JSON
    - NEVER leave fields empty or null
    - NEVER use generic skills like "thinking" or "learning"
    - Output ONLY the JSON object, nothing else
    """

    utterance = dspy.InputField(
        desc="Current student question/utterance in their own words (may be in Hebrew or English)."
    )
    course_context = dspy.InputField(
        desc="Current course/topic context (e.g., 'Data Structures - Week 3 - Linked Lists'). Use this to interpret the utterance correctly.",
        default="",
    )
    chat_history = dspy.InputField(
        desc="Recent conversation history (student and tutor messages). Use to understand context and avoid repetition.",
        default="",
    )
    ist_history = dspy.InputField(
        desc="Previous IST events extracted from this student. Use to build progression and avoid repeating prior trajectories.",
        default="",
    )
    student_profile = dspy.InputField(
        desc="Student profile (strong/weak skills, progress). Use to personalize recommendations.",
        default="",
    )

    structured_analysis = dspy.OutputField(
        desc="Raw JSON object (no markdown) with exactly these keys: 'intent' (string), 'skills' (array), 'trajectory' (array). Output ONLY the JSON."
    )


class IntentSkillTrajectoryModule(dspy.Module):
    """
    DSPy module using ChainOfThought for reasoning before JSON output.
    Extracts intent, skills, and trajectory from student utterances.
    """

    def __init__(self) -> None:
        super().__init__()
        # Use ChainOfThought instead of basic Predict for better reasoning
        self.predict = dspy.ChainOfThought(IntentSkillTrajectorySignature)

    # Glossary of valid intent categories
    VALID_INTENTS = {
        "conceptual_question": "Student is asking for clarification or explanation of a concept",
        "debugging": "Student is trying to fix code or logic errors",
        "practice_request": "Student wants to practice or work through problems",
        "platform_issue": "Student is having issues with the platform or tools",
    }

    def forward(
        self,
        utterance: str,
        course_context: Optional[str] = "",
        chat_history: List[ChatMessage] = None,
        ist_history: List[IstHistoryItem] = None,
        student_profile: Optional[StudentProfile] = None,
    ) -> dict:
        """
        Run the LM with ChainOfThought reasoning, then parse the JSON output.
        Returns a clean dict: {"intent": str, "skills": List[str], "trajectory": List[str]}
        
        This method implements comprehensive error handling with full traceback exposure.
        """
        import traceback
        import re
        
        print(f"\n[IST] ===== STARTING IST EXTRACTION =====")
        print(f"[IST] Utterance: {utterance[:80]}")
        print(f"[IST] Course context: {course_context or '(none)'}")
        
        # Normalize inputs
        if chat_history is None:
            chat_history = []
        else:
            try:
                chat_history = [
                    ChatMessage(**msg.model_dump() if hasattr(msg, 'model_dump') else msg.dict())
                    if not isinstance(msg, ChatMessage) else msg
                    for msg in chat_history
                ]
            except Exception as e:
                print(f"[IST] ⚠️ Error normalizing chat_history: {type(e).__name__}: {e}")
                chat_history = []
        
        if ist_history is None:
            ist_history = []
        else:
            try:
                ist_history = [
                    IstHistoryItem(**item.model_dump() if hasattr(item, 'model_dump') else item.dict())
                    if not isinstance(item, IstHistoryItem) else item
                    for item in ist_history
                ]
            except Exception as e:
                print(f"[IST] ⚠️ Error normalizing ist_history: {type(e).__name__}: {e}")
                ist_history = []
        
        if student_profile is not None and not isinstance(student_profile, StudentProfile):
            try:
                if hasattr(student_profile, 'model_dump'):
                    student_profile = StudentProfile(**student_profile.model_dump())
                elif hasattr(student_profile, 'dict'):
                    student_profile = StudentProfile(**student_profile.dict())
                elif isinstance(student_profile, dict):
                    student_profile = StudentProfile(**student_profile)
            except Exception as e:
                print(f"[IST] ⚠️ Error normalizing student_profile: {type(e).__name__}: {e}")
                student_profile = None
        
        # Build formatted context sections
        profile_section = self._build_profile_section(student_profile)
        ist_history_section = self._build_ist_history_section(ist_history)
        chat_history_section = self._build_chat_history_section(chat_history)
        
        # ===== STEP 1: Call ChainOfThought =====
        pred = None
        try:
            print(f"[IST] Step 1: Calling dspy.ChainOfThought...")
            pred = self.predict(
                utterance=utterance,
                course_context=course_context or "",
                chat_history=chat_history_section,
                ist_history=ist_history_section,
                student_profile=profile_section,
            )
            print(f"[IST] ✓ ChainOfThought returned successfully")
            print(f"[IST]   Type: {type(pred).__name__}")
            print(f"[IST]   Is dict: {isinstance(pred, dict)}")
        except Exception as e:
            print(f"[IST] ❌ FAILED AT STEP 1: ChainOfThought call")
            print(f"[IST] Exception type: {type(e).__name__}")
            print(f"[IST] Exception message: {str(e)}")
            print(f"[IST] Full traceback:")
            print(traceback.format_exc())
            return self._fallback_response("LLM call failed")

        # ===== STEP 2: Extract structured_analysis field =====
        structured_output = None
        try:
            print(f"[IST] Step 2: Extracting structured_analysis field...")
            
            # Try multiple methods to get the field
            if hasattr(pred, 'structured_analysis'):
                structured_output = getattr(pred, 'structured_analysis', None)
                print(f"[IST] ✓ Found via attribute access")
            
            if structured_output is None and isinstance(pred, dict):
                structured_output = pred.get('structured_analysis', None)
                print(f"[IST] ✓ Found via dict.get()")
            
            if structured_output is None and hasattr(pred, '__dict__'):
                structured_output = pred.__dict__.get('structured_analysis', None)
                print(f"[IST] ✓ Found via __dict__.get()")
            
            if structured_output is None:
                print(f"[IST] ❌ structured_analysis NOT FOUND")
                print(f"[IST] Available attributes/keys:")
                if isinstance(pred, dict):
                    for key in pred.keys():
                        print(f"[IST]   - {key}: {type(pred.get(key)).__name__}")
                elif hasattr(pred, '__dict__'):
                    for key in pred.__dict__.keys():
                        print(f"[IST]   - {key}: {type(getattr(pred, key)).__name__}")
                raise KeyError("structured_analysis field not found in ChainOfThought output")
            
            print(f"[IST] ✓ structured_analysis extracted")
            print(f"[IST]   Type: {type(structured_output).__name__}")
            print(f"[IST]   Length: {len(str(structured_output)) if structured_output else 0}")
        
        except Exception as e:
            print(f"[IST] ❌ FAILED AT STEP 2: Field extraction")
            print(f"[IST] Exception type: {type(e).__name__}")
            print(f"[IST] Exception message: {str(e)}")
            print(f"[IST] Full traceback:")
            print(traceback.format_exc())
            return self._fallback_response("Field extraction failed")

        # ===== STEP 3: Sanitize and parse JSON =====
        try:
            print(f"[IST] Step 3: Sanitizing and parsing JSON...")
            
            # Convert to string
            if structured_output is None:
                raise ValueError("structured_output is None after extraction")
            
            structured_output = str(structured_output).strip()
            print(f"[IST] ✓ Converted to string, length: {len(structured_output)}")
            
            # Remove markdown formatting
            structured_output = self._remove_markdown_formatting(structured_output)
            print(f"[IST] ✓ Markdown removed, length: {len(structured_output)}")
            
            # Extra trim in case of edge cases
            structured_output = structured_output.strip()
            
            if not structured_output:
                raise ValueError("structured_output is empty after sanitization")
            
            print(f"[IST] Raw JSON (first 200 chars): {structured_output[:200]}")
            
            # Parse JSON with explicit error handling
            parsed = json.loads(structured_output)
            print(f"[IST] ✓ JSON parsed successfully")
            
            if not isinstance(parsed, dict):
                raise ValueError(f"Expected JSON object, got {type(parsed).__name__}")
            
            print(f"[IST] ✓ Verified as dict")
            print(f"[IST]   Keys: {list(parsed.keys())}")
        
        except json.JSONDecodeError as e:
            print(f"[IST] ❌ FAILED AT STEP 3: JSON Parse Error")
            print(f"[IST] Error: {str(e)}")
            print(f"[IST] Position: line {e.lineno}, column {e.colno}")
            print(f"[IST] Raw output: {structured_output[:300] if structured_output else '(empty)'}")
            print(f"[IST] Full traceback:")
            print(traceback.format_exc())
            
            # Try json_repair
            if json_repair is not None:
                try:
                    print(f"[IST] Attempting json_repair...")
                    repaired = json_repair.repair_json(structured_output)
                    parsed = json.loads(repaired)
                    print(f"[IST] ✓ json_repair succeeded")
                except Exception as repair_err:
                    print(f"[IST] json_repair failed: {type(repair_err).__name__}")
                    return self._fallback_response("JSON parse failed")
            else:
                return self._fallback_response("JSON parse failed")
        
        except Exception as e:
            print(f"[IST] ❌ FAILED AT STEP 3: Other error")
            print(f"[IST] Exception type: {type(e).__name__}")
            print(f"[IST] Exception message: {str(e)}")
            print(f"[IST] Full traceback:")
            print(traceback.format_exc())
            return self._fallback_response("Sanitization/parsing failed")

        # ===== STEP 4: Extract and validate fields =====
        try:
            print(f"[IST] Step 4: Extracting and validating fields...")
            
            # Use .get() for safe dictionary access
            intent = str(parsed.get("intent", "")).strip() if isinstance(parsed, dict) else ""
            skills_raw = parsed.get("skills", []) if isinstance(parsed, dict) else []
            trajectory_raw = parsed.get("trajectory", []) if isinstance(parsed, dict) else []
            
            print(f"[IST] ✓ Fields extracted:")
            print(f"[IST]   - intent: '{intent[:60]}' (len={len(intent)})")
            print(f"[IST]   - skills_raw: {type(skills_raw).__name__} with {len(skills_raw) if isinstance(skills_raw, list) else 1} items")
            print(f"[IST]   - trajectory_raw: {type(trajectory_raw).__name__} with {len(trajectory_raw) if isinstance(trajectory_raw, list) else 1} items")
            
            # Normalize lists
            skills = self._normalize_list(skills_raw)
            trajectory = self._normalize_list(trajectory_raw)
            
            print(f"[IST] ✓ Lists normalized:")
            print(f"[IST]   - skills: {len(skills)} items")
            print(f"[IST]   - trajectory: {len(trajectory)} items")
            
            # Validate intent against glossary
            intent_category = self._validate_intent(intent, course_context)
            print(f"[IST] ✓ Intent validated: {intent_category}")
            
            # Apply fallbacks
            if not intent:
                intent = "Student is asking for help with a course concept."
            if not skills:
                skills = ["Concept understanding", "Problem-solving"]
            if not trajectory:
                trajectory = ["Review lecture materials", "Practice problems", "Ask clarifying questions"]
            
            print(f"[IST] ✅ STEP 4 SUCCESS - All fields extracted and validated")
            print(f"[IST] Final result:")
            print(f"[IST]   - intent: {intent[:60]}...")
            print(f"[IST]   - skills: {skills}")
            print(f"[IST]   - trajectory: {trajectory}")
            
            return {
                "intent": intent,
                "skills": skills,
                "trajectory": trajectory,
            }
        
        except Exception as e:
            print(f"[IST] ❌ FAILED AT STEP 4: Field extraction/validation")
            print(f"[IST] Exception type: {type(e).__name__}")
            print(f"[IST] Exception message: {str(e)}")
            print(f"[IST] Full traceback:")
            print(traceback.format_exc())
            return self._fallback_response("Field validation failed")

    def _fallback_response(self, reason: str) -> dict:
        """Return a safe fallback response."""
        print(f"[IST] Using fallback response - Reason: {reason}")
        return {
            "intent": "Student is asking for help with a course concept.",
            "skills": ["Concept understanding", "Problem-solving"],
            "trajectory": ["Review lecture materials", "Practice problems", "Ask clarifying questions"],
        }
    
    def _validate_intent(self, intent: str, course_context: str) -> str:
        """
        Validate intent against glossary categories.
        Returns the matched category or the original intent if no match.
        """
        if not intent:
            return "unknown"
        
        intent_lower = intent.lower()
        course_lower = (course_context or "").lower()
        
        # Check against valid categories
        if any(keyword in intent_lower for keyword in ["understand", "explain", "clarify", "confused", "what is"]):
            return "conceptual_question"
        elif any(keyword in intent_lower for keyword in ["debug", "error", "fix", "wrong", "broken"]):
            return "debugging"
        elif any(keyword in intent_lower for keyword in ["practice", "solve", "problem", "exercise", "try"]):
            return "practice_request"
        elif any(keyword in intent_lower for keyword in ["platform", "tool", "system", "can't access", "not working"]):
            return "platform_issue"
        else:
            return "conceptual_question"  # Default to conceptual
    
    def _remove_markdown_formatting(self, text: str) -> str:
        """Strip markdown code block wrappers (```json ... ``` or ``` ... ```)."""
        # Handle non-string input
        if not isinstance(text, str):
            print(f"[IST] WARNING: _remove_markdown_formatting received non-string: {type(text)}")
            text = str(text) if text is not None else ""
        
        # Handle empty string
        if not text or not text.strip():
            print(f"[IST] WARNING: _remove_markdown_formatting received empty string")
            return ""
        
        # Remove code block markers
        text = re.sub(r'^```(?:json)?\s*\n?', '', text)  # Remove opening ```json or ``` with optional newline
        text = re.sub(r'\n?```\s*$', '', text)  # Remove closing ``` with optional newline
        
        cleaned = text.strip()
        
        # Log if we made changes
        if cleaned != text:
            print(f"[IST] Removed markdown formatting")
        
        return cleaned
    
    def _normalize_list(self, value) -> List[str]:
        """Normalize LLM output into a clean list of strings."""
        if isinstance(value, list):
            return [str(x).strip() for x in value if str(x).strip()]
        
        if isinstance(value, str):
            text = value.strip()
            
            # Try JSON array parsing
            if text.startswith("[") and text.endswith("]"):
                try:
                    parsed = json.loads(text)
                    if isinstance(parsed, list):
                        return [str(x).strip() for x in parsed if str(x).strip()]
                except json.JSONDecodeError:
                    if json_repair is not None:
                        try:
                            repaired = json_repair.repair_json(text)
                            parsed = json.loads(repaired)
                            if isinstance(parsed, list):
                                return [str(x).strip() for x in parsed if str(x).strip()]
                        except Exception:
                            pass
            
            # Fallback: split by newlines, commas, or bullets
            text = text.strip("[]\"'")
            pieces = []
            for line in text.split("\n"):
                line = line.strip(" -•\t")
                if not line:
                    continue
                for chunk in line.replace(";", ",").split(","):
                    chunk = chunk.strip(" -•\t\"'[]")
                    if chunk:
                        pieces.append(chunk)
            
            return pieces if pieces else []
        
        return []
    
    def _build_profile_section(self, student_profile: Optional[StudentProfile]) -> str:
        """Build formatted student profile string."""
        if not student_profile:
            return "Student learning profile: (no data available)"
        
        parts = []
        if student_profile.strong_skills:
            parts.append(f"Strong skills: {', '.join(student_profile.strong_skills[:10])}")
        if student_profile.weak_skills:
            parts.append(f"Weak skills: {', '.join(student_profile.weak_skills[:10])}")
        if student_profile.course_progress:
            parts.append(f"Course progress: {student_profile.course_progress}")
        
        return "Student learning profile:\n  " + "\n  ".join(parts) if parts else "Student learning profile: (no detailed data)"
    
    def _build_ist_history_section(self, ist_history: List[IstHistoryItem]) -> str:
        """Build formatted IST history string."""
        if not ist_history:
            return "Recent IST events: (none available)"
        
        parts = []
        for i, event in enumerate(ist_history[:5], 1):
            skills_str = ", ".join(event.skills[:5])
            parts.append(f"{i}. Intent: {event.intent[:80]}\n     Skills: {skills_str}")
        
        return f"Recent IST events ({len(ist_history)} total):\n  " + "\n  ".join(parts)
    
    def _build_chat_history_section(self, chat_history: List[ChatMessage]) -> str:
        """Build formatted chat history string."""
        if not chat_history:
            return "Recent chat history: (none available)"
        
        parts = []
        for msg in chat_history[-10:]:
            role_emoji = {"student": "👤", "tutor": "🤖", "system": "⚙️"}.get(msg.role, "•")
            content_preview = msg.content[:100] + "..." if len(msg.content) > 100 else msg.content
            parts.append(f"{role_emoji} [{msg.role}]: {content_preview}")
        
        return f"Recent chat history ({len(chat_history)} messages):\n  " + "\n  ".join(parts)


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
