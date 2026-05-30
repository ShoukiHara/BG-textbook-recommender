import math
from collections import defaultdict
from typing import Sequence
from app.models import Review

SUBJECTS = [
    "英語", "文系数学", "理系数学", "現代文", "古文", "漢文",
    "物理", "化学", "生物", "日本史", "世界史", "地理", "倫理・政治経済"
]

LAYERS = {
    1: "予習・初学フェーズ",
    2: "基礎力完成フェーズ (地方国公立ゴール)",
    3: "応用・発展フェーズ (阪大以上ゴール)"
}


def compute_review_summary(reviews: Sequence[Review]) -> dict:
    if not reviews:
        return {}

    # strengthens_weaknesses を分割・集約（重複除去）
    seen: set[str] = set()
    strengthens: list[str] = []
    for r in reviews:
        if not r.strengthens_weaknesses:
            continue
        for item in r.strengthens_weaknesses.replace("、", ",").replace("・", ",").split(","):
            item = item.strip()
            if item and item not in seen:
                seen.add(item)
                strengthens.append(item)

    layer_counts: dict[str, int] = {}
    for r in reviews:
        key = str(r.layer)
        layer_counts[key] = layer_counts.get(key, 0) + 1

    avg_rating = sum(r.rating for r in reviews) / len(reviews)

    # カテゴリ集計（最頻値）
    def most_common(vals: list[str]) -> str:
        expanded = [c.strip() for v in vals for c in v.split(',') if c.strip()]
        return max(set(expanded), key=expanded.count) if expanded else ""

    english_category = most_common([r.english_category for r in reviews])
    math_category = most_common([r.math_category for r in reviews])
    science_category = most_common([r.science_category for r in reviews])

    return {
        "strengthens": strengthens,
        "layer_counts": layer_counts,
        "avg_rating": round(avg_rating, 2),
        "count": len(reviews),
        "english_category": english_category,
        "math_category": math_category,
        "science_category": science_category,
    }


SUBJECT_CATEGORY_FIELD = {
    "英語":     "english_category",
    "文系数学": "math_category",
    "理系数学": "math_category",
    "物理":     "science_category",
    "化学":     "science_category",
    "生物":     "science_category",
}

MAX_VARIANCE = 6.25  # 評価0〜5のスケールでの最大分散


def _most_common(vals: list[str]) -> str:
    filtered = [v for v in vals if v]
    return max(set(filtered), key=filtered.count) if filtered else ""


def calculate_ranking(
    reviews: Sequence[Review],
    book_map: dict,
    subject: str = "",
    category: str = "",
) -> list[dict]:
    instructor_review_counts: dict[str, int] = defaultdict(int)
    for r in reviews:
        key = str(r.instructor_id) if r.instructor_id else "__anon__"
        instructor_review_counts[key] += 1

    category_field = SUBJECT_CATEGORY_FIELD.get(subject, "")

    book_data: dict[str, dict] = defaultdict(lambda: {
        "weighted_sum": 0.0, "weight_sum": 0.0,
        "ratings": [],
        "english_categories": [], "math_categories": [], "science_categories": [],
        "category_match_count": 0, "total_count": 0,
    })

    for r in reviews:
        key = str(r.instructor_id) if r.instructor_id else "__anon__"
        weight = math.log10(instructor_review_counts[key] + 10)
        bid = str(r.book_id)
        d = book_data[bid]
        d["weighted_sum"] += r.rating * weight
        d["weight_sum"] += weight
        d["ratings"].append(r.rating)
        d["total_count"] += 1

        for cat in (r.english_category.split(',') if r.english_category else []):
            d["english_categories"].append(cat.strip())
        for cat in (r.math_category.split(',') if r.math_category else []):
            d["math_categories"].append(cat.strip())
        for cat in (r.science_category.split(',') if r.science_category else []):
            d["science_categories"].append(cat.strip())

        # カテゴリ一致カウント
        if category and category_field:
            stored = getattr(r, category_field, "") or ""
            cats = [c.strip() for c in stored.split(',') if c.strip()]
            if category in cats:
                d["category_match_count"] += 1

    results = []
    for bid, d in book_data.items():
        if d["weight_sum"] == 0 or d["total_count"] == 0:
            continue

        # --- 品質スコア（重み付き平均 × 分散ペナルティ） ---
        weighted_avg = d["weighted_sum"] / d["weight_sum"]
        ratings = d["ratings"]
        avg_unweighted = sum(ratings) / len(ratings)
        variance = sum((r - avg_unweighted) ** 2 for r in ratings) / len(ratings)
        quality_score = weighted_avg * (1 - 0.5 * variance / MAX_VARIANCE)

        # --- カテゴリ一致スコア（0〜5スケール） ---
        if category and d["total_count"] > 0:
            match_ratio = d["category_match_count"] / d["total_count"]
            category_score = match_ratio * 5.0
            final_score = 0.6 * quality_score + 0.4 * category_score
        else:
            final_score = quality_score

        ecats = d["english_categories"]
        mcats = d["math_categories"]
        scats = d["science_categories"]
        book = book_map.get(bid)
        if book:
            results.append({
                "book_id": bid,
                "title": book.title,
                "score": round(final_score, 4),
                "avg_rating": round(avg_unweighted, 2),
                "review_count": d["total_count"],
                "english_category": _most_common(ecats),
                "math_category": _most_common(mcats),
                "science_category": _most_common(scats),
            })

    results.sort(key=lambda x: x["score"], reverse=True)
    return [{"rank": i + 1, **item} for i, item in enumerate(results[:10])]
