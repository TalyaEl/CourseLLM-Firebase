# Setup Notes for DSPy Service

## Current Implementation Status

This DSPy service has been created to replace the Genkit-based quiz generation flow. The implementation includes:

### Files Created:
1. **`requirements.txt`** - Python dependencies including DSPy, FastAPI, and Google Generative AI
2. **`quiz_flows.py`** - DSPy modules and quiz generation logic
3. **`app.py`** - FastAPI application with `/api/quiz` endpoint
4. **`README.md`** - Setup and usage instructions

### Integration Complete:
1. **Next.js API Route** - `src/app/api/dspy/quiz/route.ts` - Proxies requests to Python service
2. **Frontend Component** - `src/components/student/PracticeQuiz.tsx` - Updated to use new API

## Current Flow

1. User selects topic in PracticeQuiz component
2. Component calls `/api/dspy/quiz` (Next.js API route)
3. Next.js route forwards to `http://localhost:8000/api/quiz` (Python service)
4. Python service uses DSPy + Gemini to generate structured quiz JSON
5. Response flows back through Next.js route to frontend
6. Frontend transforms response and displays quiz

## DSPy Configuration Note

The `configure_dspy_gemini()` function in `quiz_flows.py` includes multiple fallback approaches to work with different DSPy v3 API variations. If DSPy configuration fails, the service will still work using `google-generativeai` directly, though some DSPy optimization features may not be available.

If you encounter issues with DSPy configuration, you can:
1. Check the DSPy version: `pip show dspy-ai`
2. Refer to the official DSPy v3 documentation for the exact API
3. The service will still function using direct Gemini calls as a fallback

## Testing

After setting up the service:

1. Start the DSPy service:
   ```powershell
   cd dspy_service
   .\venv\Scripts\activate
   python app.py
   ```

2. Start Next.js (in a separate terminal):
   ```bash
   npm run dev
   ```

3. Navigate to the student quiz page and generate a quiz

## Next Steps

- Verify DSPy v3 API compatibility and update configuration if needed
- Add difficulty level selector to the UI
- Expand to other flows (Socratic guidance, assessments, etc.)

