import os
import base64
import binascii
import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from database import get_db
import models, schemas
from dependencies import get_current_user, require_teacher

router = APIRouter()

INTERNAL_KEY = os.getenv("PROCTORING_INTERNAL_KEY", "")


def verify_internal_key(x_internal_key: Optional[str] = Header(None)):
    """The proctoring microservice (not a browser) calls /event directly with no
    user session — gate it with a shared secret instead of leaving it wide open
    to the internet, which would otherwise let anyone fabricate cheating events
    and permanently block any student from any exam."""
    if not INTERNAL_KEY or x_internal_key != INTERNAL_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing internal service key")

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")  # persistent-disk path in production
SCREENSHOT_DIR = os.path.join(UPLOAD_DIR, "proctoring_screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)


def save_screenshot(b64_frame: str) -> Optional[str]:
    try:
        if "," in b64_frame:
            b64_frame = b64_frame.split(",", 1)[1]
        raw = base64.b64decode(b64_frame)
        filename = f"{uuid.uuid4()}.jpg"
        filepath = os.path.join(SCREENSHOT_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(raw)
        return f"/uploads/proctoring_screenshots/{filename}"
    except (binascii.Error, ValueError, OSError) as e:
        # Expected failure modes only — malformed base64 or a disk/file error. A
        # bare `except Exception` here would also silently swallow an unrelated
        # programming bug and make it indistinguishable from a corrupt frame.
        print(f"[proctoring] screenshot save failed: {e}")
        return None


class ProctoringEventIn(BaseModel):
    session_key: str
    exam_id: Optional[int] = None
    student_id: Optional[int] = None
    event_type: str
    warning_level: int
    terminated: bool = False
    frame_b64: Optional[str] = None  # screenshot of violation moment


@router.post("/event")
def log_event(data: ProctoringEventIn, db: Session = Depends(get_db), _=Depends(verify_internal_key)):
    """Called by the proctoring microservice only — gated by verify_internal_key."""

    # Save screenshot if frame provided
    screenshot_url = None
    if data.frame_b64:
        screenshot_url = save_screenshot(data.frame_b64)

    # Find or create proctoring session (keyed by session_key string)
    # We store session_key in termination_reason for lookup. Escape LIKE
    # wildcards in the (client-supplied) key itself so a literal "%"/"_" can't
    # make this match a different student's session.
    escaped_key = data.session_key.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    session = db.query(models.ProctoringSession).filter(
        models.ProctoringSession.termination_reason.like(f"session_key:{escaped_key}%", escape="\\")
    ).first()

    if not session:
        session = models.ProctoringSession(
            submission_id=None,
            termination_reason=f"session_key:{data.session_key}"
        )
        db.add(session)
        db.flush()

    session.warning_count = data.warning_level

    if data.terminated:
        session.terminated = True
        session.termination_reason = f"session_key:{data.session_key} | 3 violations — {data.event_type}"
        session.ended_at = datetime.utcnow()

        # Permanently block student from this exam
        if data.student_id and data.exam_id:
            existing_block = db.query(models.ExamBlock).filter(
                models.ExamBlock.student_id == data.student_id,
                models.ExamBlock.exam_id == data.exam_id,
            ).first()
            if not existing_block:
                # Collect all screenshot URLs from this session's events
                existing_screenshots = [
                    e.frame_snapshot_url for e in session.events if e.frame_snapshot_url
                ]
                if screenshot_url:
                    existing_screenshots.append(screenshot_url)

                block = models.ExamBlock(
                    student_id=data.student_id,
                    exam_id=data.exam_id,
                    session_key=data.session_key,
                    screenshot_urls=json.dumps(existing_screenshots),
                )
                db.add(block)

            # Create a terminated submission so teacher can see it
            terminated_sub = db.query(models.Submission).filter(
                models.Submission.student_id == data.student_id,
                models.Submission.exam_id == data.exam_id,
                models.Submission.status == "terminated",
            ).first()
            if not terminated_sub:
                exam = db.query(models.Exam).filter(models.Exam.id == data.exam_id).first()
                terminated_sub = models.Submission(
                    exam_id=data.exam_id,
                    student_id=data.student_id,
                    submission_type="structured",
                    status="terminated",
                    ai_score=0,
                    ai_feedback="Exam terminated due to 3 proctoring violations. Student was caught cheating.",
                    question_analysis=json.dumps([]),
                )
                db.add(terminated_sub)
                db.flush()
                session.submission_id = terminated_sub.id

    # Log the proctoring event
    event = models.ProctoringEvent(
        session_id=session.id,
        event_type=data.event_type,
        warning_level=data.warning_level,
        frame_snapshot_url=screenshot_url,
    )
    db.add(event)
    db.commit()
    return {"ok": True}


@router.get("/blocks/my", response_model=List[dict])
def my_blocks(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Returns exam IDs the current student is blocked from."""
    blocks = db.query(models.ExamBlock).filter(
        models.ExamBlock.student_id == current_user.id
    ).all()
    return [{"exam_id": b.exam_id, "blocked_at": b.blocked_at.isoformat()} for b in blocks]


@router.get("/screenshots/{submission_id}")
def get_screenshots(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_teacher),
):
    """Returns all violation screenshots for a submission."""
    sub = db.query(models.Submission).filter(models.Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if sub.exam.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Find block record for this student+exam (has all screenshot URLs)
    block = db.query(models.ExamBlock).filter(
        models.ExamBlock.student_id == sub.student_id,
        models.ExamBlock.exam_id == sub.exam_id,
    ).first()

    screenshots = []
    if block and block.screenshot_urls:
        try:
            screenshots = json.loads(block.screenshot_urls)
        except json.JSONDecodeError as e:
            print(f"[proctoring] corrupt screenshot_urls for block {block.id}: {e}")

    # Also check proctoring events directly
    session = db.query(models.ProctoringSession).filter(
        models.ProctoringSession.submission_id == submission_id
    ).first()
    if session:
        for e in session.events:
            if e.frame_snapshot_url and e.frame_snapshot_url not in screenshots:
                screenshots.append(e.frame_snapshot_url)

    return {"screenshots": screenshots, "terminated": block is not None}


@router.get("/session/{submission_id}", response_model=schemas.ProctoringSessionOut)
def get_session(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    session = db.query(models.ProctoringSession).filter(
        models.ProctoringSession.submission_id == submission_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="No proctoring session found")
    sub = session.submission
    if sub:
        is_owner_student = current_user.role == "student" and sub.student_id == current_user.id
        is_owner_teacher = current_user.role == "teacher" and sub.exam.teacher_id == current_user.id
        if not (is_owner_student or is_owner_teacher):
            raise HTTPException(status_code=403, detail="Not authorized")
    return session


@router.get("/events/{submission_id}", response_model=List[schemas.ProctoringEventOut])
def get_events(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_teacher),
):
    session = db.query(models.ProctoringSession).filter(
        models.ProctoringSession.submission_id == submission_id
    ).first()
    if not session:
        return []
    if session.submission and session.submission.exam.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return session.events
