from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional, List
from datetime import datetime, timedelta
import uuid, os, shutil

from database import get_db
import models, schemas
from dependencies import get_current_user, require_teacher, require_student
from services.ai_grading import grade_submission
from services.upload_validation import validate_upload

router = APIRouter()

UPLOAD_DIR = "uploads"


def save_answer_sheet(file: UploadFile) -> str:
    validate_upload(file)
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{ext}"
    path = os.path.join(UPLOAD_DIR, "answer_sheets", filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return f"/uploads/answer_sheets/{filename}"


@router.post("/", response_model=schemas.SubmissionOut)
async def submit_answer(
    background_tasks: BackgroundTasks,
    exam_id: int = Form(...),
    submission_type: str = Form(...),  # upload | text
    digital_text: Optional[str] = Form(None),
    answer_sheet: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_student),
):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    now = datetime.utcnow()
    if now < exam.available_from:
        raise HTTPException(status_code=400, detail="This exam is not open yet")
    # Grace period equal to the exam's own duration — a student who legitimately
    # started right at the deadline still needs the full time to submit.
    grace = timedelta(minutes=exam.duration_minutes or 0)
    if now > exam.available_until + grace:
        raise HTTPException(status_code=400, detail="This exam's submission window has closed")

    fmt = exam.submission_format or "both"
    if fmt == "typed" and submission_type != "text":
        raise HTTPException(status_code=400, detail="This exam requires typed answers")
    if fmt == "upload" and submission_type != "upload":
        raise HTTPException(status_code=400, detail="This exam requires an uploaded answer sheet")

    existing = db.query(models.Submission).filter(
        models.Submission.exam_id == exam_id,
        models.Submission.student_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have already submitted for this exam")

    answer_url = None
    if submission_type == "upload" and answer_sheet:
        answer_url = save_answer_sheet(answer_sheet)
    elif submission_type == "text" and not digital_text:
        raise HTTPException(status_code=400, detail="digital_text required for text submission")

    submission = models.Submission(
        exam_id=exam_id,
        student_id=current_user.id,
        submission_type=submission_type,
        answer_sheet_url=answer_url,
        digital_text=digital_text,
        status="processing",
    )
    db.add(submission)
    try:
        db.commit()
    except IntegrityError:
        # DB-level unique constraint catches the race the "existing" check above
        # can't: two near-simultaneous submit requests (double-click, retry).
        db.rollback()
        raise HTTPException(status_code=400, detail="You have already submitted for this exam")
    db.refresh(submission)

    background_tasks.add_task(grade_submission, submission.id)

    out = schemas.SubmissionOut.model_validate(submission)
    out.student_name = current_user.name
    out.exam_title = exam.title
    out.exam_subject = exam.subject
    out.teacher_name = exam.teacher.name
    out.total_marks = exam.total_marks
    return out


# Statuses where the AI's grade is finalized/approved (graded, terminated) or where
# no real evaluation happened at all (needs_review — extraction failed, nothing to
# hide). Any other status means an AI score/feedback exists but hasn't been approved
# by the teacher yet, so it must not be shown to the student — see ai_grading.py's
# "teacher must approve before student sees grade" comment.
_APPROVED_OR_NO_GRADE_STATUSES = {"graded", "terminated", "needs_review"}


def _redact_unapproved_grade(out: schemas.SubmissionOut) -> schemas.SubmissionOut:
    if out.status not in _APPROVED_OR_NO_GRADE_STATUSES:
        out.ai_score = None
        out.ai_feedback = None
        out.question_analysis = None
    return out


@router.get("/my", response_model=List[schemas.SubmissionOut])
def my_submissions(db: Session = Depends(get_db), current_user: models.User = Depends(require_student)):
    subs = db.query(models.Submission).filter(models.Submission.student_id == current_user.id).all()
    results = []
    for s in subs:
        out = schemas.SubmissionOut.model_validate(s)
        out.student_name = s.student.name
        out.exam_title = s.exam.title
        out.exam_subject = s.exam.subject
        out.teacher_name = s.exam.teacher.name
        out.total_marks = s.exam.total_marks
        results.append(_redact_unapproved_grade(out))
    return results


@router.get("/exam/{exam_id}", response_model=List[schemas.SubmissionOut])
def exam_submissions(exam_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(require_teacher)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id, models.Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    subs = db.query(models.Submission).filter(models.Submission.exam_id == exam_id).all()
    results = []
    for s in subs:
        out = schemas.SubmissionOut.model_validate(s)
        out.student_name = s.student.name
        out.exam_title = s.exam.title
        out.exam_subject = s.exam.subject
        out.teacher_name = current_user.name
        out.total_marks = s.exam.total_marks
        results.append(out)
    return results


@router.get("/teacher/all", response_model=List[schemas.SubmissionOut])
def all_teacher_submissions(db: Session = Depends(get_db), current_user: models.User = Depends(require_teacher)):
    exam_ids = [e.id for e in db.query(models.Exam).filter(models.Exam.teacher_id == current_user.id).all()]
    subs = db.query(models.Submission).filter(models.Submission.exam_id.in_(exam_ids)).all()
    results = []
    for s in subs:
        out = schemas.SubmissionOut.model_validate(s)
        out.student_name = s.student.name
        out.exam_title = s.exam.title
        out.exam_subject = s.exam.subject
        out.teacher_name = current_user.name
        out.total_marks = s.exam.total_marks
        results.append(out)
    return results


@router.post("/{submission_id}/teacher-review", response_model=schemas.SubmissionOut)
def teacher_review(
    submission_id: int,
    action: str,                      # "approve" | "override"
    final_score: Optional[float] = None,
    teacher_notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_teacher),
):
    from datetime import datetime
    sub = db.query(models.Submission).filter(models.Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if sub.exam.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if action == "approve":
        sub.status = "graded"
        sub.final_score = sub.ai_score
    elif action == "override":
        if final_score is None:
            raise HTTPException(status_code=400, detail="final_score required for override")
        sub.status = "graded"
        sub.final_score = final_score
    else:
        raise HTTPException(status_code=400, detail="action must be approve or override")

    sub.teacher_notes = teacher_notes
    sub.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(sub)

    out = schemas.SubmissionOut.model_validate(sub)
    out.student_name = sub.student.name
    out.exam_title = sub.exam.title
    out.exam_subject = sub.exam.subject
    out.teacher_name = current_user.name
    out.total_marks = sub.exam.total_marks
    return out
