import { Link } from 'react-router-dom'
import type { RankingItem } from '../lib/api'

interface Props {
  items: RankingItem[]
}

const MEDAL = ['🥇', '🥈', '🥉']

export default function RankingList({ items }: Props) {
  if (items.length === 0) {
    return <p className="text-gray-500 text-center py-8">この条件のランキングデータがまだありません。</p>
  }

  return (
    <ol className="space-y-3">
      {items.map(item => (
        <li key={item.book_id}>
          <Link
            to={`/books/${item.book_id}`}
            className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-blue-400 hover:shadow-sm transition-all"
          >
            <span className="text-2xl w-8 text-center shrink-0">
              {item.rank <= 3 ? MEDAL[item.rank - 1] : item.rank}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{item.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                スコア: {item.score.toFixed(2)} ／ 平均評価: {item.avg_rating.toFixed(1)} ／ レビュー: {item.review_count}件
              </p>
            </div>
            <span className="text-yellow-500 font-bold shrink-0">
              {'★'.repeat(Math.round(item.avg_rating))}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  )
}
