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

    return {
        "strengthens": strengthens,
        "layer_counts": layer_counts,
        "avg_rating": round(avg_rating, 2),
        "count": len(reviews),
    }


def calculate_ranking(reviews: Sequence[Review], book_map: dict) -> list[dict]:
    instructor_review_counts: dict[str, int] = defaultdict(int)
    for r in reviews:
        key = str(r.instructor_id) if r.instructor_id else "__anon__"
        instructor_review_counts[key] += 1

    book_scores: dict[str, dict] = defaultdict(lambda: {"weighted_sum": 0.0, "weight_sum": 0.0, "count": 0, "rating_sum": 0, "english_categories": [], "math_categories": [], "science_categories": []})

    for r in reviews:
        key = str(r.instructor_id) if r.instructor_id else "__anon__"
        weight = math.log10(instructor_review_counts[key] + 10)
        bid = str(r.book_id)
        book_scores[bid]["weighted_sum"] += r.rating * weight
        book_scores[bid]["weight_sum"] += weight
        book_scores[bid]["count"] += 1
        book_scores[bid]["rating_sum"] += r.rating
        if r.english_category:
            book_scores[bid]["english_categories"].append(r.english_category)
        if r.math_category:
            book_scores[bid]["math_categories"].append(r.math_category)
        if r.science_category:
            book_scores[bid]["science_categories"].append(r.science_category)

    results = []
    for bid, data in book_scores.items():
        if data["weight_sum"] == 0 or data["count"] == 0:
            continue
        score = data["weighted_sum"] / data["weight_sum"]
        avg_rating = data["rating_sum"] / data["count"]
        # 最頻のenglish_categoryを代表値として使用
        ecats = data["english_categories"]
        english_category = max(set(ecats), key=ecats.count) if ecats else ""
        mcats = data["math_categories"]
        math_category = max(set(mcats), key=mcats.count) if mcats else ""
        scats = data["science_categories"]
        science_category = max(set(scats), key=scats.count) if scats else ""
        book = book_map.get(bid)
        if book:
            results.append({
                "book_id": bid,
                "title": book.title,
                "score": round(score, 4),
                "avg_rating": round(avg_rating, 2),
                "review_count": data["count"],
                "english_category": english_category,
                "math_category": math_category,
                "science_category": science_category,
            })

    results.sort(key=lambda x: x["score"], reverse=True)

    return [{"rank": i + 1, **item} for i, item in enumerate(results[:10])]
