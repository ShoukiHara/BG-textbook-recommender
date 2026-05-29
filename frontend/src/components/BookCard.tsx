import { Link } from 'react-router-dom'
import type { Book } from '../lib/api'

interface Props {
  book: Book
  avgRating?: number
  reviewCount?: number
}

export default function BookCard({ book, avgRating, reviewCount }: Props) {
  return (
    <Link
      to={`/books/${book.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-400 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{book.title}</p>
          <span className="inline-block mt-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
            {book.subject}
          </span>
        </div>
        {avgRating !== undefined && (
          <div className="text-right shrink-0">
            <p className="text-yellow-500 font-bold">{'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))}</p>
            <p className="text-xs text-gray-500">{avgRating.toFixed(1)} ({reviewCount ?? 0}件)</p>
          </div>
        )}
      </div>
    </Link>
  )
}
