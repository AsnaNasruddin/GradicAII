from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from database import get_db
import models, schemas
from dependencies import require_teacher

router = APIRouter()


@router.get("/", response_model=List[schemas.FlaggedAnswerOut])
def list_flagged(db: Session = Depends(get_db), current_user: models.User = Depends(require_teacher)):
    exam_ids = [e.id for e in db.query(models.Exam).filter(models.Exam.teacher_id == current_user.id).all()]
    sub_ids = [s.id for s in db.query(models.Submission).filter(models.Submission.exam_id.in_(exam_ids)).all()]

    flags = db.query(models.FlaggedAnswer).filter(models.FlaggedAnswer.submission_id.in_(sub_ids)).all()
    results = []
    for f in flags:
        out = schemas.FlaggedAnswerOut.model_validate(f)
        out.student_name = f.submission.student.name
        out.exam_title = f.submission.exam.title
        results.append(out)
    return results


@router.put("/{flag_id}/resolve", response_model=schemas.FlaggedAnswerOut)
def resolve_flag(
    flag_id: int,
    resolve_data: schemas.FlagResolve,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_teacher),
):
    flag = db.query(models.FlaggedAnswer).filter(models.FlaggedAnswer.id == flag_id).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")
    if flag.submission.exam.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    flag.resolved = resolve_data.resolved
    flag.resolved_by = current_user.id
    flag.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(flag)

    out = schemas.FlaggedAnswerOut.model_validate(flag)
    out.student_name = flag.submission.student.name
    out.exam_title = flag.submission.exam.title
    return out
