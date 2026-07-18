import os
import json
from fastapi import HTTPException
from openai import OpenAI
from sqlalchemy.orm import Session
import models
from services.document_extract import extract_document_text

def get_client():
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

QUIZ_PROMPT = """Based on the following question paper content, generate {count} multiple-choice practice questions at {difficulty} difficulty level.

Content:
{content}

Respond ONLY with valid JSON array:
[
  {{
    "question": "<question text>",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct_answer": "A",
    "explanation": "<brief explanation>"
  }}
]"""

TOPIC_PROMPT = """You are an expert educator. Generate {count} high-quality multiple-choice questions at {difficulty} difficulty level for the subject "{subject}".

Topics to cover:
{topics}

Requirements:
- Questions must be specific, factual, and directly related to the listed topics
- Each question should have exactly 4 distinct options (A, B, C, D)
- Options must be realistic and plausible (no "Option A" placeholders)
- Include a clear, educational explanation for the correct answer
- Vary question styles: conceptual understanding, application, analysis
- Difficulty {difficulty}: {difficulty_hint}

Respond ONLY with a valid JSON array (no markdown, no extra text):
[
  {{
    "question": "<specific question about the topic>",
    "options": ["A) <option>", "B) <option>", "C) <option>", "D) <option>"],
    "correct_answer": "A",
    "explanation": "<why this answer is correct>"
  }}
]"""

DIFFICULTY_HINTS = {
    "easy": "basic recall and definitions, suitable for beginners",
    "medium": "application of concepts and some analysis, intermediate level",
    "hard": "deep analysis, evaluation, edge cases, and advanced reasoning",
}


MOCK_QUESTIONS = [
    {
        "question": "What is the primary purpose of this subject?",
        "options": ["A) Option A", "B) Option B", "C) Option C", "D) Option D"],
        "correct_answer": "A",
        "explanation": "This is a mock question. Add your OPENAI_API_KEY for real questions.",
    }
]


def generate_quiz_for_exam(exam: models.Exam, difficulty: str, db: Session, topics: str = "", num_questions: int = None) -> models.AIQuiz:
    count_map = {"easy": 5, "medium": 8, "hard": 10}
    count = num_questions if num_questions else count_map.get(difficulty, 8)
    count = max(1, min(count, 30))  # sane bounds — bound API cost and payload size

    # Reuses the OCR-capable extractor (services/document_extract.py) so scanned or
    # photographed slides/notes are read via GPT-4o vision, not just digital-text PDFs.
    content = extract_document_text(exam.question_paper_url or "")
    has_api_key = bool(os.getenv("OPENAI_API_KEY"))

    # Mock questions are only a legitimate fallback with no API key configured —
    # never a silent stand-in for a real generation failure, which used to
    # return an apparently-successful quiz made entirely of the same fake
    # placeholder question repeated `count` times.
    if not has_api_key:
        questions = MOCK_QUESTIONS * count
    else:
        try:
            if content:
                # PDF content available — generate from paper
                prompt = QUIZ_PROMPT.format(count=count, difficulty=difficulty, content=content[:4000])
            elif topics.strip():
                # No PDF but teacher provided topics — generate from topics
                prompt = TOPIC_PROMPT.format(
                    count=count,
                    difficulty=difficulty,
                    subject=exam.subject,
                    topics=topics.strip(),
                    difficulty_hint=DIFFICULTY_HINTS.get(difficulty, ""),
                )
            else:
                # No PDF, no topics — generate generic subject questions
                prompt = TOPIC_PROMPT.format(
                    count=count,
                    difficulty=difficulty,
                    subject=exam.subject,
                    topics=f"General core concepts and key principles of {exam.subject}",
                    difficulty_hint=DIFFICULTY_HINTS.get(difficulty, ""),
                )

            response = get_client().chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=3000,
            )
            raw = response.choices[0].message.content.strip()
            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()
            questions = json.loads(raw)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"AI quiz generation failed: {e}. Try again.")

    quiz = models.AIQuiz(
        source_exam_id=exam.id,
        title=f"{exam.title} — Practice ({difficulty.capitalize()})",
        subject=exam.subject,
        difficulty=difficulty,
        questions=json.dumps(questions[:count]),
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz
