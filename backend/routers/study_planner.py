from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import json

from database import get_db
import models, schemas
from dependencies import require_student
from services.study_ai import generate_study_plan

router = APIRouter()


@router.get("/", response_model=List[schemas.StudySessionOut])
def get_sessions(db: Session = Depends(get_db), current_user: models.User = Depends(require_student)):
    return db.query(models.StudySession).filter(models.StudySession.student_id == current_user.id).order_by(models.StudySession.scheduled_date).all()


@router.post("/", response_model=schemas.StudySessionOut)
def add_session(
    session_data: schemas.StudySessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_student),
):
    session = models.StudySession(
        student_id=current_user.id,
        topic=session_data.topic,
        subject=session_data.subject,
        scheduled_date=session_data.scheduled_date,
        duration_minutes=session_data.duration_minutes,
        tags=json.dumps(session_data.tags or []),
        is_ai_generated=False,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


class GeneratePlanRequest(BaseModel):
    subjects: List[str] = []
    goals: Optional[str] = ""
    hours_per_day: Optional[int] = 2
    exam_pressure: Optional[str] = "medium"  # low | medium | high


@router.post("/generate", response_model=List[schemas.StudySessionOut])
def generate_ai_sessions(
    request: GeneratePlanRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_student)
):
    sessions = generate_study_plan(
        student_id=current_user.id,
        db=db,
        subjects=request.subjects,
        goals=request.goals,
        hours_per_day=request.hours_per_day,
        exam_pressure=request.exam_pressure,
    )
    return sessions


@router.delete("/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(require_student)):
    session = db.query(models.StudySession).filter(
        models.StudySession.id == session_id,
        models.StudySession.student_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"message": "Session deleted"}


class GenerateContentRequest(BaseModel):
    topic: str
    subject: str
    activity_type: str


@router.post("/generate-content")
def generate_content(
    request: GenerateContentRequest,
    current_user: models.User = Depends(require_student)
):
    from services.study_ai import generate_study_content
    result = generate_study_content(request.topic, request.subject, request.activity_type)
    if result["type"] == "error":
        raise HTTPException(status_code=500, detail=result["content"])
    return result
