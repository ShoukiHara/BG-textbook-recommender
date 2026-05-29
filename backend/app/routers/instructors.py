from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, Integer
from app.database import get_db
from app.models import Instructor, Review
from app.schemas import InstructorCreate, InstructorUpdate, InstructorOut
from app.routers.auth import require_admin

router = APIRouter(tags=["instructors"])

ENROLLMENT_YEAR_ORDER = case(
    (Instructor.enrollment_year == "既卒", 9999),
    (Instructor.enrollment_year == "", 10000),
    else_=func.cast(Instructor.enrollment_year, Integer),
)


@router.get("", response_model=list[InstructorOut])
async def list_instructors(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(
        select(Instructor, func.count(Review.id).label("review_count"))
        .outerjoin(Review, Review.instructor_id == Instructor.id)
        .group_by(Instructor.id)
        .order_by(ENROLLMENT_YEAR_ORDER, Instructor.name)
    )
    return [
        InstructorOut(
            id=ins.id,
            name=ins.name,
            enrollment_year=ins.enrollment_year,
            review_count=count,
            created_at=ins.created_at,
        )
        for ins, count in rows
    ]


@router.post("", response_model=InstructorOut, status_code=201)
async def create_instructor(
    body: InstructorCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_admin),
):
    existing = await db.execute(select(Instructor).where(Instructor.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Instructor already exists")

    instructor = Instructor(name=body.name)
    db.add(instructor)
    await db.commit()
    await db.refresh(instructor)
    return instructor


@router.patch("/{instructor_id}", response_model=InstructorOut)
async def update_instructor(
    instructor_id: UUID,
    body: InstructorUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_admin),
):
    instructor = await db.get(Instructor, instructor_id)
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")
    instructor.enrollment_year = body.enrollment_year
    await db.commit()
    await db.refresh(instructor)
    count = (await db.execute(
        select(func.count(Review.id)).where(Review.instructor_id == instructor_id)
    )).scalar()
    return InstructorOut(
        id=instructor.id,
        name=instructor.name,
        enrollment_year=instructor.enrollment_year,
        review_count=count or 0,
        created_at=instructor.created_at,
    )


@router.delete("/{instructor_id}", status_code=204)
async def delete_instructor(
    instructor_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_admin),
):
    instructor = await db.get(Instructor, instructor_id)
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")

    await db.delete(instructor)
    await db.commit()
