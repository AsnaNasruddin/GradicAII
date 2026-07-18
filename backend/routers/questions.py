import json
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
import models, schemas
from dependencies import get_current_user, require_teacher
from services.document_extract import extract_document_text

router = APIRouter()

EXTRACT_PROMPT = """You are an expert at parsing exam papers. Extract ALL questions from the following exam paper content.

For each question identify:
- Its number
- Its type: "mcq" (has options A/B/C/D), "short" (1-3 line answer), or "long" (essay/detailed answer)
- The exact question text
- For MCQ: the options as a list and the correct answer letter if shown in a marking scheme
- The marks allocated

Respond ONLY with valid JSON array:
[
  {
    "question_number": 1,
    "question_type": "mcq",
    "question_text": "What is 2+2?",
    "options": ["A) 3", "B) 4", "C) 5", "D) 6"],
    "correct_option": "B",
    "marks": 1
  },
  {
    "question_number": 2,
    "question_type": "short",
    "question_text": "Explain Newton's first law.",
    "options": null,
    "correct_option": null,
    "marks": 3
  }
]

Exam content:
{content}"""

GENERATE_PROMPT = """You are an expert exam-paper author. No question paper was uploaded for this exam, so create {count} well-structured original exam questions for the subject "{subject}" (exam title: "{title}"), totaling approximately {total_marks} marks.

Requirements:
- Use a sensible mix of question types: some "mcq" (with exactly 4 options and a correct_option letter), some "short" (1-3 line answer), some "long" (essay/detailed answer) — choose the mix that fits a {total_marks}-mark exam on this subject
- Questions must be specific, factual, and directly test real understanding of {subject} — never generic placeholders like "Question 1"
- Distribute marks across questions so they sum to approximately {total_marks}

Respond ONLY with valid JSON array in this exact format:
[
  {{
    "question_number": 1,
    "question_type": "mcq",
    "question_text": "<specific question text>",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct_option": "B",
    "marks": 2
  }},
  {{
    "question_number": 2,
    "question_type": "short",
    "question_text": "<specific question text>",
    "options": null,
    "correct_option": null,
    "marks": 3
  }}
]"""


def _mock_extract(exam: models.Exam) -> list:
    return [
        {
            "question_number": i + 1,
            "question_type": "short",
            "question_text": f"Question {i + 1} from {exam.title} (add your OPENAI_API_KEY for real extraction)",
            "options": None,
            "correct_option": None,
            "marks": exam.total_marks // 5 or 1,
        }
        for i in range(5)
    ]


@router.post("/exams/{exam_id}/extract-questions", response_model=List[schemas.ExamQuestionOut])
def extract_questions(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_teacher),
):
    exam = db.query(models.Exam).filter(
        models.Exam.id == exam_id, models.Exam.teacher_id == current_user.id
    ).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    submitted_count = db.query(models.Submission).filter(
        models.Submission.exam_id == exam_id, models.Submission.submission_type == "structured"
    ).count()
    if submitted_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"{submitted_count} student(s) already submitted structured answers for this exam. "
                   "Re-extracting would delete the questions their answers point to. "
                   "Edit existing questions individually instead of re-extracting.",
        )

    content = extract_document_text(exam.question_paper_url or "")
    ms_content = extract_document_text(exam.marking_scheme_url or "")
    if ms_content:
        content += "\n\nMARKING SCHEME:\n" + ms_content

    api_key = os.getenv("OPENAI_API_KEY", "")

    # Mock questions are only an acceptable fallback with no API key configured
    # at all — an infrastructure gap the AI can't work around. Raise before
    # anything is deleted so a transient API error can't destroy an exam's
    # existing questions.
    if not api_key:
        extracted = _mock_extract(exam)
    elif not content.strip():
        # No question paper uploaded (or it was unreadable) — generate original
        # questions for this exam's subject instead of showing placeholder text,
        # the same "generate from subject when there's no source document"
        # fallback already used by the AI Quiz generator.
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            count = max(3, min(10, (exam.total_marks // 10) or 5))
            prompt = GENERATE_PROMPT.format(
                count=count, subject=exam.subject, title=exam.title, total_marks=exam.total_marks,
            )
            resp = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=3000,
            )
            raw = resp.choices[0].message.content.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            extracted = json.loads(raw)
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"AI question generation failed: {e}. Your existing questions (if any) were left unchanged — try again, or upload a question paper instead.",
            )
    else:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            prompt = EXTRACT_PROMPT.replace("{content}", content[:6000])
            resp = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=3000,
            )
            raw = resp.choices[0].message.content.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            extracted = json.loads(raw)
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"AI question extraction failed: {e}. Your existing questions (if any) were left unchanged — try again.",
            )

    # Delete previous draft questions
    db.query(models.ExamQuestion).filter(models.ExamQuestion.exam_id == exam_id).delete()

    created = []
    for i, q in enumerate(extracted):
        opts = q.get("options")
        question = models.ExamQuestion(
            exam_id=exam_id,
            question_number=q.get("question_number", i + 1),
            question_type=q.get("question_type", "short"),
            question_text=q.get("question_text", ""),
            options=json.dumps(opts) if opts else None,
            correct_option=q.get("correct_option"),
            marks=q.get("marks", 1),
            order_index=i,
        )
        db.add(question)
        db.flush()
        created.append(question)

    db.commit()
    for q in created:
        db.refresh(q)
    return created


@router.get("/exams/{exam_id}/questions", response_model=List[schemas.ExamQuestionOut])
def get_questions(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    questions = db.query(models.ExamQuestion).filter(
        models.ExamQuestion.exam_id == exam_id
    ).order_by(models.ExamQuestion.order_index).all()

    results = [schemas.ExamQuestionOut.model_validate(q) for q in questions]
    if current_user.role != "teacher":
        # Never leak the correct MCQ answer to a student taking the exam — grading
        # is done server-side against the DB row, not the client-supplied answer.
        for r in results:
            r.correct_option = None
    return results


@router.post("/exams/{exam_id}/questions", response_model=schemas.ExamQuestionOut)
def add_question(
    exam_id: int,
    data: schemas.ExamQuestionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_teacher),
):
    exam = db.query(models.Exam).filter(
        models.Exam.id == exam_id, models.Exam.teacher_id == current_user.id
    ).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    q = models.ExamQuestion(
        exam_id=exam_id,
        question_number=data.question_number,
        question_type=data.question_type,
        question_text=data.question_text,
        options=json.dumps(data.options) if data.options else None,
        correct_option=data.correct_option,
        marks=data.marks,
        order_index=data.order_index,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


@router.put("/exams/{exam_id}/questions/{q_id}", response_model=schemas.ExamQuestionOut)
def update_question(
    exam_id: int,
    q_id: int,
    data: schemas.ExamQuestionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_teacher),
):
    q = db.query(models.ExamQuestion).filter(
        models.ExamQuestion.id == q_id, models.ExamQuestion.exam_id == exam_id
    ).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    if data.question_type is not None:
        q.question_type = data.question_type
    if data.question_text is not None:
        q.question_text = data.question_text
    if data.options is not None:
        q.options = json.dumps(data.options)
    if data.correct_option is not None:
        q.correct_option = data.correct_option
    if data.marks is not None:
        q.marks = data.marks
    if data.order_index is not None:
        q.order_index = data.order_index

    db.commit()
    db.refresh(q)
    return q


@router.delete("/exams/{exam_id}/questions/{q_id}")
def delete_question(
    exam_id: int,
    q_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_teacher),
):
    q = db.query(models.ExamQuestion).filter(
        models.ExamQuestion.id == q_id, models.ExamQuestion.exam_id == exam_id
    ).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    db.delete(q)
    db.commit()
    return {"message": "Question deleted"}


@router.post("/exams/{exam_id}/publish-structured", response_model=schemas.ExamOut)
def publish_structured(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_teacher),
):
    exam = db.query(models.Exam).filter(
        models.Exam.id == exam_id, models.Exam.teacher_id == current_user.id
    ).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    q_count = db.query(models.ExamQuestion).filter(models.ExamQuestion.exam_id == exam_id).count()
    if q_count == 0:
        raise HTTPException(status_code=400, detail="Extract questions first before publishing")

    exam.is_structured = True
    db.commit()
    db.refresh(exam)
    out = schemas.ExamOut.model_validate(exam)
    out.teacher_name = exam.teacher.name
    return out


@router.post("/exams/{exam_id}/toggle-proctoring", response_model=schemas.ExamOut)
def toggle_proctoring(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_teacher),
):
    exam = db.query(models.Exam).filter(
        models.Exam.id == exam_id, models.Exam.teacher_id == current_user.id
    ).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    exam.proctoring_enabled = not exam.proctoring_enabled
    db.commit()
    db.refresh(exam)
    out = schemas.ExamOut.model_validate(exam)
    out.teacher_name = exam.teacher.name
    return out
