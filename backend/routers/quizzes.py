from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import json

from database import get_db
import models, schemas
from dependencies import get_current_user, require_student
from services.quiz_generator import generate_quiz_for_exam

router = APIRouter()


@router.get("/", response_model=List[schemas.QuizOut])
def list_quizzes(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.AIQuiz).all()


@router.post("/generate/{exam_id}", response_model=schemas.QuizOut)
def generate_quiz(
    exam_id: int,
    difficulty: str = "medium",
    topics: str = "",
    num_questions: Optional[int] = None,
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    quiz = generate_quiz_for_exam(exam, difficulty, db, topics=topics, num_questions=num_questions)
    return quiz


@router.post("/{quiz_id}/attempt", response_model=schemas.QuizAttemptOut)
def attempt_quiz(
    quiz_id: int,
    attempt_data: schemas.QuizAttemptCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_student),
):
    quiz = db.query(models.AIQuiz).filter(models.AIQuiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    questions = json.loads(quiz.questions)
    correct = 0
    for i, q in enumerate(questions):
        if i < len(attempt_data.answers):
            if attempt_data.answers[i].get("selected") == q.get("correct_answer"):
                correct += 1

    score = round((correct / len(questions)) * 100, 1) if questions else 0

    attempt = models.QuizAttempt(
        quiz_id=quiz_id,
        student_id=current_user.id,
        score=score,
        time_spent_seconds=attempt_data.time_spent_seconds,
        answers=json.dumps(attempt_data.answers),
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


@router.get("/my-attempts", response_model=List[schemas.QuizAttemptOut])
def my_attempts(db: Session = Depends(get_db), current_user: models.User = Depends(require_student)):
    return db.query(models.QuizAttempt).filter(models.QuizAttempt.student_id == current_user.id).all()
