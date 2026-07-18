import os
import json
from openai import OpenAI
from sqlalchemy.orm import Session
from database import SessionLocal
import models
from services.document_extract import extract_document_text

def get_client():
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

GRADING_MODEL = "gpt-4o"
GRADING_SEEDS = [11, 22, 33]  # 3 independent runs; the median-score run is kept

GRADING_PROMPT = """You are an expert examiner. Grade the student's answer sheet strictly according to the marking scheme.

Question Paper:
{question_paper}

Marking Scheme:
{marking_scheme}

Student's Answer Sheet:
{answer_sheet}

Total Marks Available: {total_marks}
Passing Marks: {passing_marks}

IMPORTANT — how to read the student's answer sheet:
- The answer sheet may be an OCR transcript of handwritten pages (pages are marked with "=== Page N ==="). Minor OCR artifacts and [illegible] markers may appear; do not penalize the student for them — grade the legible content.
- Students label their answers inconsistently: "Q1", "Question 3", "Ans 2", rewriting the question text as a heading, or no label at all. Match every part of the student's writing to the correct question from the question paper and marking scheme, using labels when present and content similarity otherwise.
- A single answer may continue across multiple pages — treat continuation text as part of the same answer.
- Award marks strictly per the marking scheme criteria. If a question truly has no relevant content anywhere in the answer sheet, award 0 for that question and say so in its feedback.

CONSISTENCY RULES — follow these exactly so identical answers always receive identical marks:
- Every criterion listed in the marking scheme carries exactly the marks shown next to it. Never claim a listed criterion carries no marks — if it appears in the marking scheme, it must be scored.
- Award partial credit only for content that directly addresses the criterion. Related-but-off-topic content earns at most half of the criterion's marks, never full marks.
- If the marking scheme's total differs from "Total Marks Available", follow the marking scheme.
- In each "justification", quote the exact words from the answer sheet that earned the marks (or state exactly what required content is absent).
- For criteria about presentation, neatness, headings or organization: judge them from the transcript's structure — section headings, ordering and completeness. If the transcript shows clear headings and a logical order, award these marks in full; deduct only if the structure is genuinely disorganized or headings are missing.
- Be strict, literal and consistent. Do not round marks up out of generosity.

Respond ONLY with valid JSON in this exact format:
{{
  "score": <number>,
  "percentage": <number>,
  "passed": <boolean>,
  "overall_feedback": "<string>",
  "question_analysis": [
    {{
      "question_number": <number>,
      "marks_awarded": <number>,
      "marks_available": <number>,
      "feedback": "<brief feedback to student>",
      "justification": "<why AI awarded this mark — e.g. correct method shown, key term missing, partial answer>",
      "correct": <boolean>
    }}
  ],
  "confidence": <number between 0 and 1>,
  "flags": []
}}"""


def _parse_grading_json(raw: str) -> dict:
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


def run_grading_ensemble(prompt: str, runs: int = 3) -> dict:
    """
    Grade the same prompt multiple times with fixed seeds and return the
    median-score result. This filters out one-off model slips so identical
    submissions receive stable, repeatable marks.
    """
    client = get_client()
    results = []
    for seed in GRADING_SEEDS[:max(1, runs)]:
        try:
            response = client.chat.completions.create(
                model=GRADING_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=2000,
                temperature=0,
                seed=seed,
                response_format={"type": "json_object"},
            )
            results.append(_parse_grading_json(response.choices[0].message.content))
        except Exception:
            continue
    if not results:
        raise ValueError("AI grading returned no valid result")
    results.sort(key=lambda r: float(r.get("score", 0) or 0))
    return results[len(results) // 2]


def grade_submission(submission_id: int):
    db: Session = SessionLocal()
    try:
        submission = db.query(models.Submission).filter(models.Submission.id == submission_id).first()
        if not submission:
            return

        exam = submission.exam

        if not os.getenv("OPENAI_API_KEY"):
            _apply_mock_grade(submission, exam, db)
            return

        qp_text = extract_document_text(exam.question_paper_url or "")
        ms_text = extract_document_text(exam.marking_scheme_url or "")

        if submission.submission_type == "upload":
            as_text = extract_document_text(submission.answer_sheet_url or "")
        else:
            as_text = submission.digital_text or ""

        if not as_text.strip():
            submission.status = "needs_review"
            submission.ai_feedback = (
                "Automatic grading could not read any content from the uploaded answer sheet. "
                "The file may be blank, corrupted, or too blurry to OCR. "
                "Please review it manually or ask the student to re-upload a clearer scan."
            )
            submission.question_analysis = json.dumps([])
            db.commit()
            return

        prompt = GRADING_PROMPT.format(
            question_paper=qp_text or "Not provided",
            marking_scheme=ms_text or "Not provided",
            answer_sheet=as_text,
            total_marks=exam.total_marks,
            passing_marks=exam.passing_marks,
        )

        result = run_grading_ensemble(prompt)

        submission.ai_score = result.get("score", 0)
        submission.ai_feedback = result.get("overall_feedback", "")
        submission.question_analysis = json.dumps(result.get("question_analysis", []))
        confidence = result.get("confidence", 1.0)
        flags = result.get("flags", [])

        if confidence < 0.6 or flags:
            submission.status = "flagged"
            for flag in flags:
                f = models.FlaggedAnswer(
                    submission_id=submission.id,
                    flag_type="ai_uncertainty" if confidence < 0.6 else "suspicious",
                    reason=str(flag) if flag else "Low AI confidence",
                )
                db.add(f)
        else:
            submission.status = "pending_review"  # teacher must approve before student sees grade

        db.commit()

    except Exception as e:
        try:
            submission.status = "needs_review"
            submission.ai_feedback = f"Grading failed: {str(e)}"
            db.commit()
        except Exception:
            pass
    finally:
        db.close()


def _apply_mock_grade(submission: models.Submission, exam, db: Session):
    import random
    percentage = random.randint(60, 95)
    score = round((percentage / 100) * exam.total_marks, 1)
    submission.ai_score = score
    submission.ai_feedback = (
        f"Mock grade: {score}/{exam.total_marks} ({percentage}%). "
        "Set OPENAI_API_KEY in .env to enable real AI grading."
    )
    submission.question_analysis = json.dumps([])
    submission.status = "pending_review"
    db.commit()
