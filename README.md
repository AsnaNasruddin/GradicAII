# GradicAI — AI-Powered Exam & Grading Platform

An intelligent exam platform with AI grading, Google Forms-style structured exams, and live YOLOv8 proctoring.

---

## What It Does

| Feature | Description |
|---|---|
| Teacher Portal | Upload exams, build structured question papers, manage grades |
| Student Portal | Take online exams, submit physical answer sheets, view AI feedback |
| AI Grading | GPT-4o grades open-ended answers with per-question feedback |
| AI Proctoring | Live webcam monitoring — detects phones, books, multiple people |
| Structured Exams | Google Forms-style per-question UI with voice-to-text support |
| AI Quizzes | Auto-generated easy/medium/hard practice quizzes from exam content |

---

## Project Structure

```
project/
├── backend/              # FastAPI REST API (port 8000)
│   ├── routers/          # API route handlers
│   ├── services/         # AI grading, quiz generation, study planner
│   ├── uploads/          # Uploaded PDFs stored here
│   ├── main.py
│   ├── models.py         # SQLAlchemy DB models
│   ├── requirements.txt
│   └── .env              # API keys (create this — see below)
├── proctoring_service/   # YOLOv8 proctoring microservice (port 8001)
│   ├── main.py           # FastAPI + WebSocket server
│   ├── detector.py       # YOLOv8 inference
│   └── yolov8n.pt        # YOLO model (auto-downloaded if missing)
└── frontend/             # React + Vite (port 5173)
    └── src/
        ├── pages/        # Teacher and Student portal pages
        └── components/   # Exam, Proctoring, Builder components
```

---

## Prerequisites

Install these before starting:

- **Python 3.9+** — https://www.python.org/downloads/
  - During install tick **"Add Python to PATH"**
- **Node.js 18+** — https://nodejs.org/en/download
- **Git** (optional) — https://git-scm.com/download/win

---

## Setup Guide (Windows)

Open **Command Prompt** or **PowerShell** in the project folder.

### Step 1 — Backend

```cmd
cd backend

:: Create virtual environment
python -m venv venv

:: Activate it
venv\Scripts\activate

:: Install dependencies
pip install -r requirements.txt

:: Upgrade OpenAI to latest (required)
pip install --upgrade openai
```

Create the `.env` file inside the `backend/` folder (or copy `backend/.env.example` and fill it in):

```
SECRET_KEY=gradicai-dev-secret-key-change-in-production
OPENAI_API_KEY=sk-proj-your-openai-key-here
PROCTORING_INTERNAL_KEY=any-long-random-string-you-make-up
```

> Get your OpenAI API key from https://platform.openai.com/api-keys
>
> `PROCTORING_INTERNAL_KEY` is a shared secret between the backend and the proctoring
> service (Step 2) — it just needs to be some long random string, but it **must be set**.
> If it's missing, the proctoring service can still detect violations live, but every
> violation event will silently fail to save to the database (a 401 from the backend),
> so the teacher will never see them recorded.

### Step 2 — Proctoring Service

Open a **second** Command Prompt window:

```cmd
cd proctoring_service

:: Use the same venv from backend (it has all packages)
..\backend\venv\Scripts\activate

:: Install proctoring-specific packages
pip install ultralytics fastapi uvicorn httpx watchfiles pillow numpy
```

> The YOLOv8 model (`yolov8n.pt`) is already included. If missing it will auto-download (~6 MB).

### Step 3 — Frontend

Open a **third** Command Prompt window:

```cmd
cd frontend
npm install
```

---

## Running the Project

You need **3 terminal windows open** at the same time.

### Terminal 1 — Backend API

```cmd
cd backend
venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

You should see:
```
Application startup complete.
Uvicorn running on http://127.0.0.1:8000
```

### Terminal 2 — Proctoring Service

```cmd
cd proctoring_service
..\backend\venv\Scripts\activate
python main.py
```

You should see:
```
[Proctoring] YOLOv8 model loaded and ready
Uvicorn running on http://0.0.0.0:8001
```

### Terminal 3 — Frontend

```cmd
cd frontend
npm run dev
```

You should see:
```
VITE ready in ...ms
Local: http://localhost:5173/
```

---

## Open the App

Go to **http://localhost:5173** in your browser (Chrome recommended).

### Default Accounts

Register a new account on the login page and select your role:
- **Teacher** — upload exams, build question papers, view submissions
- **Student** — take exams, view grades and AI feedback

---

## How to Use

### Teacher — Create an Online Exam

1. Go to **Grade Management** → click **+ Add New Exam**
2. Fill in exam details, select **Online** as submission type
3. Toggle **🛡 AI Proctoring** ON if you want camera monitoring
4. Upload a **Question Paper PDF**
5. Click **Upload Exam** — AI automatically extracts questions from your PDF
6. Students can now take the exam immediately

### Teacher — Create a Physical Exam

1. Same as above, select **Physical** as submission type
2. Students upload a photo/scan of their answer sheet
3. AI grades it automatically against the marking scheme

### Student — Take an Exam

1. Go to **Grades & Feedback** → find your exam
2. Click **Take Structured Exam** or **Take Exam Online**
3. Read the briefing screen (camera check + rules) → click **Start Exam**
4. Answer questions one by one → Submit

### AI Proctoring Rules

The system gives **3 warnings** then terminates the exam:

| Detection | Warning |
|---|---|
| Mobile phone visible | Warning issued |
| Study book/notes visible | Warning issued |
| Multiple people on camera | Warning issued |
| Face not in frame | Warning issued |
| 3rd warning | Exam terminated, teacher notified |

---

## Troubleshooting

**"ModuleNotFoundError"** — Make sure the venv is activated (`venv\Scripts\activate`)

**"Address already in use"** — A previous server is still running. Close all terminals and reopen.

**Camera not working in browser** — Allow camera access when prompted. In Chrome go to Settings → Privacy → Camera → allow localhost.

**AI extracting mock questions** — Check your `OPENAI_API_KEY` in `.env` is correct and has credits.

**Proctoring not detecting** — Make sure the proctoring service (Terminal 2) is running and you see the green dot in the camera widget during the exam.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy, SQLite |
| AI Grading | GPT-4o (OpenAI) |
| Proctoring | YOLOv8n (Ultralytics), WebSocket |
| Auth | JWT tokens (python-jose) |

done!