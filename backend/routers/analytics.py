from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, timedelta

from database import get_db
import models, schemas
from dependencies import require_teacher, require_student

router = APIRouter()


@router.get("/dashboard", response_model=schemas.DashboardStats)
def dashboard_stats(db: Session = Depends(get_db), current_user: models.User = Depends(require_teacher)):
    exam_ids = [e.id for e in db.query(models.Exam).filter(models.Exam.teacher_id == current_user.id).all()]

    total_exams = len(exam_ids)
    pending_reviews = db.query(models.Submission).filter(
        models.Submission.exam_id.in_(exam_ids),
        models.Submission.status.in_(["needs_review", "flagged"]),
    ).count()

    graded = db.query(models.Submission).filter(
        models.Submission.exam_id.in_(exam_ids),
        models.Submission.ai_score.isnot(None),
    ).all()

    avg_score = round(sum(s.ai_score for s in graded) / len(graded), 1) if graded else 0.0

    student_ids = set(s.student_id for s in db.query(models.Submission).filter(
        models.Submission.exam_id.in_(exam_ids)
    ).all())

    return {
        "total_exams": total_exams,
        "pending_reviews": pending_reviews,
        "average_score": avg_score,
        "class_size": len(student_ids),
    }


@router.get("/score-trend")
def score_trend(db: Session = Depends(get_db), current_user: models.User = Depends(require_teacher)):
    exam_ids = [e.id for e in db.query(models.Exam).filter(models.Exam.teacher_id == current_user.id).all()]
    exams = db.query(models.Exam).filter(models.Exam.id.in_(exam_ids)).order_by(models.Exam.created_at).all()

    trend = []
    for exam in exams:
        subs = [s for s in exam.submissions if s.ai_score is not None]
        avg = round(sum(s.ai_score for s in subs) / len(subs), 1) if subs else 0
        trend.append({"label": exam.title[:15], "average_score": avg})

    return trend


@router.get("/score-distribution")
def score_distribution(db: Session = Depends(get_db), current_user: models.User = Depends(require_teacher)):
    exam_ids = [e.id for e in db.query(models.Exam).filter(models.Exam.teacher_id == current_user.id).all()]
    subs = db.query(models.Submission).filter(
        models.Submission.exam_id.in_(exam_ids),
        models.Submission.ai_score.isnot(None),
    ).all()

    buckets = {"0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}
    for s in subs:
        score = s.ai_score
        if score <= 20:
            buckets["0-20"] += 1
        elif score <= 40:
            buckets["21-40"] += 1
        elif score <= 60:
            buckets["41-60"] += 1
        elif score <= 80:
            buckets["61-80"] += 1
        else:
            buckets["81-100"] += 1

    return [{"range": k, "count": v} for k, v in buckets.items()]


@router.get("/top-performers")
def top_performers(db: Session = Depends(get_db), current_user: models.User = Depends(require_teacher)):
    exam_ids = [e.id for e in db.query(models.Exam).filter(models.Exam.teacher_id == current_user.id).all()]
    subs = db.query(models.Submission).filter(
        models.Submission.exam_id.in_(exam_ids),
        models.Submission.ai_score.isnot(None),
    ).all()

    student_scores: dict = {}
    for s in subs:
        sid = s.student_id
        if sid not in student_scores:
            student_scores[sid] = {"name": s.student.name, "scores": []}
        student_scores[sid]["scores"].append(s.ai_score)

    performers = [
        {"student_name": v["name"], "average_score": round(sum(v["scores"]) / len(v["scores"]), 1)}
        for v in student_scores.values()
    ]
    performers.sort(key=lambda x: x["average_score"], reverse=True)
    return performers[:10]


@router.get("/subject-performance")
def subject_performance(db: Session = Depends(get_db), current_user: models.User = Depends(require_teacher)):
    exam_ids = [e.id for e in db.query(models.Exam).filter(models.Exam.teacher_id == current_user.id).all()]
    exams = db.query(models.Exam).filter(models.Exam.id.in_(exam_ids)).all()

    subject_data: dict = {}
    for exam in exams:
        subj = exam.subject
        scored = [s.ai_score for s in exam.submissions if s.ai_score is not None]
        if scored:
            subject_data.setdefault(subj, []).extend(scored)

    return [
        {"subject": k, "average": round(sum(v) / len(v), 1)}
        for k, v in subject_data.items()
    ]


@router.get("/student/progress")
def student_progress(db: Session = Depends(get_db), current_user: models.User = Depends(require_student)):
    subs = db.query(models.Submission).filter(
        models.Submission.student_id == current_user.id,
        models.Submission.ai_score.isnot(None),
    ).order_by(models.Submission.submitted_at).all()

    if not subs:
        return {
            "current_average": 0,
            "improvement": 0,
            "assessments_done": 0,
            "subject_breakdown": [],
            "trend": [],
        }

    scores = [s.ai_score for s in subs]
    current_avg = round(sum(scores) / len(scores), 1)
    first_half = scores[: len(scores) // 2] or [scores[0]]
    second_half = scores[len(scores) // 2 :] or [scores[-1]]
    improvement = round(
        ((sum(second_half) / len(second_half)) - (sum(first_half) / len(first_half)))
        / max(sum(first_half) / len(first_half), 1)
        * 100,
        1,
    )

    subject_scores: dict = {}
    for s in subs:
        subj = s.exam.subject
        subject_scores.setdefault(subj, []).append(s.ai_score)

    subject_breakdown = [
        {"subject": k, "average": round(sum(v) / len(v), 1)}
        for k, v in subject_scores.items()
    ]

    trend = [
        {"label": s.exam.title[:15], "score": s.ai_score, "date": s.submitted_at.isoformat()}
        for s in subs
    ]

    return {
        "current_average": current_avg,
        "improvement": improvement,
        "assessments_done": len(subs),
        "subject_breakdown": subject_breakdown,
        "trend": trend,
    }
