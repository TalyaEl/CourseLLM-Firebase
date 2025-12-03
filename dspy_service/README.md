# CourseLLM DSPy Service

Python + DSPy microservice for AI tutor LLM logic in the CourseLLM project.

This service extracts Intent–Skill–Trajectory (IST) information from student utterances and will be expanded to include other AI flows (Socratic guidance, assessments, etc.).

## Setup

### 1. Create Virtual Environment (Python 3.11)

On Windows PowerShell:

```powershell
cd dspy_service
py -3.11 -m venv venv
.\venv\Scripts\activate
```

On macOS/Linux:

```bash
cd dspy_service
python3.11 -m venv venv
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Set Environment Variables

The DSPy service supports multiple LLM providers. By default, it uses OpenAI.

#### LLM Configuration

- `LLM_PROVIDER`: `"openai"` (default, recommended) or `"gemini"`
- `LLM_MODEL`: Model name for the provider (optional, has sensible defaults)

**API keys:**
- For `openai`: `OPENAI_API_KEY` (required)
- For `gemini`: `GEMINI_API_KEY` or `GOOGLE_API_KEY` (required)

**On Windows PowerShell:**

```powershell
# OpenAI (recommended for local dev)
$Env:LLM_PROVIDER = "openai"
$Env:OPENAI_API_KEY = "sk-..."

# Optional: explicitly set model
# $Env:LLM_MODEL = "openai/gpt-4o-mini"

# OR use Gemini
# $Env:LLM_PROVIDER = "gemini"
# $Env:GEMINI_API_KEY = "your_gemini_key_here"
```

**On macOS/Linux:**

```bash
# OpenAI (recommended for local dev)
export LLM_PROVIDER="openai"
export OPENAI_API_KEY="sk-..."

# OR use Gemini
# export LLM_PROVIDER="gemini"
# export GEMINI_API_KEY="your_gemini_key_here"
```

**Alternative:** You can create a `.env` file in the `dspy_service` directory:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
# OR
# LLM_PROVIDER=gemini
# GEMINI_API_KEY=your_gemini_key_here
```

**Note:** For Gemini, model availability depends on your Google Cloud project configuration. If you get 404 errors, try setting `LLM_MODEL` to a different Gemini model identifier that's available in your project.

### 4. Run the Service

```bash
# Using uvicorn directly
uvicorn app:app --host 0.0.0.0 --port 8000 --reload

# OR using Python
python app.py
```

The service will start on `http://localhost:8000`

### 5. Test the Service

**Health Check:**

```powershell
# PowerShell
Invoke-RestMethod "http://localhost:8000/health"
```

```bash
# Bash
curl http://localhost:8000/health
```

**Extract Intent-Skill-Trajectory:**

```powershell
# PowerShell
Invoke-RestMethod "http://localhost:8000/api/intent-skill-trajectory" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body '{"utterance": "אני לא מבין איך עובדת דינאמיק פרוגרמינג", "course_context": "מבני נתונים ואלגוריתמים"}'
```

```bash
# Bash
curl -X POST http://localhost:8000/api/intent-skill-trajectory \
  -H "Content-Type: application/json" \
  -d '{"utterance": "I don'\''t understand how dynamic programming works for knapsack", "course_context": "Intro to Algorithms"}'
```

## API Endpoints

### GET /health

Returns service health status.

**Response:**
```json
{
  "status": "healthy",
  "service": "CourseLLM DSPy Service",
  "version": "0.1.0"
}
```

### POST /api/intent-skill-trajectory

Extract intent, skills, and learning trajectory from a student utterance.

**Request Body:**
```json
{
  "utterance": "I don't understand how dynamic programming works for knapsack",
  "course_context": "Intro to Algorithms"
}
```

**Response:**
```json
{
  "intent": "Understand how dynamic programming applies to the knapsack problem.",
  "skills": [
    "Dynamic Programming",
    "Recurrence Relations"
  ],
  "trajectory": [
    "Review the overlapping subproblems and optimal substructure properties.",
    "Study the bottom-up DP array formulation for 0/1 knapsack.",
    "Solve 2–3 basic knapsack DP exercises."
  ]
}
```

## Integration with Next.js

The Next.js frontend can call this service via a proxy API route. In development, forward requests to `http://localhost:8000/api/intent-skill-trajectory`.

## Current Implementation

- **IntentSkillTrajectoryModule**: Extracts intent, skills, and learning trajectory from student utterances
  - Input: `utterance` (string), `course_context` (optional string)
  - Output: JSON with `intent` (string), `skills` (array of strings), `trajectory` (array of strings)

## Future Work

Additional flows to migrate:
- Socratic guidance generation
- Personalized learning assessments  
- Course material summarization
- Advanced trajectory planning with prerequisites
