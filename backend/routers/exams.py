from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import uuid, os, shutil

from database import get_db
import models, schemas
from dependencies import get_current_user, require_teacher
from services.upload_validation import validate_upload
from services.datetime_utils import to_naive_utc

router = APIRouter()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")  # persistent-disk path in production


def save_file(file: UploadFile, subfolder: str) -> str:
    validate_upload(file)
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{ext}"
    path = os.path.join(UPLOAD_DIR, subfolder, filename)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
    except OSError:
        raise HTTPException(status_code=500, detail="Failed to save uploaded file, please try again")
    return f"/uploads/{subfolder}/{filename}"


@router.post("/", response_model=schemas.ExamOut)
async def create_exam(
    title: str = Form(...),
    subject: str = Form(...),
    description: Optional[str] = Form(None),
    total_marks: int = Form(...),
    passing_marks: int = Form(...),
    available_from: datetime = Form(...),
    available_until: datetime = Form(...),
    duration_minutes: int = Form(...),
    exam_type: str = Form("physical"),
    submission_format: str = Form("both"),
    question_paper: Optional[UploadFile] = File(None),
    marking_scheme: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_teacher),
):
    qp_url = save_file(question_paper, "question_papers") if question_paper else None
    ms_url = save_file(marking_scheme, "marking_schemes") if marking_scheme else None

    exam = models.Exam(
        teacher_id=current_user.id,
        title=title,
        subject=subject,
        description=description,
        question_paper_url=qp_url,
        marking_scheme_url=ms_url,
        total_marks=total_marks,
        passing_marks=passing_marks,
        available_from=to_naive_utc(available_from),
        available_until=to_naive_utc(available_until),
        duration_minutes=duration_minutes,
        exam_type=exam_type,
        submission_format=submission_format,
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)

    result = schemas.ExamOut.model_validate(exam)
    result.teacher_name = current_user.name
    return result


def _redact_marking_scheme(out: schemas.ExamOut, current_user: models.User) -> schemas.ExamOut:
    # The marking scheme is the answer key — never expose it to students, only
    # to the teacher who owns the exam.
    if current_user.role != "teacher":
        out.marking_scheme_url = None
    return out


@router.get("/", response_model=List[schemas.ExamOut])
def list_exams(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role == "teacher":
        exams = db.query(models.Exam).filter(models.Exam.teacher_id == current_user.id).all()
    else:
        exams = db.query(models.Exam).all()

    results = []
    for exam in exams:
        out = schemas.ExamOut.model_validate(exam)
        out.teacher_name = exam.teacher.name
        results.append(_redact_marking_scheme(out, current_user))
    return results


@router.get("/{exam_id}", response_model=schemas.ExamOut)
def get_exam(exam_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    out = schemas.ExamOut.model_validate(exam)
    out.teacher_name = exam.teacher.name
    return _redact_marking_scheme(out, current_user)


@router.delete("/{exam_id}")
def delete_exam(exam_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(require_teacher)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id, models.Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # SQLite here doesn't enforce foreign keys and there are no ORM cascades, so
    # every dependent row has to be cleaned up manually or it's left orphaned —
    # which previously crashed students' own submissions page (exam.title on a
    # None exam) the moment a teacher deleted an exam with existing submissions.
    submission_ids = [s.id for s in db.query(models.Submission.id).filter(models.Submission.exam_id == exam_id).all()]
    question_ids = [q.id for q in db.query(models.ExamQuestion.id).filter(models.ExamQuestion.exam_id == exam_id).all()]
    quiz_ids = [q.id for q in db.query(models.AIQuiz.id).filter(models.AIQuiz.source_exam_id == exam_id).all()]

    if submission_ids:
        db.query(models.FlaggedAnswer).filter(models.FlaggedAnswer.submission_id.in_(submission_ids)).delete(synchronize_session=False)
        db.query(models.StudentAnswer).filter(models.StudentAnswer.submission_id.in_(submission_ids)).delete(synchronize_session=False)
        session_ids = [s.id for s in db.query(models.ProctoringSession.id).filter(models.ProctoringSession.submission_id.in_(submission_ids)).all()]
        if session_ids:
            db.query(models.ProctoringEvent).filter(models.ProctoringEvent.session_id.in_(session_ids)).delete(synchronize_session=False)
            db.query(models.ProctoringSession).filter(models.ProctoringSession.id.in_(session_ids)).delete(synchronize_session=False)
        db.query(models.Submission).filter(models.Submission.id.in_(submission_ids)).delete(synchronize_session=False)

    if question_ids:
        db.query(models.StudentAnswer).filter(models.StudentAnswer.question_id.in_(question_ids)).delete(synchronize_session=False)
        db.query(models.ExamQuestion).filter(models.ExamQuestion.id.in_(question_ids)).delete(synchronize_session=False)

    if quiz_ids:
        db.query(models.QuizAttempt).filter(models.QuizAttempt.quiz_id.in_(quiz_ids)).delete(synchronize_session=False)
        db.query(models.AIQuiz).filter(models.AIQuiz.id.in_(quiz_ids)).delete(synchronize_session=False)

    db.query(models.ExamBlock).filter(models.ExamBlock.exam_id == exam_id).delete(synchronize_session=False)

    db.delete(exam)
    db.commit()
    return {"message": "Exam deleted"}
