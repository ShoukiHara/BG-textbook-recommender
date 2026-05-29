from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models import Book, Review
from app.schemas import BookCreate, BookOut

router = APIRouter(tags=["books"])


@router.get("", response_model=list[BookOut])
async def list_books(
    subject: str | None = Query(None),
    sort: str = Query("title"),
    reviewed_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Book)
    if subject:
        stmt = stmt.where(Book.subject == subject)
    if reviewed_only:
        reviewed_ids_stmt = select(Review.book_id).distinct()
        reviewed_ids_result = await db.execute(reviewed_ids_stmt)
        reviewed_ids = [row[0] for row in reviewed_ids_result]
        stmt = stmt.where(Book.id.in_(reviewed_ids))

    result = await db.execute(stmt)
    books = list(result.scalars().all())

    if sort == "title":
        books.sort(key=lambda b: b.title)
    elif sort == "rating":
        rating_stmt = select(Review.book_id, func.avg(Review.rating).label("avg_rating")).group_by(Review.book_id)
        rating_result = await db.execute(rating_stmt)
        rating_map = {str(row.book_id): float(row.avg_rating or 0) for row in rating_result}
        books.sort(key=lambda b: rating_map.get(str(b.id), 0), reverse=True)
    elif sort == "review_count":
        count_stmt = select(Review.book_id, func.count(Review.id).label("cnt")).group_by(Review.book_id)
        count_result = await db.execute(count_stmt)
        count_map = {str(row.book_id): row.cnt for row in count_result}
        books.sort(key=lambda b: count_map.get(str(b.id), 0), reverse=True)

    return books


@router.get("/{book_id}", response_model=BookOut)
async def get_book(book_id: UUID, db: AsyncSession = Depends(get_db)):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@router.post("", response_model=list[BookOut], status_code=201)
async def create_book(body: BookCreate, db: AsyncSession = Depends(get_db)):
    subjects_to_create = ["文系数学", "理系数学"] if body.subject == "文理共通数学" else [body.subject]

    created = []
    for subject in subjects_to_create:
        existing = await db.execute(
            select(Book).where(Book.title == body.title, Book.subject == subject)
        )
        if existing.scalar_one_or_none():
            if len(subjects_to_create) == 1:
                raise HTTPException(status_code=409, detail="Book already exists")
            continue

        book = Book(title=body.title, subject=subject)
        db.add(book)
        created.append(book)

    if not created:
        raise HTTPException(status_code=409, detail="Book already exists")

    await db.commit()
    for book in created:
        await db.refresh(book)

    return created
