import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchBooks, fetchReviews } from '../lib/api'
import BookCard from '../components/BookCard'
import { SUBJECTS } from '../lib/constants'
import type { Book } from '../lib/api'

export default function StudentBookList() {
  const [subject, setSubject] = useState('')
  const [sort, setSort] = useState('title')
  const [reviewedOnly, setReviewedOnly] = useState(false)

  const { data: books = [], isLoading } = useQuery({
    queryKey: ['books', { subject: subject || undefined, sort, reviewed_only: reviewedOnly || undefined }],
    queryFn: () => fetchBooks({
      subject: subject || undefined,
      sort,
      reviewed_only: reviewedOnly || undefined,
    }),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">参考書一覧</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 flex flex-wrap gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">科目</label>
          <select
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="">すべて</option>
            {SUBJECTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">並び替え</label>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="title">タイトル順</option>
            <option value="rating">評価高い順</option>
            <option value="review_count">レビュー多い順</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={reviewedOnly}
              onChange={e => setReviewedOnly(e.target.checked)}
              className="accent-blue-600"
            />
            レビューのある本のみ
          </label>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-center py-8">読み込み中...</p>
      ) : books.length === 0 ? (
        <p className="text-gray-500 text-center py-8">該当する参考書がありません。</p>
      ) : (
        <div className="grid gap-3">
          {(books as Book[]).map(book => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  )
}
