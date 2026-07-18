import os
import uuid
import shutil
import json
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel

from database import get_db
import models
from dependencies import get_current_user, require_teacher, require_student
from services.ai_grading import grade_submission
from services.upload_validation import validate_upload
from services.datetime_utils import parse_utc_datetime, iso_utc

router = APIRouter()

UPLOAD_DIR = "uploads"


def save_file(file: UploadFile, subfolder: str) -> str:
    validate_upload(file)
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{ext}"
    path = os.path.join(UPLOAD_DIR, subfolder, filename)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return f"/uploads/{subfolder}/{filename}"


def run_ai_grading(submission_id: int):
    from database import SessionLocal
    db = SessionLocal()
    try:
        sub = db.query(models.AssignmentSubmission).filter(models.AssignmentSubmission.id == submission_id).first()
        if not sub:
            return
        assignment = sub.assignment

        # Build a mock Submission-like object for grade_submission compatibility
        class MockSub:
            pass

        mock = MockSub()
        mock.id = sub.id
        mock.answer_sheet_url = sub.answer_sheet_url
        mock.digital_text = sub.digital_text
        mock.submission_type = sub.submission_type

        # Reuse AI grading logic inline
        from services.document_extract import extract_document_text
        from services.ai_grading import run_grading_ensemble

        question_text = extract_document_text(assignment.question_paper_url or "")
        marking_text = extract_document_text(assignment.marking_scheme_url or "")

        if sub.submission_type == "text":
            answer_text = sub.digital_text or ""
        else:
            answer_text = extract_document_text(sub.answer_sheet_url or "")

        if not answer_text.strip():
            sub.ai_score = 0
            sub.ai_feedback = (
                "Automatic grading could not read any content from the uploaded answer sheet. "
                "The file may be blank, corrupted, or too blurry to OCR. "
                "Please review it manually or ask the student to re-upload a clearer scan."
            )
            sub.question_analysis = json.dumps([])
            sub.status = "needs_review"  # no real evaluation happened — distinct from a graded, pending-approval submission
            return

        prompt = f"""You are an expert examiner. Grade the student's assignment strictly according to the marking scheme.

Question Paper:
{question_text or 'Not provided'}

Marking Scheme:
{marking_text}

Student's Answer:
{answer_text or 'No answer provided'}

Total Marks Available: {assignment.total_marks}
Passing Marks: {assignment.passing_marks}

IMPORTANT — how to read the student's answer:
- It may be an OCR transcript of handwritten pages (pages are marked with "=== Page N ==="). Minor OCR artifacts and [illegible] markers may appear; do not penalize the student for them — grade the legible content.
- Students label answers inconsistently ("Q1", "Question 3", rewriting the question as a heading, or no label at all). Match the student's writing to the correct question using labels when present and content similarity otherwise.
- A single answer may continue across multiple pages — treat continuation text as part of the same answer.
- Award marks strictly per the marking scheme. If a question has no relevant content anywhere, award 0 for it and say so.

CONSISTENCY RULES — follow these exactly so identical answers always receive identical marks:
- Every criterion listed in the marking scheme carries exactly the marks shown next to it. Never claim a listed criterion carries no marks — if it appears in the marking scheme, it must be scored.
- Award partial credit only for content that directly addresses the criterion. Related-but-off-topic content earns at most half of the criterion's marks, never full marks.
- In each "justification", quote the exact words from the answer that earned the marks (or state exactly what required content is absent).
- For criteria about presentation, neatness, headings or organization: judge them from the transcript's structure — section headings, ordering and completeness. If the transcript shows clear headings and a logical order, award these marks in full; deduct only if the structure is genuinely disorganized or headings are missing.
- Be strict, literal and consistent. Do not round marks up out of generosity.

Respond ONLY with valid JSON in this exact format:
{{
  "score": <number>,
  "percentage": <number>,
  "overall_feedback": "<string>",
  "question_analysis": [
    {{
      "question_number": <int>,
      "marks_awarded": <number>,
      "marks_available": <number>,
      "correct": <bool>,
      "feedback": "<string>",
      "justification": "<string>"
    }}
  ],
  "confidence": <number between 0 and 1>,
  "flags": []
}}"""

        result = run_grading_ensemble(prompt)

        sub.ai_score = result.get("score", 0)
        sub.ai_feedback = result.get("overall_feedback", "")
        sub.question_analysis = json.dumps(result.get("question_analysis", []))
        confidence = result.get("confidence", 1.0)
        flags = result.get("flags", [])
        # Same confidence/flags gate as exam grading (services/ai_grading.py) — low
        # confidence or suspicious flags mean this needs closer teacher scrutiny
        # before being treated as an ordinary pending-approval grade.
        sub.status = "flagged" if (confidence < 0.6 or flags) else "pending_review"

    except Exception as e:
        sub.ai_score = 0
        sub.ai_feedback = f"AI grading failed: {str(e)}"
        sub.status = "needs_review"
    finally:
        db.commit()
        db.close()


# ── Teacher endpoints ──────────────────────────────────────────────────────────

@router.post("/")
async def create_assignment(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    subject: str = Form(...),
    description: Optional[str] = Form(None),
    total_marks: int = Form(100),
    passing_marks: int = Form(50),
    due_date: str = Form(...),  # ISO datetime string
    submission_format: str = Form("both"),  # typed | upload | both
    question_paper: Optional[UploadFile] = File(None),
    marking_scheme: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_teacher),
):
    qp_url = save_file(question_paper, "assignment_questions") if question_paper and question_paper.filename else None
    ms_url = save_file(marking_scheme, "assignment_marking_schemes") if marking_scheme and marking_scheme.filename else None

    assignment = models.Assignment(
        teacher_id=current_user.id,
        title=title,
        subject=subject,
        description=description,
        total_marks=total_marks,
        passing_marks=passing_marks,
        due_date=parse_utc_datetime(due_date),
        question_paper_url=qp_url,
        marking_scheme_url=ms_url,
        has_marking_scheme=bool(ms_url),
        submission_format=submission_format,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return _assignment_out(assignment, db)


@router.get("/teacher/all-submissions")
def teacher_all_submissions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_teacher),
):
    my_assignment_ids = [a.id for a in db.query(models.Assignment).filter(
        models.Assignment.teacher_id == current_user.id
    ).all()]

    subs = db.query(models.AssignmentSubmission).filter(
        models.AssignmentSubmission.assignment_id.in_(my_assignment_ids)
    ).all()

    result = []
    for s in subs:
        student = db.query(models.User).filter(models.User.id == s.student_id).first()
        assignment = db.query(models.Assignment).filter(models.Assignment.id == s.assignment_id).first()
        result.append({
            "id": s.id,
            "assignment_id": s.assignment_id,
            "assignment_title": assignment.title if assignment else "",
            "student_id": s.student_id,
            "student_name": student.name if student else f"Student #{s.student_id}",
            "submission_type": s.submission_type,
            "status": s.status,
            "ai_score": s.ai_score,
            "ai_feedback": s.ai_feedback,
            "final_score": s.final_score,
            "teacher_notes": s.teacher_notes,
            "total_marks": assignment.total_marks if assignment else 100,
            "question_analysis": s.question_analysis,
            "submitted_at": iso_utc(s.submitted_at),
            "has_marking_scheme": assignment.has_marking_scheme if assignment else False,
            "answer_sheet_url": s.answer_sheet_url,
            "digital_text": s.digital_text,
        })
    return result


@router.post("/submissions/{submission_id}/teacher-review")
def teacher_review(
    submission_id: int,
    action: str,
    final_score: Optional[float] = None,
    teacher_notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_teacher),
):
    sub = db.query(models.AssignmentSubmission).filter(
        models.AssignmentSubmission.id == submission_id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if sub.assignment.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if action == "approve":
        sub.status = "graded"
        sub.final_score = sub.ai_score
    elif action == "override":
        if final_score is None:
            raise HTTPException(status_code=400, detail="final_score required for override")
        sub.status = "graded"
        sub.final_score = final_score
    elif action == "manual_grade":
        if final_score is None:
            raise HTTPException(status_code=400, detail="final_score required for manual grading")
        sub.status = "graded"
        sub.final_score = final_score

    sub.teacher_notes = teacher_notes
    sub.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "status": sub.status, "final_score": sub.final_score, "teacher_notes": sub.teacher_notes}


# ── Student endpoints ──────────────────────────────────────────────────────────

@router.get("/")
def list_assignments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    assignments = db.query(models.Assignment).all()
    return [_assignment_out(a, db) for a in assignments]


@router.post("/{assignment_id}/submit")
async def submit_assignment(
    background_tasks: BackgroundTasks,
    assignment_id: int,
    submission_type: str = Form(...),
    digital_text: Optional[str] = Form(None),
    answer_sheet: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_student),
):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if datetime.utcnow() > assignment.due_date:
        raise HTTPException(status_code=400, detail="Assignment deadline has passed")

    fmt = assignment.submission_format or "both"
    if fmt == "typed" and submission_type != "text":
        raise HTTPException(status_code=400, detail="This assignment requires typed answers")
    if fmt == "upload" and submission_type != "upload":
        raise HTTPException(status_code=400, detail="This assignment requires an uploaded answer file")

    existing = db.query(models.AssignmentSubmission).filter(
        models.AssignmentSubmission.assignment_id == assignment_id,
        models.AssignmentSubmission.student_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have already submitted this assignment")

    answer_url = None
    if submission_type == "upload" and answer_sheet and answer_sheet.filename:
        answer_url = save_file(answer_sheet, "assignment_answers")
    elif submission_type == "text" and not digital_text:
        raise HTTPException(status_code=400, detail="digital_text required for text submission")

    sub = models.AssignmentSubmission(
        assignment_id=assignment_id,
        student_id=current_user.id,
        submission_type=submission_type,
        answer_sheet_url=answer_url,
        digital_text=digital_text,
        status="processing" if assignment.has_marking_scheme else "manual_review",
    )
    db.add(sub)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="You have already submitted this assignment")
    db.refresh(sub)

    if assignment.has_marking_scheme:
        background_tasks.add_task(run_ai_grading, sub.id)

    return {"id": sub.id, "status": sub.status, "assignment_id": assignment_id}


# See submissions.py's _APPROVED_OR_NO_GRADE_STATUSES — same rule: don't reveal an
# AI grade to the student until a teacher has approved it (or there's no real grade
# to hide, e.g. needs_review/manual_review).
_ASSIGNMENT_APPROVED_OR_NO_GRADE_STATUSES = {"graded", "manual_review", "needs_review"}


@router.get("/my-submissions")
def my_submissions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_student),
):
    subs = db.query(models.AssignmentSubmission).filter(
        models.AssignmentSubmission.student_id == current_user.id
    ).all()
    result = []
    for s in subs:
        assignment = db.query(models.Assignment).filter(models.Assignment.id == s.assignment_id).first()
        approved = s.status in _ASSIGNMENT_APPROVED_OR_NO_GRADE_STATUSES
        result.append({
            "id": s.id,
            "assignment_id": s.assignment_id,
            "assignment_title": assignment.title if assignment else "",
            "status": s.status,
            "ai_score": s.ai_score if approved else None,
            "ai_feedback": s.ai_feedback if approved else None,
            "final_score": s.final_score,
            "teacher_notes": s.teacher_notes,
            "total_marks": assignment.total_marks if assignment else 100,
            "question_analysis": s.question_analysis if approved else None,
            "submitted_at": iso_utc(s.submitted_at),
            "has_marking_scheme": assignment.has_marking_scheme if assignment else False,
        })
    return result


def _assignment_out(assignment: models.Assignment, db: Session) -> dict:
    teacher = db.query(models.User).filter(models.User.id == assignment.teacher_id).first()
    return {
        "id": assignment.id,
        "title": assignment.title,
        "subject": assignment.subject,
        "description": assignment.description,
        "total_marks": assignment.total_marks,
        "passing_marks": assignment.passing_marks,
        "due_date": iso_utc(assignment.due_date),
        "question_paper_url": assignment.question_paper_url,
        "has_marking_scheme": assignment.has_marking_scheme,
        "submission_format": assignment.submission_format or "both",
        "teacher_name": teacher.name if teacher else "",
        "created_at": iso_utc(assignment.created_at),
    }
