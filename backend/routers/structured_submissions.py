import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

from database import get_db
import models, schemas
from dependencies import require_student, get_current_user
from services.ai_grading import grade_submission

router = APIRouter()


@router.post("/structured", response_model=schemas.SubmissionOut)
def submit_structured(
    background_tasks: BackgroundTasks,
    data: schemas.StructuredSubmissionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_student),
):
    exam = db.query(models.Exam).filter(models.Exam.id == data.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if not exam.is_structured:
        raise HTTPException(status_code=400, detail="This exam does not have structured questions")

    now = datetime.utcnow()
    if now < exam.available_from:
        raise HTTPException(status_code=400, detail="This exam is not open yet")
    grace = timedelta(minutes=exam.duration_minutes or 0)
    if now > exam.available_until + grace:
        raise HTTPException(status_code=400, detail="This exam's submission window has closed")

    existing = db.query(models.Submission).filter(
        models.Submission.exam_id == data.exam_id,
        models.Submission.student_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already submitted for this exam")

    # Build digital_text from answers for AI grading fallback
    questions = {q.id: q for q in exam.questions}
    text_parts = []
    mcq_score = 0
    mcq_total = 0

    for ans in data.answers:
        q = questions.get(ans.question_id)
        if not q:
            continue
        if q.question_type == "mcq":
            mcq_total += q.marks
            if ans.selected_option and q.correct_option and ans.selected_option.upper() == q.correct_option.upper():
                mcq_score += q.marks
            text_parts.append(f"Q{q.question_number} (MCQ, {q.marks} marks): {q.question_text}\nAnswer: {ans.selected_option or '(no answer)'}")
        else:
            text_parts.append(f"Q{q.question_number} ({q.question_type}, {q.marks} marks): {q.question_text}\nAnswer: {ans.answer_text or '(no answer)'}")

    digital_text = "\n\n".join(text_parts)

    submission = models.Submission(
        exam_id=data.exam_id,
        student_id=current_user.id,
        submission_type="structured",
        digital_text=digital_text,
        status="processing",
    )
    db.add(submission)
    try:
        db.flush()
    except IntegrityError:
        # DB-level unique constraint catches the race the "existing" check above
        # can't: two near-simultaneous submit requests (double-click, retry).
        db.rollback()
        raise HTTPException(status_code=400, detail="Already submitted for this exam")

    # Save individual answers
    for ans in data.answers:
        q = questions.get(ans.question_id)
        if not q:
            continue
        student_ans = models.StudentAnswer(
            submission_id=submission.id,
            question_id=ans.question_id,
            answer_text=ans.answer_text,
            selected_option=ans.selected_option,
            is_voice_answer=ans.is_voice_answer,
        )
        db.add(student_ans)

    db.commit()
    db.refresh(submission)

    background_tasks.add_task(grade_submission, submission.id)

    out = schemas.SubmissionOut.model_validate(submission)
    out.student_name = current_user.name
    out.exam_title = exam.title
    out.exam_subject = exam.subject
    out.teacher_name = exam.teacher.name
    out.total_marks = exam.total_marks
    return out


@router.get("/{submission_id}/answers", response_model=List[schemas.StudentAnswerOut])
def get_student_answers(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    sub = db.query(models.Submission).filter(models.Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if current_user.role == "student" and sub.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if current_user.role == "teacher" and sub.exam.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return sub.student_answers
