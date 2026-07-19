from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv
load_dotenv()

from database import engine
import models
from routers import auth, exams, submissions, analytics, quizzes, study_planner, flagged, questions, structured_submissions, proctoring, assignments

models.Base.metadata.create_all(bind=engine)

# create_all only creates missing tables — it never alters existing ones, so
# columns/constraints added to models after a table already exists need an
# explicit, idempotent migration here.
with engine.connect() as _conn:
    try:
        _conn.exec_driver_sql("ALTER TABLE assignments ADD COLUMN submission_format TEXT DEFAULT 'both'")
        _conn.commit()
    except Exception:
        pass
    try:
        _conn.exec_driver_sql(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_submission_exam_student ON submissions (exam_id, student_id)"
        )
        _conn.commit()
    except Exception:
        pass
    try:
        _conn.exec_driver_sql(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_assignmentsubmission_assignment_student "
            "ON assignment_submissions (assignment_id, student_id)"
        )
        _conn.commit()
    except Exception:
        pass

app = FastAPI(title="GradicAI API", version="1.0.0")

# Wide-open "*" origins is only harmless here because allow_credentials=False
# (auth is a bearer JWT header, not a cookie) — but scope it to local dev
# origins anyway rather than leaving it open to literally any site. Vite picks
# the next free port when its default is taken (5173, 5174, 5175, ...), so
# match any localhost/127.0.0.1 port instead of hardcoding one — a fixed
# allowlist broke every request the moment the frontend ran on a non-default
# port. ALLOWED_ORIGINS stays available to additionally allow a real deployed
# frontend origin in production.
ALLOWED_ORIGINS = [o for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"(http://(localhost|127\.0\.0\.1):\d+)|(https://.*\.vercel\.app)",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads/question_papers", exist_ok=True)
os.makedirs("uploads/marking_schemes", exist_ok=True)
os.makedirs("uploads/answer_sheets", exist_ok=True)
os.makedirs("uploads/assignment_questions", exist_ok=True)
os.makedirs("uploads/assignment_marking_schemes", exist_ok=True)
os.makedirs("uploads/assignment_answers", exist_ok=True)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(exams.router, prefix="/exams", tags=["Exams"])
app.include_router(submissions.router, prefix="/submissions", tags=["Submissions"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
app.include_router(quizzes.router, prefix="/quizzes", tags=["Quizzes"])
app.include_router(study_planner.router, prefix="/study-planner", tags=["Study Planner"])
app.include_router(flagged.router, prefix="/flagged", tags=["Flagged Answers"])
app.include_router(questions.router, tags=["Questions"])
app.include_router(structured_submissions.router, prefix="/submissions", tags=["Structured Submissions"])
app.include_router(proctoring.router, prefix="/proctoring", tags=["Proctoring"])
app.include_router(assignments.router, prefix="/assignments", tags=["Assignments"])


@app.get("/")
def root():
    return {"message": "GradicAI API is running"}
