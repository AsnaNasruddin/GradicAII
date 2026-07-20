from pydantic import BaseModel, EmailStr, field_serializer
from typing import Optional, List
from datetime import datetime

from services.datetime_utils import iso_utc


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str  # teacher | student


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


# Exam schemas
class ExamCreate(BaseModel):
    title: str
    subject: str
    description: Optional[str] = None
    total_marks: int
    passing_marks: int
    available_from: datetime
    available_until: datetime
    duration_minutes: int
    exam_type: str = "physical"  # physical | online | both
    submission_format: str = "both"  # typed | upload | both


class ExamOut(BaseModel):
    id: int
    teacher_id: int
    teacher_name: Optional[str] = None
    title: str
    subject: str
    description: Optional[str]
    question_paper_url: Optional[str]
    marking_scheme_url: Optional[str]
    total_marks: int
    passing_marks: int
    available_from: datetime
    available_until: datetime
    duration_minutes: int
    exam_type: Optional[str] = "physical"
    submission_format: Optional[str] = "both"
    is_structured: Optional[bool] = False
    proctoring_enabled: Optional[bool] = False
    created_at: datetime
    model_config = {"from_attributes": True}

    @field_serializer("available_from", "available_until", "created_at")
    def _serialize_utc(self, dt: datetime) -> str:
        return iso_utc(dt)


# Exam question schemas
class ExamQuestionCreate(BaseModel):
    question_number: int
    question_type: str  # mcq | short | long
    question_text: str
    options: Optional[List[str]] = None
    correct_option: Optional[str] = None
    marks: int = 1
    order_index: int = 0


class ExamQuestionUpdate(BaseModel):
    question_type: Optional[str] = None
    question_text: Optional[str] = None
    options: Optional[List[str]] = None
    correct_option: Optional[str] = None
    marks: Optional[int] = None
    order_index: Optional[int] = None


class ExamQuestionOut(BaseModel):
    id: int
    exam_id: int
    question_number: int
    question_type: str
    question_text: str
    options: Optional[str] = None   # JSON string
    correct_option: Optional[str] = None
    marks: int
    order_index: int
    model_config = {"from_attributes": True}


# Student answer schemas
class StudentAnswerIn(BaseModel):
    question_id: int
    answer_text: Optional[str] = None
    selected_option: Optional[str] = None
    is_voice_answer: bool = False


class StructuredSubmissionCreate(BaseModel):
    exam_id: int
    answers: List[StudentAnswerIn]


class StudentAnswerOut(BaseModel):
    id: int
    question_id: int
    answer_text: Optional[str]
    selected_option: Optional[str]
    is_voice_answer: bool
    model_config = {"from_attributes": True}


# Proctoring schemas
class ProctoringSessionOut(BaseModel):
    id: int
    submission_id: int
    started_at: datetime
    ended_at: Optional[datetime]
    warning_count: int
    terminated: bool
    termination_reason: Optional[str]
    model_config = {"from_attributes": True}


class ProctoringEventOut(BaseModel):
    id: int
    session_id: int
    event_type: str
    warning_level: int
    detected_at: datetime
    frame_snapshot_url: Optional[str]
    model_config = {"from_attributes": True}


# Submission schemas
class SubmissionOut(BaseModel):
    id: int
    exam_id: int
    student_id: int
    student_name: Optional[str] = None
    submission_type: str
    status: str
    answer_sheet_url: Optional[str] = None
    digital_text: Optional[str] = None
    ai_score: Optional[float]
    ai_feedback: Optional[str]
    question_analysis: Optional[str]
    submitted_at: datetime
    exam_title: Optional[str] = None
    exam_subject: Optional[str] = None
    teacher_name: Optional[str] = None
    total_marks: Optional[int] = None
    final_score: Optional[float] = None
    teacher_notes: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# Flagged answer schemas
class FlaggedAnswerOut(BaseModel):
    id: int
    submission_id: int
    flag_type: str
    reason: str
    resolved: bool
    resolved_at: Optional[datetime]
    student_name: Optional[str] = None
    exam_title: Optional[str] = None
    model_config = {"from_attributes": True}


class FlagResolve(BaseModel):
    resolved: bool


# Quiz schemas
class QuizOut(BaseModel):
    id: int
    source_exam_id: int
    title: str
    subject: str
    difficulty: str
    questions: str  # JSON string
    created_at: datetime
    model_config = {"from_attributes": True}


class QuizAttemptCreate(BaseModel):
    answers: List[dict]
    time_spent_seconds: int


class QuizAttemptOut(BaseModel):
    id: int
    quiz_id: int
    student_id: int
    score: Optional[float]
    time_spent_seconds: Optional[int]
    completed_at: datetime
    model_config = {"from_attributes": True}


# Study session schemas
class StudySessionCreate(BaseModel):
    topic: str
    subject: str
    scheduled_date: datetime
    duration_minutes: int
    tags: Optional[List[str]] = []


class StudySessionOut(BaseModel):
    id: int
    student_id: int
    topic: str
    subject: Optional[str]
    scheduled_date: datetime
    duration_minutes: int
    tags: Optional[str]  # JSON string
    is_ai_generated: bool
    model_config = {"from_attributes": True}


# Analytics schemas
class DashboardStats(BaseModel):
    total_exams: int
    pending_reviews: int
    average_score: float
    class_size: int


class ScoreTrend(BaseModel):
    label: str
    average_score: float


class ScoreDistribution(BaseModel):
    range: str
    count: int
