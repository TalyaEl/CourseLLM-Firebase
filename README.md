# CourseWise – IST Pipeline

An intelligent tutoring system that extracts **Intent**, **Skills**, and **Trajectory** (IST) from student interactions to provide personalized, Socratic-style guidance in computer science courses.

## 🎯 What is This?

CourseWise implements an **IST extraction pipeline** that:
- **Analyzes student questions** to understand their learning intent
- **Identifies relevant CS skills** the student needs to develop
- **Recommends personalized learning trajectories** based on their history and profile

The system uses a hybrid architecture combining:
- **Next.js 15** (TypeScript) for the frontend and chat interface
- **DSPy + FastAPI** microservice for AI-powered IST extraction
- **JSON-based storage** for rapid local development

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Frontend                         │
│  (Socratic Chat UI on port 9002)                            │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Student asks: "I don't understand recursion"        │   │
│  │       ↓                                               │   │
│  │  extractAndStoreIST() in src/lib/ist/extractIST.ts  │   │
│  │       ↓                                               │   │
│  │  IstContextService builds rich context:              │   │
│  │  • current utterance                                 │   │
│  │  • course context (course name, topic, syllabus)    │   │
│  │  • chat_history (recent conversation)                │   │
│  │  • ist_history (previous IST events)                 │   │
│  │  • student_profile (strong/weak skills, progress)    │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                    │
└──────────────────────────┼───────────────────────────────────┘
                           │ HTTP POST
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│            DSPy FastAPI Microservice (port 8000)            │
│                                                               │
│  POST /api/intent-skill-trajectory                          │
│       ↓                                                       │
│  IntentSkillTrajectoryModule (DSPy)                         │
│  • Uses GPT-4o-mini or Gemini 1.5 Flash                    │
│  • Analyzes enriched context with chat & IST history        │
│  • Returns structured output:                               │
│    {                                                         │
│      "intent": "Understand recursion...",                   │
│      "skills": ["Recursion", "Base Cases", ...],           │
│      "trajectory": ["Review recursion basics", ...]         │
│    }                                                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│               Storage Layer                                  │
│  • JSON: src/mocks/ist/events.json (local dev)             │
│  • Postgres: src/lib/db/ (optional, for production)        │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### Next.js Frontend (`src/`)
- **`src/lib/ist/extractIST.ts`**: Main orchestrator that calls the DSPy service
- **`src/lib/ist/istContextService.ts`**: Builds rich `IstContext` with chat history, IST history, and student profile
- **`src/lib/ist/repositories/`**: Storage layer for IST events and chat messages
  - `jsonIstEventRepository.ts`: JSON-based storage (for local dev)
  - `postgresIstEventRepository.ts`: Postgres stub (for production)
  - `chatHistoryRepository.ts`: Chat message history
- **`src/lib/ist/types.ts`**: TypeScript types (`IstEvent`, `IstContext`, `ChatMessage`, `StudentProfile`)

#### DSPy Microservice (`dspy_service/`)
- **`app.py`**: FastAPI server with CORS configuration and `/api/intent-skill-trajectory` endpoint
- **`dspy_flows.py`**: DSPy module implementation
  - `IntentSkillTrajectorySignature`: Defines the prompt structure
  - `IntentSkillTrajectoryModule`: Executes the LLM call and normalizes output
  - Supports OpenAI (GPT-4o-mini) or Google (Gemini 1.5 Flash)

## 🚀 How to Run Locally

### Prerequisites

- **Node.js 20+** and **npm**
- **Python 3.11+**
- An **OpenAI API key** (for GPT-4o-mini) OR a **Google Gemini API key**

### Step 1: Start the DSPy Microservice

1. **Navigate to the DSPy service folder:**
   ```bash
   cd dspy_service
   ```

2. **Create a Python virtual environment:**
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate

   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Create a `.env` file in `dspy_service/` with your API key:**
   ```bash
   # For OpenAI (default)
   OPENAI_API_KEY=sk-your-openai-api-key-here
   LLM_PROVIDER=openai
   LLM_MODEL=openai/gpt-4o-mini

   # OR for Google Gemini
   # GEMINI_API_KEY=your-gemini-api-key-here
   # LLM_PROVIDER=gemini
   # LLM_MODEL=gemini/gemini-1.5-flash
   ```

5. **Start the FastAPI server:**
   ```bash
   uvicorn app:app --reload --port 8000
   ```

   You should see:
   ```
   🔧 Initializing DSPy Intent–Skill–Trajectory extractor...
   ✅ DSPy service initialized successfully
   INFO:     Uvicorn running on http://0.0.0.0:8000
   ```

6. **Test the health endpoint** (optional):
   ```bash
   curl http://localhost:8000/health
   ```

### Step 2: Start the Next.js Development Server

1. **Open a new terminal** and navigate to the project root (not inside `dspy_service/`)

2. **Install Node dependencies:**
   ```bash
   npm install
   ```

3. **Create a `.env.local` file** in the project root:
   ```bash
   # Next.js configuration
   NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   
   # IST Demo Mode (set to "true" for demo, "false" for production)
   IST_DEMO_MODE=true
   
   # DSPy service URL (local development)
   DSPY_SERVICE_URL=http://localhost:8000
   ```

   > **Note:** For demo mode testing, you can use placeholder Firebase values. Demo mode uses canned data.

4. **Start the Next.js dev server:**
   ```bash
   npm run dev
   ```

   The app will start on **http://localhost:9002**

5. **Open your browser** and navigate to:
   ```
   http://localhost:9002/student/courses
   ```

### Step 3: Test the IST Pipeline

1. **Log in as a demo user** (in demo mode, any credentials work)
2. **Navigate to a course** and open the chat interface
3. **Ask a question** like:
   - "I don't understand dynamic programming"
   - "How does recursion work?"
   - "Can you explain binary search trees?"

4. The system will:
   - Send your message + context to the DSPy service
   - Extract intent, skills, and trajectory
   - Store the IST event in `src/mocks/ist/events.json`
   - Display personalized learning guidance

## 🎭 Demo Mode

When `IST_DEMO_MODE=true` in `.env.local`, the system uses:
- **Demo user:** `demo-user-1`
- **Demo course:** `cs-demo-101`
- **Canned chat history** from `istContextService.ts`
- **JSON storage** in `src/mocks/ist/events.json` (auto-created)

This allows you to test the IST pipeline without setting up Firebase or a real database.

To **clear demo data**, delete `src/mocks/ist/events.json` and restart the Next.js server.

## 📂 Folder Structure

```
CourseLLM-Firebase/
├── dspy_service/               # Python DSPy microservice
│   ├── app.py                  # FastAPI server
│   ├── dspy_flows.py          # DSPy module (IST extractor)
│   ├── requirements.txt        # Python dependencies
│   ├── .env                    # API keys (git-ignored)
│   └── venv/                   # Python virtual environment (git-ignored)
│
├── src/
│   ├── lib/
│   │   ├── ist/               # IST pipeline implementation
│   │   │   ├── types.ts       # TypeScript types
│   │   │   ├── extractIST.ts  # Main orchestrator
│   │   │   ├── istContextService.ts  # Context builder
│   │   │   ├── repository.ts  # Repository interfaces
│   │   │   └── repositories/  # Storage implementations
│   │   │       ├── jsonIstEventRepository.ts
│   │   │       ├── postgresIstEventRepository.ts
│   │   │       └── chatHistoryRepository.ts
│   │   └── db/
│   │       └── pgClient.ts    # Postgres client (optional)
│   │
│   ├── mocks/
│   │   └── ist/
│   │       └── events.json    # JSON storage (demo mode)
│   │
│   ├── components/            # React UI components
│   │   └── student/
│   │       └── SocraticChat.tsx  # Chat interface
│   │
│   └── app/                   # Next.js 15 app router
│       ├── student/           # Student pages
│       └── api/               # API routes
│
├── .env.local                 # Next.js environment variables (git-ignored)
├── .gitignore                 # Git ignore rules
├── package.json               # Node.js dependencies
└── README.md                  # This file
```

## 🔐 Security Notes

**Never commit API keys or secrets to git!**

All sensitive data should be stored in:
- `dspy_service/.env` (for Python service)
- `.env.local` (for Next.js app)

These files are **git-ignored** and must be created manually on each machine.

## 🧪 Testing

### Manual Testing
1. Start both servers (DSPy + Next.js)
2. Open the chat interface
3. Send test messages and verify IST extraction

### API Testing (DSPy service)
```bash
curl -X POST http://localhost:8000/api/intent-skill-trajectory \
  -H "Content-Type: application/json" \
  -d '{
    "utterance": "I need help with sorting algorithms",
    "course_context": "Data Structures and Algorithms - Week 3"
  }'
```

Expected response:
```json
{
  "intent": "Understand sorting algorithms",
  "skills": ["Sorting", "Algorithm Analysis", "Big-O Notation"],
  "trajectory": [
    "Review comparison-based sorting concepts",
    "Study merge sort and quick sort implementations",
    "Solve 2-3 sorting algorithm practice problems"
  ]
}
```

## 🐛 Troubleshooting

### DSPy service won't start
- **Problem:** `OPENAI_API_KEY is not set` error
- **Solution:** Create `dspy_service/.env` with a valid API key (not a placeholder like "sk-...")

### Next.js can't connect to DSPy service
- **Problem:** CORS errors or connection refused
- **Solution:** 
  1. Verify DSPy service is running on port 8000
  2. Check `DSPY_SERVICE_URL=http://localhost:8000` in `.env.local`
  3. Ensure CORS origins in `dspy_service/app.py` include port 9002

### IST events not saving
- **Problem:** `events.json` not created or not updating
- **Solution:**
  1. Ensure `IST_DEMO_MODE=true` in `.env.local`
  2. Check that `src/mocks/ist/` directory exists
  3. Verify write permissions on the project folder

### Empty or invalid IST responses
- **Problem:** Intent/skills/trajectory are empty or generic
- **Solution:**
  1. Check DSPy service logs for LLM errors
  2. Verify your API key has sufficient credits
  3. Try a different LLM model (e.g., switch from `gpt-4o-mini` to `gpt-4o`)

## 🚧 Future Work

- [ ] Add Postgres production storage
- [ ] Implement IST event visualization dashboard
- [ ] Add skill progression tracking
- [ ] Support multi-language student utterances (currently works but intent is in English)
- [ ] Add RAG (Retrieval-Augmented Generation) for course-specific knowledge

## 📄 License

Private educational project - not for redistribution.

## 👥 Authors

CourseWise IST Pipeline – Computer Science Department

---

**Ready to run?** Start with Step 1 above! 🚀
