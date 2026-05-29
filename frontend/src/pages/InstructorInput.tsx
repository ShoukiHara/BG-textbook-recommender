import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchBooks, fetchInstructors, createReview, createBook } from '../lib/api'
import ReviewForm from '../components/ReviewForm'
import { SUBJECTS, SUBJECTS_WITH_COMMON } from '../lib/constants'

type Tab = 'review' | 'register'

export default function InstructorInput() {
  const [searchParams] = useSearchParams()
  const presetBookId = searchParams.get('bookId')

  const [tab, setTab] = useState<Tab>(presetBookId ? 'review' : 'review')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedBookId, setSelectedBookId] = useState(presetBookId ?? '')

  // 参考書登録タブ
  const [regSubject, setRegSubject] = useState<string>(SUBJECTS[0])
  const [regTitle, setRegTitle] = useState('')
  const [regError, setRegError] = useState<string | null>(null)
  const [regSuccess, setRegSuccess] = useState<string | null>(null)
  const [regLoading, setRegLoading] = useState(false)

  const { data: allBooks = [] } = useQuery({
    queryKey: ['books'],
    queryFn: () => fetchBooks(),
    staleTime: 5 * 60 * 1000,
  })

  const { data: allInstructors = [] } = useQuery({
    queryKey: ['instructors'],
    queryFn: fetchInstructors,
    staleTime: 5 * 60 * 1000,
  })
  const instructors = allInstructors.filter(i => i.enrollment_year !== '既卒')

  const filteredBooks = useMemo(() =>
    selectedSubject ? allBooks.filter(b => b.subject === selectedSubject) : allBooks,
    [allBooks, selectedSubject]
  )

  const booksBySubject = useMemo(() => {
    const map: Record<string, typeof allBooks> = {}
    for (const b of allBooks) {
      if (!map[b.subject]) map[b.subject] = []
      map[b.subject].push(b)
    }
    return map
  }, [allBooks])

  const duplicateCandidates = useMemo(() =>
    regTitle.trim().length > 0
      ? allBooks.filter(b => b.title.includes(regTitle) || regTitle.includes(b.title))
      : [],
    [allBooks, regTitle]
  )

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regTitle.trim()) return
    setRegLoading(true)
    setRegError(null)
    setRegSuccess(null)
    try {
      const created = await createBook({ title: regTitle.trim(), subject: regSubject })
      setRegSuccess(`「${created.map(b => b.title + '（' + b.subject + '）').join('、')}」を登録しました`)
      setRegTitle('')
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setRegError(status === 409 ? 'すでに登録済みの参考書です' : '登録に失敗しました')
    } finally {
      setRegLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">講師用データ入力</h1>

      <div className="flex border-b border-gray-200 mb-6">
        {(['review', 'register'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'review' ? 'レビューの投稿' : '参考書の登録'}
          </button>
        ))}
      </div>

      {tab === 'review' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">科目で絞り込み</label>
              <select
                value={selectedSubject}
                onChange={e => { setSelectedSubject(e.target.value); setSelectedBookId('') }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">すべて</option>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">参考書</label>
              <select
                value={selectedBookId}
                onChange={e => setSelectedBookId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                required
              >
                <option value="">-- 選択してください --</option>
                {filteredBooks.map(b => (
                  <option key={b.id} value={b.id}>{b.title}（{b.subject}）</option>
                ))}
              </select>
            </div>
          </div>

          {selectedBookId && (
            <ReviewForm
              bookId={selectedBookId}
              instructors={instructors}
              onSubmit={data => createReview(selectedBookId, data).then(() => {})}
            />
          )}
        </div>
      )}

      {tab === 'register' && (
        <div className="space-y-6">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">科目</label>
              <select
                value={regSubject}
                onChange={e => setRegSubject(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                {SUBJECTS_WITH_COMMON.map(s => <option key={s}>{s}</option>)}
              </select>
              {regSubject === '文理共通数学' && (
                <p className="text-xs text-blue-600 mt-1">「文系数学」と「理系数学」の両方に登録されます</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">参考書タイトル</label>
              <input
                type="text"
                value={regTitle}
                onChange={e => setRegTitle(e.target.value)}
                placeholder="例: 青チャート 数学Ⅱ+B"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                required
              />
              {duplicateCandidates.length > 0 && (
                <div className="mt-1 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                  類似の参考書が存在します: {duplicateCandidates.map(b => b.title).join('、')}
                </div>
              )}
            </div>

            {regError && <p className="text-sm text-red-600">{regError}</p>}
            {regSuccess && <p className="text-sm text-green-600">{regSuccess}</p>}

            <button
              type="submit"
              disabled={regLoading}
              className="w-full bg-blue-600 text-white py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {regLoading ? '登録中...' : '参考書を登録'}
            </button>
          </form>

          {/* 登録済み一覧 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">登録済み参考書</h3>
            <div className="space-y-2">
              {SUBJECTS.filter(s => booksBySubject[s]?.length).map(s => (
                <details key={s} className="border border-gray-200 rounded-md">
                  <summary className="px-3 py-2 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50">
                    {s}（{booksBySubject[s].length}冊）
                  </summary>
                  <ul className="px-4 pb-2 pt-1 space-y-1">
                    {booksBySubject[s].map(b => (
                      <li key={b.id} className="text-sm text-gray-600">・{b.title}</li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
