from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # teacher | student
    created_at = Column(DateTime, server_default=func.now())

    exams = relationship("Exam", back_populates="teacher")
    submissions = relationship("Submission", back_populates="student")
    study_sessions = relationship("StudySession", back_populates="student")


class Exam(Base):
    __tablename__ = "exams"
    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    description = Column(Text)
    question_paper_url = Column(String)
    marking_scheme_url = Column(String)
    total_marks = Column(Integer, nullable=False)
    passing_marks = Column(Integer, nullable=False)
    available_from = Column(DateTime, nullable=False)
    available_until = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    exam_type = Column(String, default="physical")  # physical | online | both
    submission_format = Column(String, default="both")  # typed | upload | both
    is_structured = Column(Boolean, default=False)   # structured questions extracted
    proctoring_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    teacher = relationship("User", back_populates="exams")
    submissions = relationship("Submission", back_populates="exam")
    ai_quizzes = relationship("AIQuiz", back_populates="source_exam")
    questions = relationship("ExamQuestion", back_populates="exam", order_by="ExamQuestion.order_index")


class ExamQuestion(Base):
    __tablename__ = "exam_questions"
    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    question_number = Column(Integer, nullable=False)
    question_type = Column(String, nullable=False)  # mcq | short | long
    question_text = Column(Text, nullable=False)
    options = Column(Text)       # JSON array for MCQ: ["A) ...", "B) ...", ...]
    correct_option = Column(String)  # for MCQ: "A", "B", "C", "D"
    marks = Column(Integer, default=1)
    order_index = Column(Integer, default=0)

    exam = relationship("Exam", back_populates="questions")
    student_answers = relationship("StudentAnswer", back_populates="question")


class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (UniqueConstraint("exam_id", "student_id", name="uq_submission_exam_student"),)
    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    submission_type = Column(String, nullable=False)  # upload | text | structured
    answer_sheet_url = Column(String)
    digital_text = Column(Text)
    status = Column(String, default="processing")  # processing | pending_review | graded | needs_review | flagged | terminated
    ai_score = Column(Float)
    ai_feedback = Column(Text)
    question_analysis = Column(Text)  # JSON string
    submitted_at = Column(DateTime, server_default=func.now())
    # Teacher review fields
    final_score = Column(Float, nullable=True)       # set by teacher; falls back to ai_score if None
    teacher_notes = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    exam = relationship("Exam", back_populates="submissions")
    student = relationship("User", back_populates="submissions")
    flagged_answers = relationship("FlaggedAnswer", back_populates="submission")
    student_answers = relationship("StudentAnswer", back_populates="submission")
    proctoring_session = relationship("ProctoringSession", back_populates="submission", uselist=False)


class StudentAnswer(Base):
    __tablename__ = "student_answers"
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("exam_questions.id"), nullable=False)
    answer_text = Column(Text)
    selected_option = Column(String)  # for MCQ: "A", "B", "C", "D"
    is_voice_answer = Column(Boolean, default=False)

    submission = relationship("Submission", back_populates="student_answers")
    question = relationship("ExamQuestion", back_populates="student_answers")


class ProctoringSession(Base):
    __tablename__ = "proctoring_sessions"
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=True)
    started_at = Column(DateTime, server_default=func.now())
    ended_at = Column(DateTime, nullable=True)
    warning_count = Column(Integer, default=0)
    terminated = Column(Boolean, default=False)
    termination_reason = Column(String, nullable=True)

    submission = relationship("Submission", back_populates="proctoring_session")
    events = relationship("ProctoringEvent", back_populates="session")


class ProctoringEvent(Base):
    __tablename__ = "proctoring_events"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("proctoring_sessions.id"), nullable=False)
    event_type = Column(String, nullable=False)  # phone | book | multiple_persons | face_absent
    warning_level = Column(Integer, nullable=False)  # 1 | 2 | 3
    detected_at = Column(DateTime, server_default=func.now())
    frame_snapshot_url = Column(String, nullable=True)

    session = relationship("ProctoringSession", back_populates="events")


class FlaggedAnswer(Base):
    __tablename__ = "flagged_answers"
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    flag_type = Column(String, nullable=False)  # ai_uncertainty | suspicious
    reason = Column(Text, nullable=False)
    resolved = Column(Boolean, default=False)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    submission = relationship("Submission", back_populates="flagged_answers")


class AIQuiz(Base):
    __tablename__ = "ai_quizzes"
    id = Column(Integer, primary_key=True, index=True)
    source_exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    title = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    difficulty = Column(String, nullable=False)  # easy | medium | hard
    questions = Column(Text, nullable=False)  # JSON string
    created_at = Column(DateTime, server_default=func.now())

    source_exam = relationship("Exam", back_populates="ai_quizzes")
    attempts = relationship("QuizAttempt", back_populates="quiz")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("ai_quizzes.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Float)
    time_spent_seconds = Column(Integer)
    answers = Column(Text)  # JSON string
    completed_at = Column(DateTime, server_default=func.now())

    quiz = relationship("AIQuiz", back_populates="attempts")


class StudySession(Base):
    __tablename__ = "study_sessions"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    topic = Column(String, nullable=False)
    subject = Column(String)
    scheduled_date = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    tags = Column(Text)  # JSON string
    is_ai_generated = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    student = relationship("User", back_populates="study_sessions")


class Assignment(Base):
    __tablename__ = "assignments"
    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    total_marks = Column(Integer, default=100)
    passing_marks = Column(Integer, default=50)
    due_date = Column(DateTime, nullable=False)
    question_paper_url = Column(String, nullable=True)
    marking_scheme_url = Column(String, nullable=True)
    has_marking_scheme = Column(Boolean, default=False)
    submission_format = Column(String, default="both")  # typed | upload | both
    created_at = Column(DateTime, server_default=func.now())

    teacher = relationship("User", foreign_keys=[teacher_id])
    submissions = relationship("AssignmentSubmission", back_populates="assignment")


class AssignmentSubmission(Base):
    __tablename__ = "assignment_submissions"
    __table_args__ = (UniqueConstraint("assignment_id", "student_id", name="uq_assignmentsubmission_assignment_student"),)
    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    submission_type = Column(String, nullable=False)  # upload | text
    answer_sheet_url = Column(String, nullable=True)
    digital_text = Column(Text, nullable=True)
    status = Column(String, default="processing")  # processing | pending_review | manual_review | graded | needs_review | flagged
    ai_score = Column(Float, nullable=True)
    ai_feedback = Column(Text, nullable=True)
    question_analysis = Column(Text, nullable=True)
    final_score = Column(Float, nullable=True)
    teacher_notes = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    submitted_at = Column(DateTime, server_default=func.now())

    assignment = relationship("Assignment", back_populates="submissions")
    student = relationship("User", foreign_keys=[student_id])


class ExamBlock(Base):
    """Records students permanently blocked from an exam due to proctoring termination."""
    __tablename__ = "exam_blocks"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    session_key = Column(String)
    blocked_at = Column(DateTime, server_default=func.now())
    screenshot_urls = Column(Text)  # JSON array of screenshot file URLs
