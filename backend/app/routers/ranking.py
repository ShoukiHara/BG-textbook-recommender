from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Book, Review
from app.schemas import RankingItem
from app.logic import calculate_ranking, LAYERS

router = APIRouter(tags=["ranking"])


@router.get("", response_model=list[RankingItem])
async def get_ranking(
    subject: str = Query(...),
    layer: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    if layer not in LAYERS:
        raise HTTPException(status_code=400, detail="layer must be 1, 2, or 3")

    books_result = await db.execute(select(Book).where(Book.subject == subject))
    books = books_result.scalars().all()
    book_ids = [b.id for b in books]

    if not book_ids:
        return []

    reviews_result = await db.execute(
        select(Review).where(Review.book_id.in_(book_ids), Review.layer == layer)
    )
    reviews = reviews_result.scalars().all()

    book_map = {str(b.id): b for b in books}
    return calculate_ranking(reviews, book_map)
