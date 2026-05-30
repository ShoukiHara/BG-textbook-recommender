import { Link } from 'react-router-dom'
import type { RankingItem } from '../lib/api'

interface Props {
  items: RankingItem[]
}

export default function BookCardList({ items }: Props) {
  if (items.length === 0) {
    return <p className="text-gray-500 text-center py-8">この条件に該当する参考書がまだありません。</p>
  }

  return (
    <div className="space-y-2">
      {items.map(item => (
        <Link
          key={item.book_id}
          to={`/books/${item.book_id}`}
          className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-blue-400 hover:shadow-sm transition-all"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{item.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              平均評価: {item.avg_rating.toFixed(1)} ／ レビュー: {item.review_count}件
            </p>
          </div>
          <div className="flex shrink-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className={`text-sm ${i < Math.round(item.avg_rating) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
            ))}
          </div>
        </Link>
      ))}
    </div>
  )
}
