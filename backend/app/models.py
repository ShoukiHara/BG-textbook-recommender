import uuid
from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, DateTime, Text, CheckConstraint, UniqueConstraint, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class Instructor(Base):
    __tablename__ = "instructors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    enrollment_year: Mapped[str] = mapped_column(String, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    reviews: Mapped[list["Review"]] = relationship("Review", back_populates="instructor")


class Book(Base):
    __tablename__ = "books"
    __table_args__ = (UniqueConstraint("title", "subject"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    ai_guide_cache: Mapped[str | None] = mapped_column(Text, nullable=True)
    review_summary_cache: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    reviews: Mapped[list["Review"]] = relationship("Review", back_populates="book", cascade="all, delete-orphan")


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("layer in (1, 2, 3)", name="reviews_layer_check"),
        CheckConstraint("rating >= 0 and rating <= 5", name="reviews_rating_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), nullable=False)
    instructor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("instructors.id", ondelete="SET NULL"), nullable=True)
    layer: Mapped[int] = mapped_column(Integer, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False, default="")
    period: Mapped[str] = mapped_column(Text, nullable=False, default="")
    before_connection: Mapped[str] = mapped_column(Text, nullable=False, default="")
    after_connection: Mapped[str] = mapped_column(Text, nullable=False, default="")
    usage_feel: Mapped[str] = mapped_column(Text, nullable=False, default="")
    explanation_quality: Mapped[str] = mapped_column(Text, nullable=False, default="")
    problem_volume: Mapped[str] = mapped_column(Text, nullable=False, default="")
    strengthens_weaknesses: Mapped[str] = mapped_column(Text, nullable=False, default="")
    target_deviation: Mapped[str] = mapped_column(Text, nullable=False, default="")
    completion_period: Mapped[str] = mapped_column(Text, nullable=False, default="")
    self_study_suitability: Mapped[str] = mapped_column(Text, nullable=False, default="")
    english_category: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    book: Mapped["Book"] = relationship("Book", back_populates="reviews")
    instructor: Mapped["Instructor | None"] = relationship("Instructor", back_populates="reviews")


class AIDiagnosisFeedback(Base):
    __tablename__ = "ai_diagnosis_feedback"
    __table_args__ = (
        CheckConstraint("diagnosed_layer in (1, 2, 3)", name="feedback_layer_check"),
        CheckConstraint("score >= 1 and score <= 10", name="feedback_score_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    subject: Mapped[str] = mapped_column(String, nullable=False)
    grade: Mapped[str] = mapped_column(String, nullable=False)
    target_department: Mapped[str] = mapped_column(Text, nullable=False, default="")
    mock_score: Mapped[str] = mapped_column(Text, nullable=False, default="")
    books_history: Mapped[str] = mapped_column(Text, nullable=False, default="")
    weak_points: Mapped[str] = mapped_column(Text, nullable=False, default="")
    learning_style: Mapped[str] = mapped_column(Text, nullable=False, default="")

    diagnosed_layer: Mapped[int] = mapped_column(Integer, nullable=False)
    diagnosis_reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    recommended_books: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    score: Mapped[int] = mapped_column(Integer, nullable=False)
    feedback_comment: Mapped[str] = mapped_column(Text, nullable=False, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
