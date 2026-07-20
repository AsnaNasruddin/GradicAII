import os
import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from openai import OpenAI
from fastapi import HTTPException
import models

def get_client():
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

PLAN_PROMPT = """You are an expert academic advisor. Generate a personalized 7-day study plan for a student.

Student Profile:
- Enrolled subjects: {subjects}
- Study goals: {goals}
- Available hours per day: {hours_per_day}
- Upcoming exam pressure: {exam_pressure}
- Past performance (average scores): {subject_scores}

Instructions:
- Create 5–8 focused study sessions spread across 7 days
- Focus more on subjects with lower past scores (below 75) and high exam pressure
- Each session should target a SPECIFIC topic within the subject (not generic)
- Include varied activities: reading, practice problems, quizzes, revision, flashcards
- Distribute sessions across all enrolled subjects proportionally to their needs
- Keep duration_minutes between 30 and 120 per session
- days_from_now must be between 1 and 7

Respond ONLY with a valid JSON array (no markdown):
[
  {{
    "topic": "<specific topic to study, e.g. 'SQL Joins and Subqueries'>",
    "subject": "<exact subject name from enrolled list>",
    "duration_minutes": <30 to 120>,
    "tags": ["<activity1>", "<activity2>"],
    "days_from_now": <1 to 7>
  }}
]"""


def generate_study_plan(student_id: int, db: Session, subjects: list = None, goals: str = "", hours_per_day: int = 2, exam_pressure: str = "medium") -> list:
    # Get historical performance for this student
    subs = db.query(models.Submission).filter(
        models.Submission.student_id == student_id,
        models.Submission.ai_score.isnot(None),
    ).all()

    subject_scores: dict = {}
    for s in subs:
        subj = s.exam.subject
        subject_scores.setdefault(subj, []).append(s.ai_score)

    avg_by_subject = {k: round(sum(v) / len(v), 1) for k, v in subject_scores.items()}

    # Use provided subjects list or fall back to subjects from exam history
    enrolled_subjects = subjects or list(avg_by_subject.keys()) or ["General Studies"]

    has_api_key = bool(os.getenv("OPENAI_API_KEY"))

    # Mock sessions are only a legitimate fallback with no API key configured —
    # never a silent stand-in for a real generation failure.
    if not has_api_key:
        sessions_data = _mock_sessions(enrolled_subjects, avg_by_subject)
    else:
        try:
            score_text = "\n".join(f"- {k}: {v}/100" for k, v in avg_by_subject.items()) if avg_by_subject else "No past scores available"
            subjects_text = ", ".join(enrolled_subjects)
            goals_text = goals.strip() or "Improve overall understanding and prepare for upcoming exams"

            prompt = PLAN_PROMPT.format(
                subjects=subjects_text,
                goals=goals_text,
                hours_per_day=hours_per_day,
                exam_pressure=exam_pressure,
                subject_scores=score_text,
            )
            response = get_client().chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1500,
            )
            raw = response.choices[0].message.content.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()
            sessions_data = json.loads(raw)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"AI study plan generation failed: {e}. Try again.")

    # Delete old AI-generated sessions for this student
    db.query(models.StudySession).filter(
        models.StudySession.student_id == student_id,
        models.StudySession.is_ai_generated == True,
    ).delete()

    created = []
    for item in sessions_data:
        scheduled = datetime.utcnow() + timedelta(days=item.get("days_from_now", 1))
        session = models.StudySession(
            student_id=student_id,
            topic=item.get("topic", "Study session"),
            subject=item.get("subject", enrolled_subjects[0] if enrolled_subjects else "General"),
            scheduled_date=scheduled,
            duration_minutes=item.get("duration_minutes", 60),
            tags=json.dumps(item.get("tags", [])),
            is_ai_generated=True,
        )
        db.add(session)
        db.flush()
        created.append(session)

    db.commit()
    for s in created:
        db.refresh(s)
    return created


def _mock_sessions(enrolled_subjects: list, avg_by_subject: dict) -> list:
    subjects = enrolled_subjects or ["Mathematics"]
    weak = [s for s in subjects if avg_by_subject.get(s, 100) < 75]
    strong = [s for s in subjects if avg_by_subject.get(s, 100) >= 75]

    templates = [
        ("Review key concepts in {s}", 60, ["Reading Material", "Review Notes"]),
        ("Practice problems: {s}", 90, ["Practice Problems", "Quiz"]),
        ("Deep dive into {s} topics", 60, ["Reading Material", "Review Notes"]),
        ("Problem solving: {s}", 75, ["Practice Problems", "Flashcards"]),
        ("Revision and self-test: {s}", 45, ["Flashcards", "Quiz"]),
        ("Strengthen understanding of {s}", 60, ["Reading Material", "Practice Problems"]),
        ("Mock test: {s}", 60, ["Practice Problems", "Quiz"]),
    ]

    plan = []
    day = 1
    priority = (weak or subjects) + [s for s in strong if s not in (weak or subjects)]

    for subj in priority:
        tmpl_idx = len(plan) % len(templates)
        topic_tmpl, dur, tags = templates[tmpl_idx]
        plan.append({
            "topic": topic_tmpl.format(s=subj),
            "subject": subj,
            "duration_minutes": dur,
            "tags": tags,
            "days_from_now": day,
        })
        day = (day % 7) + 1
        if len(plan) >= 7:
            break

    # Pad to at least 5
    while len(plan) < 5:
        subj = subjects[len(plan) % len(subjects)]
        t, d, tags = templates[len(plan) % len(templates)]
        plan.append({
            "topic": t.format(s=subj),
            "subject": subj,
            "duration_minutes": d,
            "tags": tags,
            "days_from_now": day,
        })
        day = (day % 7) + 1

    return plan[:7]

CONTENT_FLASHCARDS_PROMPT = """You are an expert educator. Create 5-10 study flashcards for the topic: "{topic}" in the subject: "{subject}".
Respond ONLY with a valid JSON array of objects with "front" (question/concept) and "back" (answer/explanation) keys. No markdown blocks.
Example:
[
  {{"front": "What is 1NF?", "back": "First Normal Form ensures each column contains atomic values."}}
]"""

CONTENT_READING_PROMPT = """You are an expert educator. Write a concise, engaging, and easy-to-understand reading material/review notes for a student about the topic: "{topic}" in the subject: "{subject}".
Use markdown formatting (headings, bullet points, bold text). Make it educational but keep it under 500 words so it's a quick study bite. Do not wrap the response in markdown code blocks, just return the raw markdown."""

CONTENT_QUIZ_PROMPT = """You are an expert educator. Generate exactly 5 multiple-choice quiz questions about "{topic}" in the subject "{subject}".
Each question must have exactly 4 answer options (A, B, C, D) and one correct answer letter.
Respond ONLY with a valid JSON array (no markdown, no code blocks):
[
  {{
    "question": "<question text>",
    "options": ["<A text>", "<B text>", "<C text>", "<D text>"],
    "answer": "<A|B|C|D>"
  }}
]"""


def _strip_json_fences(raw: str) -> str:
    """Strip markdown code fences from a JSON string."""
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    return raw


def generate_study_content(topic: str, subject: str, activity_type: str) -> dict:
    has_api_key = bool(os.getenv("OPENAI_API_KEY"))
    if not has_api_key:
        return {
            "type": "error",
            "content": "OpenAI API key not configured. Cannot generate content dynamically."
        }

    t = activity_type.lower()
    is_flashcards = "flashcard" in t
    is_quiz = "quiz" in t  # matches "quiz", "quiz_inline", "practice quiz", etc.

    if is_quiz:
        prompt = CONTENT_QUIZ_PROMPT.format(topic=topic, subject=subject)
    elif is_flashcards:
        prompt = CONTENT_FLASHCARDS_PROMPT.format(topic=topic, subject=subject)
    else:
        prompt = CONTENT_READING_PROMPT.format(topic=topic, subject=subject)

    try:
        response = get_client().chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500,
        )
        raw = response.choices[0].message.content.strip()

        if is_quiz:
            raw = _strip_json_fences(raw)
            return {"type": "quiz", "content": json.loads(raw)}
        elif is_flashcards:
            raw = _strip_json_fences(raw)
            return {"type": "flashcards", "content": json.loads(raw)}
        else:
            return {"type": "markdown", "content": raw}
    except Exception as e:
        print(f"[generate_study_content] {activity_type} generation for '{topic}' failed: {e}")
        return {"type": "error", "content": "Failed to generate study material. Please try again."}

