from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models import AIDiagnosisFeedback
from app.schemas import AIDiagnosisFeedbackCreate, AIDiagnosisFeedbackOut
from app.routers.auth import require_admin

router = APIRouter(tags=["ai_feedback"])


@router.post("", response_model=AIDiagnosisFeedbackOut, status_code=201)
async def create_feedback(
    body: AIDiagnosisFeedbackCreate,
    db: AsyncSession = Depends(get_db),
):
    record = AIDiagnosisFeedback(**body.model_dump())
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.get("", response_model=list[AIDiagnosisFeedbackOut])
async def list_feedback(
    subject: str | None = Query(None),
    min_score: int | None = Query(None),
    max_score: int | None = Query(None),
    limit: int = Query(100, le=500),
    _: None = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AIDiagnosisFeedback).order_by(AIDiagnosisFeedback.created_at.desc()).limit(limit)
    if subject:
        stmt = stmt.where(AIDiagnosisFeedback.subject == subject)
    if min_score is not None:
        stmt = stmt.where(AIDiagnosisFeedback.score >= min_score)
    if max_score is not None:
        stmt = stmt.where(AIDiagnosisFeedback.score <= max_score)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/summary")
async def feedback_summary(
    _: None = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(
            AIDiagnosisFeedback.subject,
            AIDiagnosisFeedback.diagnosed_layer,
            func.avg(AIDiagnosisFeedback.score).label("avg_score"),
            func.count().label("count"),
        ).group_by(
            AIDiagnosisFeedback.subject,
            AIDiagnosisFeedback.diagnosed_layer,
        ).order_by(AIDiagnosisFeedback.subject, AIDiagnosisFeedback.diagnosed_layer)
    )
    return [
        {
            "subject": r.subject,
            "diagnosed_layer": r.diagnosed_layer,
            "avg_score": round(float(r.avg_score), 2),
            "count": r.count,
        }
        for r in rows
    ]
