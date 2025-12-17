"""
FastAPI application for CourseLLM DSPy service.

This service exposes HTTP endpoints that wrap DSPy modules, allowing the Next.js
frontend to call LLM logic implemented in Python/DSPy instead of TypeScript/Genkit.

Endpoints:
- GET /health - Health check endpoint
- POST /api/intent-skill-trajectory - Extract intent, skills, and learning trajectory from student utterances
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Literal

from dotenv import load_dotenv

# Import DSPy flows
from dspy_flows import initialize_ist_extractor

# Load environment variables
load_dotenv()

app = FastAPI(
    title="CourseLLM DSPy Service",
    description="Python/DSPy service for AI tutor LLM logic",
    version="0.1.0"
)

# Configure CORS to allow requests from Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:9002",  # Next.js app runs on port 9002 (see package.json)
        "http://127.0.0.1:9002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Pydantic Models for API Requests/Responses
# ============================================================================

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


class IntentSkillRequest(BaseModel):
    """Request model for intent-skill-trajectory extraction endpoint."""
    utterance: str = Field(..., description="Student's message / question in natural language", min_length=1)
    course_context: Optional[str] = Field(None, description="Optional context about the course, topic, or recent activity")
    
    # STEP 2: Extended fields for richer context (optional with safe defaults for backward compatibility)
    chat_history: List[ChatMessage] = []
    ist_history: List[IstHistoryItem] = []
    student_profile: Optional[StudentProfile] = None


class IntentSkillResponse(BaseModel):
    """Response model for intent-skill-trajectory extraction endpoint."""
    intent: str
    skills: List[str]
    trajectory: List[str]


# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint to verify the service is running."""
    return {
        "status": "healthy",
        "service": "CourseLLM DSPy Service",
        "version": "0.1.0"
    }


@app.post("/api/intent-skill-trajectory", response_model=IntentSkillResponse)
async def infer_intent_skill_trajectory(request: IntentSkillRequest) -> IntentSkillResponse:
    """
    Infer the student's intent, the relevant skills, and a suggested learning trajectory
    from a single utterance + optional course context.
    
    Args:
        request: IntentSkillRequest with utterance and optional course_context
    
    Returns:
        IntentSkillResponse containing intent, skills, and trajectory
    
    Example request:
        {
          "utterance": "I don't understand how dynamic programming works for knapsack",
          "course_context": "Intro to Algorithms"
        }
    
    Example response:
        {
          "intent": "Understand how dynamic programming applies to the knapsack problem.",
          "skills": ["Dynamic Programming", "Recurrence Relations"],
          "trajectory": [
            "Review the overlapping subproblems and optimal substructure properties.",
            "Study the bottom-up DP array formulation for 0/1 knapsack.",
            "Solve 2–3 basic knapsack DP exercises."
          ]
        }
    """
    import traceback
    import logging
    
    logger = logging.getLogger(__name__)
    
    try:
        from dspy_flows import ist_extractor  # import inside to read the current initialized value
        
        if ist_extractor is None:
            error_msg = "IST extractor not initialized. Please restart the service."
            print(f"[IST][ERROR] {error_msg}")
            raise HTTPException(
                status_code=500,
                detail=error_msg
            )
        
        print(f"[IST] Processing request - utterance: {request.utterance[:100]}..., context: {request.course_context or 'None'}")
        
        # STEP 2: Log that we are receiving richer context (for debugging)
        print(f"[IST] Received chat_history size: {len(request.chat_history)}")
        print(f"[IST] Received ist_history size: {len(request.ist_history)}")
        if request.student_profile is not None:
            print(f"[IST] Received student_profile (strong_skills: {len(request.student_profile.strong_skills)}, weak_skills: {len(request.student_profile.weak_skills)})")
        
        # Call the IST extractor
        # In DSPy v3, calling a Module directly invokes its __call__ method which calls forward()
        # STEP 5: Pass enriched context (chat_history, ist_history, student_profile) to the DSPy module
        try:
            result = ist_extractor(
                utterance=request.utterance,
                course_context=request.course_context or "",
                chat_history=request.chat_history,
                ist_history=request.ist_history,
                student_profile=request.student_profile,
            )
            print(f"[IST] Extract completed - result type: {type(result)}, keys: {list(result.keys()) if isinstance(result, dict) else 'N/A'}")
        except Exception as module_error:
            error_msg = f"IST extractor module call failed: {type(module_error).__name__}: {str(module_error)}"
            print(f"[IST][ERROR] {error_msg}")
            print(f"[IST][ERROR] Module error traceback:\n{traceback.format_exc()}")
            raise
        
        # Validate and normalize result
        if not isinstance(result, dict):
            print(f"[IST][WARNING] Result is not a dict: {type(result)}")
            result = {
                "intent": "Error: Invalid result format",
                "skills": [],
                "trajectory": []
            }
        
        # Defensive normalization
        intent = result.get("intent", "")
        skills = result.get("skills") or []
        trajectory = result.get("trajectory") or []
        
        # Ensure types are correct
        if not isinstance(intent, str):
            intent = str(intent) if intent is not None else ""
        if not isinstance(skills, list):
            if isinstance(skills, str):
                # Try to parse as comma-separated
                skills = [s.strip() for s in skills.split(",") if s.strip()]
            else:
                skills = []
        if not isinstance(trajectory, list):
            if isinstance(trajectory, str):
                trajectory = [t.strip() for t in trajectory.split(",") if t.strip()]
            else:
                trajectory = []
        
        # Ensure non-empty values (fallbacks)
        if not intent or not intent.strip():
            intent = "Student is asking for help with a course concept."
        if not skills:
            skills = [f"Understand: {intent[:50]}"]
        if not trajectory:
            trajectory = [
                "Review the relevant lecture notes or slides.",
                "Watch a short explanation video on this topic.",
                "Solve 1–3 simple practice problems about this topic.",
            ]
        
        # Normalize all strings in lists
        skills = [str(s).strip() for s in skills if str(s).strip()]
        trajectory = [str(t).strip() for t in trajectory if str(t).strip()]
        
        # Final validation
        intent = intent.strip()
        
        print(f"[IST] Returning response - intent length: {len(intent)}, skills count: {len(skills)}, trajectory count: {len(trajectory)}")
        
        response = IntentSkillResponse(
            intent=intent,
            skills=skills,
            trajectory=trajectory,
        )
        
        return response
    
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except ValueError as e:
        error_msg = f"Validation error: {str(e)}"
        print(f"[IST][ERROR] {error_msg}")
        print(f"[IST][ERROR] Traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        error_msg = f"Internal server error: {type(e).__name__}: {str(e)}"
        print(f"[IST][ERROR] {error_msg}")
        print(f"[IST][ERROR] Full traceback:\n{traceback.format_exc()}")
        
        # Return a structured error response that matches our response model
        # This allows the frontend to at least get a valid response shape
        raise HTTPException(
            status_code=500,
            detail=error_msg
        )


# ============================================================================
# Startup Configuration
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """
    Initialize DSPy LM and IST module on application startup.
    """
    try:
        print("🔧 Initializing DSPy Intent–Skill–Trajectory extractor...")
        initialize_ist_extractor()
        print("✅ DSPy service initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize DSPy service: {e}")
        print("\n💡 Make sure to:")
        print("   1. Create a .env file in the dspy_service folder (copy from .env.example)")
        print("   2. Set OPENAI_API_KEY in .env with your real API key (not a placeholder)")
        print("   3. Check that all dependencies are installed (pip install -r requirements.txt)")
        raise


if __name__ == "__main__":
    import uvicorn
    import sys
    # Run on port 8000 by default
    # disable reload on Windows for better compatibility
    reload = False if sys.platform == "win32" else True
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=reload)
