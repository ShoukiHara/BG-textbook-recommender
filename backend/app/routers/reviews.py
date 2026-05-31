from uuid import UUID
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, literal
from app.database import get_db
from app.models import Book, Review, Instructor
from app.schemas import ReviewCreate, AdminReviewCreate, ReviewUpdate, ReviewOut
from app.routers.auth import require_admin
from app.logic import compute_review_summary
from app.email_notify import send_review_notification

router = APIRouter(tags=["reviews"])


async def _get_reviews_with_names(db: AsyncSession, book_id: UUID) -> list[ReviewOut]:
    from app.models import Book as BookModel
    stmt = (
        select(Review, func.coalesce(Instructor.name, literal("匿名")).label("instructor_name"), BookModel.subject.label("book_subject"))
        .outerjoin(Instructor, Review.instructor_id == Instructor.id)
        .join(BookModel, Review.book_id == BookModel.id)
        .where(Review.book_id == book_id)
        .order_by(Review.created_at.desc())
    )
    rows = (await db.execute(stmt)).all()
    return [
        ReviewOut(
            id=row.Review.id,
            book_id=row.Review.book_id,
            instructor_id=row.Review.instructor_id,
            instructor_name=row.instructor_name,
            subject=row.book_subject,
            layer=row.Review.layer,
            rating=row.Review.rating,
            period=row.Review.period,
            before_connection=row.Review.before_connection,
            after_connection=row.Review.after_connection,
            usage_feel=row.Review.usage_feel,
            explanation_quality=row.Review.explanation_quality,
            problem_volume=row.Review.problem_volume,
            strengthens_weaknesses=row.Review.strengthens_weaknesses,
            target_deviation=row.Review.target_deviation,
            completion_period=row.Review.completion_period,
            self_study_suitability=row.Review.self_study_suitability,
            english_category=row.Review.english_category,
            math_category=row.Review.math_category,
            science_category=row.Review.science_category,
            created_at=row.Review.created_at,
        )
        for row in rows
    ]


async def _invalidate_book_caches(db: AsyncSession, book: Book) -> None:
    """レビュー変更時にBookの両キャッシュを更新する。"""
    book.ai_guide_cache = None
    reviews = (await db.execute(select(Review).where(Review.book_id == book.id))).scalars().all()
    book.review_summary_cache = compute_review_summary(reviews) or None


@router.get("/books/{book_id}/reviews", response_model=list[ReviewOut])
async def list_reviews(book_id: UUID, db: AsyncSession = Depends(get_db)):
    if not await db.get(Book, book_id):
        raise HTTPException(status_code=404, detail="Book not found")
    return await _get_reviews_with_names(db, book_id)


@router.get("/reviews", response_model=list[ReviewOut])
async def list_reviews_filtered(
    book_id: UUID | None = None,
    instructor_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_admin),
):
    stmt = (
        select(Review, func.coalesce(Instructor.name, literal("匿名")).label("instructor_name"), Book.title.label("book_title"), Book.subject.label("book_subject"))
        .outerjoin(Instructor, Review.instructor_id == Instructor.id)
        .join(Book, Review.book_id == Book.id)
        .order_by(Review.created_at.desc())
    )
    if book_id:
        stmt = stmt.where(Review.book_id == book_id)
    if instructor_id:
        stmt = stmt.where(Review.instructor_id == instructor_id)
    rows = (await db.execute(stmt)).all()
    return [
        ReviewOut(
            id=row.Review.id,
            book_id=row.Review.book_id,
            instructor_id=row.Review.instructor_id,
            instructor_name=row.instructor_name,
            book_title=row.book_title,
            subject=row.book_subject,
            layer=row.Review.layer,
            rating=row.Review.rating,
            period=row.Review.period,
            before_connection=row.Review.before_connection,
            after_connection=row.Review.after_connection,
            usage_feel=row.Review.usage_feel,
            explanation_quality=row.Review.explanation_quality,
            problem_volume=row.Review.problem_volume,
            strengthens_weaknesses=row.Review.strengthens_weaknesses,
            target_deviation=row.Review.target_deviation,
            completion_period=row.Review.completion_period,
            self_study_suitability=row.Review.self_study_suitability,
            english_category=row.Review.english_category,
            math_category=row.Review.math_category,
            science_category=row.Review.science_category,
            created_at=row.Review.created_at,
        )
        for row in rows
    ]


@router.post("/books/{book_id}/reviews", response_model=list[ReviewOut], status_code=201)
async def create_review(book_id: UUID, body: ReviewCreate, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    instructor = await db.get(Instructor, body.instructor_id)
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")
    if not body.layer_ratings:
        raise HTTPException(status_code=422, detail="layer_ratings must not be empty")

    # commit前に取り出しておく（commit後はexpireされアクセス不可になる場合がある）
    book_title = book.title
    book_subject = book.subject
    instructor_name = instructor.name
    layer_ratings_snapshot = [{"layer": lr.layer, "rating": lr.rating} for lr in body.layer_ratings]

    shared = body.model_dump(exclude={"layer_ratings"})
    created_ids = []
    for lr in body.layer_ratings:
        review = Review(book_id=book_id, layer=lr.layer, rating=lr.rating, **shared)
        db.add(review)
        created_ids.append(review.id)

    await _invalidate_book_caches(db, book)
    await db.commit()

    background_tasks.add_task(
        send_review_notification,
        book_title,
        book_subject,
        instructor_name,
        layer_ratings_snapshot,
    )

    all_reviews = await _get_reviews_with_names(db, book_id)
    return [r for r in all_reviews if r.id in created_ids]


@router.patch("/reviews/{review_id}", response_model=ReviewOut)
async def update_review(
    review_id: UUID,
    body: ReviewUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_admin),
):
    review = await db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(review, field, value)

    book = await db.get(Book, review.book_id)
    if book:
        await _invalidate_book_caches(db, book)

    await db.commit()
    await db.refresh(review)

    reviews = await _get_reviews_with_names(db, review.book_id)
    return next(r for r in reviews if r.id == review_id)


@router.delete("/reviews/{review_id}", status_code=204)
async def delete_review(
    review_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_admin),
):
    review = await db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    book = await db.get(Book, review.book_id)
    await db.delete(review)
    if book:
        await _invalidate_book_caches(db, book)
    await db.commit()


@router.post("/admin/reviews", response_model=list[ReviewOut], status_code=201)
async def admin_create_reviews(
    body: AdminReviewCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_admin),
):
    book = await db.get(Book, body.book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if body.instructor_id and not await db.get(Instructor, body.instructor_id):
        raise HTTPException(status_code=404, detail="Instructor not found")
    if not body.layer_ratings:
        raise HTTPException(status_code=422, detail="layer_ratings must not be empty")

    shared = body.model_dump(exclude={"book_id", "layer_ratings"})
    created_ids = []
    for lr in body.layer_ratings:
        review = Review(book_id=body.book_id, layer=lr.layer, rating=lr.rating, **shared)
        db.add(review)
        created_ids.append(review.id)

    await _invalidate_book_caches(db, book)
    await db.commit()

    all_reviews = await _get_reviews_with_names(db, body.book_id)
    return [r for r in all_reviews if r.id in created_ids]
