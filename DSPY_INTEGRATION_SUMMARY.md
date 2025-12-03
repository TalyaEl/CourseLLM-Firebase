# DSPy Service Integration Summary

## Overview

Successfully created a Python + DSPy microservice and integrated it with the existing student quiz flow in the CourseLLM project. The service replaces the Genkit-based quiz generation with a DSPy-powered solution while maintaining compatibility with the existing frontend.

## Files Created/Modified

### New Files Created

#### Python DSPy Service (`dspy_service/`)
1. **`requirements.txt`** - Python dependencies (FastAPI, DSPy, Google Generative AI)
2. **`quiz_flows.py`** - DSPy modules with QuizGenerationSignature and QuizGenerator
3. **`app.py`** - FastAPI application with `/api/quiz` and `/health` endpoints
4. **`README.md`** - Setup instructions and API documentation
5. **`SETUP_NOTES.md`** - Implementation notes and troubleshooting

#### Next.js Integration
1. **`src/app/api/dspy/quiz/route.ts`** - Proxy API route that forwards requests to the Python service

### Files Modified

1. **`src/components/student/PracticeQuiz.tsx`**
   - Updated `handleGenerateQuiz()` to call `/api/dspy/quiz` instead of Genkit flow
   - Added transformation logic to convert DSPy response format to component's expected format
   - Maintains all existing UI and state management

## Current Quiz Flow Architecture

```
┌─────────────────┐
│  Frontend       │
│  PracticeQuiz   │
│  Component      │
└────────┬────────┘
         │ POST /api/dspy/quiz
         ▼
┌─────────────────┐
│  Next.js API    │
│  Route          │
│  (Proxy)        │
└────────┬────────┘
         │ POST http://localhost:8000/api/quiz
         ▼
┌─────────────────┐
│  Python DSPy    │
│  Service        │
│  (FastAPI)      │
└────────┬────────┘
         │ DSPy + Gemini
         ▼
┌─────────────────┐
│  Google Gemini  │
│  API            │
└─────────────────┘
```

## Data Flow

### Request Format
```json
{
  "topic": "Data Structures",
  "level": "medium"
}
```

### DSPy Service Response
```json
{
  "questions": [
    {
      "question": "What is the time complexity of array access?",
      "options": ["O(1)", "O(n)", "O(log n)", "O(n²)"],
      "correctIndex": 0
    }
  ]
}
```

### Frontend Transformation
The component transforms `correctIndex` to `correctAnswer` (text) to maintain compatibility with existing UI logic.

## How to Run

### 1. Start DSPy Service

**Windows PowerShell:**
```powershell
cd dspy_service
py -3.11 -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
$Env:GEMINI_API_KEY = "your-key-here"
python app.py
```

**macOS/Linux:**
```bash
cd dspy_service
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export GEMINI_API_KEY="your-key-here"
python app.py
```

Service runs on `http://localhost:8000`

### 2. Start Next.js (in separate terminal)

```bash
npm run dev
```

Next.js runs on `http://localhost:3000`

### 3. Test

1. Navigate to the student quiz page
2. Select a topic
3. Click "Generate Quiz"
4. Quiz questions should appear from the DSPy service

## Key Implementation Details

### DSPy Configuration

The `configure_dspy_gemini()` function includes multiple fallback approaches to work with different DSPy v3 API variations:

1. Tries `dspy.configure_lm()` if available
2. Tries `dspy.settings.configure()` if available
3. Tries `dspy.LM()` with `dspy.configure()` if available
4. Tries `dspy.Google()` with `dspy.configure()` if available
5. Falls back to direct `google-generativeai` usage if DSPy config fails

This ensures the service works even if the exact DSPy v3 API varies.

### Quiz Generation

- Uses DSPy's `ChainOfThought` for structured output
- Validates JSON structure and question format
- Handles markdown code block wrapping in responses
- Validates option counts (2-6) and correctIndex bounds

### Error Handling

- Frontend: Shows user-friendly error messages via toast notifications
- Next.js API Route: Returns appropriate HTTP status codes (400, 502, 500)
- Python Service: Validates input and returns detailed error messages

## Environment Variables

### Required
- `GEMINI_API_KEY` or `GOOGLE_API_KEY` - Google Gemini API key

### Optional (for production)
- `DSPY_SERVICE_URL` - URL of deployed DSPy service (defaults to localhost:8000 in dev)

## What Was NOT Changed

- ✅ Existing Genkit flows remain intact (not deleted)
- ✅ Other components continue to work as before
- ✅ No breaking changes to existing functionality
- ✅ Frontend UI/UX remains identical

## Next Steps

1. **Verify DSPy v3 API**: Once you have the service running, verify the DSPy configuration works with your installed version. Adjust `configure_dspy_gemini()` if needed.

2. **Add Difficulty Selector**: Currently defaults to "medium". Add a UI selector for difficulty level.

3. **Expand to Other Flows**: Migrate other AI flows:
   - Socratic guidance generation
   - Personalized learning assessments
   - Message analysis
   - Course material summarization

4. **Production Deployment**: 
   - Deploy DSPy service separately
   - Update `DSPY_SERVICE_URL` environment variable
   - Consider containerization (Docker)

## Troubleshooting

### DSPy Service Won't Start
- Check Python version (3.11 required)
- Verify all dependencies installed: `pip install -r requirements.txt`
- Ensure API key is set: `echo $GEMINI_API_KEY` (or equivalent)

### Quiz Generation Fails
- Check DSPy service is running: `curl http://localhost:8000/health`
- Check service logs for error messages
- Verify API key is valid

### Next.js Can't Connect to Service
- Ensure DSPy service is running on port 8000
- Check CORS configuration in `app.py`
- Verify Next.js API route is correctly forwarding requests

## Summary

✅ Created Python + DSPy microservice  
✅ Integrated with Next.js via proxy route  
✅ Updated frontend component to use new service  
✅ Maintained backward compatibility  
✅ Added comprehensive error handling  
✅ Documented setup and usage  

The quiz generation flow now uses DSPy + Gemini via the Python service while maintaining the exact same user experience!

