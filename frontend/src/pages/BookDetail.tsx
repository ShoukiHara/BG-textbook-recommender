import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchBook, fetchReviews, fetchBookGuide, fetchBooks } from '../lib/api'
import { LAYERS } from '../lib/constants'
import StarRating from '../components/StarRating'

export default function BookDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: book, isLoading: bookLoading, isError: bookError } = useQuery({
    queryKey: ['book', id],
    queryFn: () => fetchBook(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['reviews', id],
    queryFn: () => fetchReviews(id!),
    enabled: !!id,
    staleTime: 0,
  })

  const { data: guide, isFetching: guideLoading } = useQuery({
    queryKey: ['ai-guide', id],
    queryFn: () => fetchBookGuide(id!),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  })

  const { data: relatedBooks = [] } = useQuery({
    queryKey: ['books', { subject: book?.subject }],
    queryFn: () => fetchBooks({ subject: book?.subject }),
    enabled: !!book?.subject,
    staleTime: 5 * 60 * 1000,
  })

  if (bookLoading) return <div className="text-center py-16 text-gray-500">読み込み中...</div>
  if (bookError) return <div className="text-center py-16 text-gray-500">読み込みに失敗しました。ページを更新してお試しください。</div>
  if (!book) return <div className="text-center py-16 text-gray-500">参考書が見つかりません。</div>

  const encodedTitle = encodeURIComponent(book.title)
  const amazonUrl = `https://www.amazon.co.jp/s?k=${encodedTitle}`
  const rakutenUrl = `https://search.rakuten.co.jp/search/mall/${encodedTitle}/`

  const otherBooks = relatedBooks.filter(b => b.id !== book.id).slice(0, 5)

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
        ← 戻る
      </button>

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{book.title}</h1>
        <span className="inline-block text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full mb-4">
          {book.subject}
        </span>
        <div className="flex gap-2">
          <a
            href={amazonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded hover:bg-orange-600 transition-colors"
          >
            Amazon で探す
          </a>
          <a
            href={rakutenUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 transition-colors"
          >
            楽天で探す
          </a>
        </div>
      </div>

      {/* AIガイド */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5 mb-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-3">AI ガイド</h2>
        {guideLoading ? (
          <p className="text-blue-600 text-sm">AIが分析中...</p>
        ) : (
          <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-wrap">{guide?.guide}</p>
        )}
      </div>

      {/* レビューを投稿するボタン */}
      <div className="mb-6">
        <Link
          to={`/instructor?bookId=${book.id}`}
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          この参考書にコメントをする
        </Link>
      </div>

      {/* レビュー一覧 */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          講師レビュー（{reviews.length}件）
        </h2>
        {reviewsLoading ? (
          <p className="text-gray-500 text-sm">読み込み中...</p>
        ) : reviews.length === 0 ? (
          <p className="text-gray-500 text-sm">まだレビューがありません。</p>
        ) : (
          <div className="space-y-4">
            {reviews.map(review => (
              <div key={review.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-800">{review.instructor_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {LAYERS[review.layer]}
                    </span>
                    <StarRating value={review.rating} readOnly />
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {[
                    review.explanation_quality && `解説: ${review.explanation_quality}`,
                    review.problem_volume && `問題量: ${review.problem_volume}`,
                    review.target_deviation && `偏差値: ${review.target_deviation}`,
                    review.completion_period && review.completion_period,
                    review.self_study_suitability && review.self_study_suitability,
                  ].filter(Boolean).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {[
                        review.explanation_quality && `解説: ${review.explanation_quality}`,
                        review.problem_volume && `問題量: ${review.problem_volume}`,
                        review.target_deviation && `偏差値: ${review.target_deviation}`,
                        review.completion_period && review.completion_period,
                        review.self_study_suitability && review.self_study_suitability,
                      ].filter(Boolean).map(chip => (
                        <span key={chip as string} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                          {chip}
                        </span>
                      ))}
                    </div>
                  )}

                  {review.strengthens_weaknesses && (
                    <p className="text-gray-600 text-xs">強化できる弱点: {review.strengthens_weaknesses}</p>
                  )}

                  {[
                    { label: '① 使用時期・期間',     value: review.period },
                    { label: '② 前の参考書との接続', value: review.before_connection },
                    { label: '③ 後の参考書との接続', value: review.after_connection },
                    { label: '④ 使用感',             value: review.usage_feel },
                  ].filter(f => f.value).map(({ label, value }) => (
                    <div key={label}>
                      <span className="font-medium text-gray-500">{label}</span>
                      <p className="text-gray-700 whitespace-pre-wrap mt-0.5">{value}</p>
                    </div>
                  ))}

                  {!review.explanation_quality && !review.problem_volume && !review.strengthens_weaknesses &&
                   !review.period && !review.before_connection && !review.after_connection && !review.usage_feel && (
                    <p className="text-gray-300">―</p>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  {new Date(review.created_at).toLocaleDateString('ja-JP')}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 関連参考書 */}
      {otherBooks.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">同じ科目の他の参考書</h2>
          <div className="space-y-2">
            {otherBooks.map(b => (
              <Link
                key={b.id}
                to={`/books/${b.id}`}
                className="block bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-blue-400 hover:shadow-sm transition-all text-sm text-gray-800 hover:text-blue-700"
              >
                {b.title}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
