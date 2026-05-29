from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import books, reviews, instructors, ranking, ai, auth, ai_feedback
from app.config import get_settings

settings = get_settings()

app = FastAPI(title="BG参考書DB API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(auth.router,        prefix="/api/v1/auth")
app.include_router(books.router,       prefix="/api/v1/books")
app.include_router(reviews.router,     prefix="/api/v1")
app.include_router(instructors.router, prefix="/api/v1/instructors")
app.include_router(ranking.router,     prefix="/api/v1/ranking")
app.include_router(ai.router,          prefix="/api/v1/ai")
app.include_router(ai_feedback.router, prefix="/api/v1/ai/feedback")
