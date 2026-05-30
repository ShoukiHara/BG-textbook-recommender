from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, exists, func
from app.database import get_db, AsyncSessionLocal
from app.models import Book, Review, Instructor
from app.schemas import DiagnoseRequest, DiagnoseResponse, AIGuideResponse, RecommendedBook
from app.logic import LAYERS, compute_review_summary
from app.routers.auth import require_admin
from app.ai_client import is_configured, generate_text
import json

router = APIRouter(tags=["ai"])


def _strip_json(text: str) -> str:
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    return text.strip()


def _book_summary(book: Book) -> str:
    """diagnose プロンプト用のサマリーをキャッシュから構築する。"""
    parts = []
    if book.ai_guide_cache:
        parts.append(book.ai_guide_cache[:300])

    cache = book.review_summary_cache or {}
    if cache.get("strengthens"):
        parts.append(f"強化できる弱点: {' / '.join(cache['strengthens'])}")
    layer_counts = cache.get("layer_counts", {})
    if layer_counts:
        layer_str = ", ".join(f"レイヤー{l}（{n}件）" for l, n in sorted(layer_counts.items()))
        parts.append(f"レビューのあるレイヤー: {layer_str}")

    return "\n".join(parts)


def _build_guide_prompt(book: Book, review_texts: list[str]) -> str:
    return f"""参考書「{book.title}」（科目: {book.subject}）について、複数の講師のレビューをもとに、生徒向けの参考書ガイドを作成してください。

レビュー一覧:
{"\n\n".join(review_texts)}

以下の構成で400字程度のガイドを書いてください。
- 参考書の基本特徴（解説の丁寧さ・問題量・難易度帯・完了期間・独学適性）
- どんな弱点・課題を持つ生徒に向いているか
- 前後の参考書との接続（どの参考書を終えてから使うか、次に何につなげるか）
- 使い方・取り組み方のポイント
複数講師の意見が一致している点は強調し、意見が分かれる点は「講師によって〜」と明記してください。"""


def _build_diagnose_prompt(body: DiagnoseRequest, books_section: str) -> str:
    return f"""あなたは予備校の学習カウンセラーです。以下の生徒情報と参考書リストをもとに、学習フェーズの判定と最適な参考書の推薦を行ってください。

【生徒情報】
科目: {body.subject}
学年: {body.grade}
志望校学部学科: {body.target_department}
現在の模試成績: {body.mock_score}
これまで使用・現在使用中の参考書: {body.books_history}
具体的な弱点: {body.weak_points}
学習スタイルの好み: {body.learning_style}{f"""
英語の弱点分野: {', '.join(body.english_weak_areas)}""" if body.english_weak_areas else ""}{f"""
数学の克服したい苦手: {', '.join(body.math_weak_areas)}""" if body.math_weak_areas else ""}

【参考書リスト（科目: {body.subject}）】
{books_section}

【レイヤー定義】
1: 予習・初学フェーズ
2: 基礎力完成フェーズ（地方国公立ゴール）
3: 応用・発展フェーズ（阪大以上ゴール）

生徒情報と各参考書の内容を照らし合わせ、以下のJSON形式のみで回答してください（説明文は一切不要）：
{{
  "layer": <1, 2, または 3>,
  "diagnosis_reason": "<レイヤー判定の理由を100〜200字で>",
  "recommended_books": [
    {{"book_id": "<上記リストのbook_id>", "title": "<書名>", "reason": "<この生徒に推薦する理由を50〜100字で>"}},
    ...最大5冊、生徒の現状に合った順に並べること
  ]
}}"""


async def _do_generate_guide(book: Book, db: AsyncSession) -> str | None:
    """AIガイドテキストを生成して返す。生成できない場合は None。"""
    result = await db.execute(
        select(Review, Instructor)
        .outerjoin(Instructor, Review.instructor_id == Instructor.id)
        .where(Review.book_id == book.id)
    )
    rows = result.all()
    if not rows:
        return None

    review_texts = []
    for row in rows:
        review = row.Review
        instructor_name = row.Instructor.name if row.Instructor else "匿名"
        layer_name = LAYERS.get(review.layer, str(review.layer))
        parts = [f"【{instructor_name}講師 / {layer_name} / 評価:{review.rating}/5】"]
        for label, val in [
            ("対象偏差値帯",     review.target_deviation),
            ("解説の充実度",     review.explanation_quality),
            ("問題量",           review.problem_volume),
            ("完了にかかる期間", review.completion_period),
            ("独学適性",         review.self_study_suitability),
            ("強化できる弱点",   review.strengthens_weaknesses),
            ("使用時期・期間",   review.period),
            ("前の参考書との接続", review.before_connection),
            ("後の参考書との接続", review.after_connection),
            ("使用感",           review.usage_feel),
        ]:
            if val:
                parts.append(f"  {label}: {val}")
        review_texts.append("\n".join(parts))

    return await generate_text(_build_guide_prompt(book, review_texts))


async def _generate_guide_background(book_id: UUID) -> None:
    """バックグラウンドでAIガイドを生成してDBに保存する。"""
    async with AsyncSessionLocal() as db:
        book = await db.get(Book, book_id)
        if not book or book.ai_guide_cache:
            return
        guide = await _do_generate_guide(book, db)
        if guide:
            book.ai_guide_cache = guide
            await db.commit()


@router.post("/diagnose", response_model=DiagnoseResponse)
async def diagnose(
    body: DiagnoseRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    if not is_configured():
        raise HTTPException(status_code=503, detail="AI API not configured")

    books_result = await db.execute(select(Book).where(Book.subject == body.subject))
    books = list(books_result.scalars().all())

    book_entries = []
    valid_book_ids: set[str] = set()
    for book in books:
        summary = _book_summary(book)
        if not summary:
            continue
        valid_book_ids.add(str(book.id))
        book_entries.append(f"[book_id: {book.id}] 「{book.title}」\n{summary}")

    books_section = "\n\n".join(book_entries) if book_entries else "（この科目の参考書データはまだありません）"
    result_text = await generate_text(_build_diagnose_prompt(body, books_section))

    if result_text is None:
        raise HTTPException(status_code=502, detail="AI API error")

    try:
        data = json.loads(_strip_json(result_text))
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI response parse error")

    recommended = [
        RecommendedBook(book_id=rb["book_id"], title=rb["title"], reason=rb["reason"])
        for rb in data.get("recommended_books", [])
        if rb.get("book_id") in valid_book_ids
    ]

    book_map = {str(b.id): b for b in books}
    for rec in recommended:
        book = book_map.get(rec.book_id)
        if book and book.ai_guide_cache is None:
            background_tasks.add_task(_generate_guide_background, book.id)

    return DiagnoseResponse(
        layer=int(data["layer"]),
        diagnosis_reason=data["diagnosis_reason"],
        recommended_books=recommended,
    )


@router.get("/book-guide/{book_id}", response_model=AIGuideResponse)
async def book_guide(book_id: UUID, db: AsyncSession = Depends(get_db)):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    if book.ai_guide_cache is not None:
        return AIGuideResponse(guide=book.ai_guide_cache)

    review_count = (await db.execute(
        select(func.count()).where(Review.book_id == book_id)
    )).scalar()
    if review_count == 0:
        return AIGuideResponse(guide="まだレビューがありません。")

    if not is_configured():
        return AIGuideResponse(guide="AI機能が設定されていません。")

    guide = await _do_generate_guide(book, db)
    if guide is None:
        return AIGuideResponse(guide="AI生成に失敗しました。しばらくしてから再度お試しください。")

    book.ai_guide_cache = guide
    await db.commit()
    return AIGuideResponse(guide=guide)


@router.post("/generate-all-guides", status_code=202)
async def generate_all_guides(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_admin),
):
    # review_summary_cache が未計算の本をバックフィル
    uncached = (await db.execute(
        select(Book).where(Book.review_summary_cache.is_(None), exists().where(Review.book_id == Book.id))
    )).scalars().all()
    for book in uncached:
        reviews = (await db.execute(select(Review).where(Review.book_id == book.id))).scalars().all()
        book.review_summary_cache = compute_review_summary(reviews) or None
    await db.commit()

    # AIガイド未生成の本をキュー
    books = (await db.execute(
        select(Book).where(Book.ai_guide_cache.is_(None), exists().where(Review.book_id == Book.id))
    )).scalars().all()
    for book in books:
        background_tasks.add_task(_generate_guide_background, book.id)

    return {"queued": len(books)}
