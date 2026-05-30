from pydantic import BaseModel, UUID4
from datetime import datetime


# --- 参考書 ---

class BookCreate(BaseModel):
    title: str
    subject: str


class BookOut(BaseModel):
    id: UUID4
    title: str
    subject: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- レビュー ---

class LayerRating(BaseModel):
    layer: int
    rating: int


class ReviewCreate(BaseModel):
    instructor_id: UUID4
    layer_ratings: list[LayerRating]
    period: str = ""
    before_connection: str = ""
    after_connection: str = ""
    usage_feel: str = ""
    explanation_quality: str = ""
    problem_volume: str = ""
    strengthens_weaknesses: str = ""
    target_deviation: str = ""
    completion_period: str = ""
    self_study_suitability: str = ""
    english_category: str = ""


class ReviewUpdate(BaseModel):
    layer: int | None = None
    rating: int | None = None
    period: str | None = None
    before_connection: str | None = None
    after_connection: str | None = None
    usage_feel: str | None = None
    explanation_quality: str | None = None
    problem_volume: str | None = None
    strengthens_weaknesses: str | None = None
    target_deviation: str | None = None
    completion_period: str | None = None
    self_study_suitability: str | None = None
    english_category: str | None = None


class ReviewOut(BaseModel):
    id: UUID4
    instructor_name: str
    book_title: str = ""
    layer: int
    rating: int
    period: str
    before_connection: str
    after_connection: str
    usage_feel: str
    explanation_quality: str
    problem_volume: str
    strengthens_weaknesses: str
    target_deviation: str
    completion_period: str
    self_study_suitability: str
    english_category: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- 講師 ---

class InstructorCreate(BaseModel):
    name: str
    enrollment_year: str = ""


class InstructorUpdate(BaseModel):
    enrollment_year: str


class InstructorOut(BaseModel):
    id: UUID4
    name: str
    enrollment_year: str
    review_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


# --- ランキング ---

class RankingItem(BaseModel):
    rank: int
    book_id: UUID4
    title: str
    score: float
    avg_rating: float
    review_count: int


# --- AI診断 ---

class DiagnoseRequest(BaseModel):
    subject: str
    grade: str
    target_department: str
    mock_score: str
    books_history: str
    weak_points: str
    learning_style: str
    english_weak_areas: list[str] = []


class RecommendedBook(BaseModel):
    book_id: str
    title: str
    reason: str


class DiagnoseResponse(BaseModel):
    layer: int
    diagnosis_reason: str
    recommended_books: list[RecommendedBook]


class AIGuideResponse(BaseModel):
    guide: str


# --- AI診断フィードバック ---

class AIDiagnosisFeedbackCreate(BaseModel):
    subject: str
    grade: str
    target_department: str = ""
    mock_score: str = ""
    books_history: str = ""
    weak_points: str = ""
    learning_style: str = ""
    diagnosed_layer: int
    diagnosis_reason: str = ""
    recommended_books: list[dict] = []
    score: int
    feedback_comment: str = ""


class AIDiagnosisFeedbackOut(BaseModel):
    id: UUID4
    subject: str
    grade: str
    target_department: str
    mock_score: str
    books_history: str
    weak_points: str
    learning_style: str
    diagnosed_layer: int
    diagnosis_reason: str
    recommended_books: list[dict]
    score: int
    feedback_comment: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- 認証 ---

class LoginRequest(BaseModel):
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
