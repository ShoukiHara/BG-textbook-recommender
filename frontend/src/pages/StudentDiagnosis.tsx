import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { diagnose, fetchRanking } from '../lib/api'
import RankingList from '../components/RankingList'
import DiagnosisFeedbackForm from '../components/DiagnosisFeedbackForm'
import { SUBJECTS, LAYERS, GRADES } from '../lib/constants'
import type { DiagnoseResponse, RankingItem } from '../lib/api'

const SS_KEY = 'student_diagnosis_state'
const SS_VERSION = 3

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed.version === SS_VERSION ? parsed : null
  } catch {
    return null
  }
}

type Tab = 'ai' | 'manual'

export default function StudentDiagnosis() {
  const saved = loadSession()

  const [tab, setTab] = useState<Tab>(saved?.tab ?? 'ai')

  // AI タブ状態
  const [aiForm, setAiForm] = useState(saved?.aiForm ?? {
    subject: SUBJECTS[0],
    grade: GRADES[0],
    target_department: '',
    mock_score: '',
    books_history: '',
    weak_points: '',
    learning_style: '',
  })
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagResult, setDiagResult] = useState<DiagnoseResponse | null>(saved?.diagResult ?? null)
  const [diagError, setDiagError] = useState<string | null>(null)

  // 手動タブ状態
  const [manualSubject, setManualSubject] = useState(saved?.manualSubject ?? SUBJECTS[0])
  const [manualLayer, setManualLayer] = useState(saved?.manualLayer ?? 1)

  // 状態変化をセッションストレージに保存
  useEffect(() => {
    sessionStorage.setItem(SS_KEY, JSON.stringify({ version: SS_VERSION, tab, aiForm, diagResult, manualSubject, manualLayer }))
  }, [tab, aiForm, diagResult, manualSubject, manualLayer])

  // 手動タブ用ランキング
  const { data: ranking = [], isFetching: rankingLoading } = useQuery({
    queryKey: ['ranking', manualSubject, manualLayer],
    queryFn: () => fetchRanking(manualSubject, manualLayer),
    enabled: tab === 'manual',
    staleTime: 10 * 60 * 1000,
  })

  const handleDiagnose = async (e: React.FormEvent) => {
    e.preventDefault()
    setDiagnosing(true)
    setDiagError(null)
    setDiagResult(null)
    try {
      const result = await diagnose(aiForm)
      setDiagResult(result)
    } catch {
      setDiagError('診断に失敗しました。しばらくしてから再度お試しください。')
    } finally {
      setDiagnosing(false)
    }
  }

  const downloadResult = () => {
    if (!diagResult) return
    const text = [
      `【AI診断結果】`,
      `科目: ${aiForm.subject}`,
      `推奨レイヤー: ${diagResult.layer} - ${LAYERS[diagResult.layer]}`,
      ``,
      `【判定理由】`,
      diagResult.diagnosis_reason,
      ``,
      `【AI推薦参考書】`,
      ...diagResult.recommended_books.map((b, i) => `${i + 1}. ${b.title}\n   ${b.reason}`),
    ].join('\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `診断結果_${aiForm.subject}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">参考書リコメンダー</h1>

      {/* タブ切り替え */}
      <div className="flex border-b border-gray-200 mb-6">
        {(['ai', 'manual'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'ai' ? 'AIに診断してもらう' : '自分でレベルを指定する'}
          </button>
        ))}
      </div>

      {tab === 'ai' && (
        <form onSubmit={handleDiagnose} className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">科目</label>
              <select
                value={aiForm.subject}
                onChange={e => setAiForm(f => ({ ...f, subject: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">学年</label>
              <select
                value={aiForm.grade}
                onChange={e => setAiForm(f => ({ ...f, grade: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                {GRADES.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
          </div>

          {[
            { key: 'target_department', label: '志望校学部学科', placeholder: '例: 京都大学 理学部 数学系' },
            { key: 'mock_score', label: '現在の模試成績', placeholder: '例: 偏差値65、河合塾全統模試' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type="text"
                value={aiForm[key as keyof typeof aiForm]}
                onChange={e => setAiForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              これまで使用してきた参考書と現在使用している参考書
            </label>
            <textarea
              value={aiForm.books_history}
              onChange={e => setAiForm(f => ({ ...f, books_history: e.target.value }))}
              placeholder={'例: 【完了】システム英単語、NextStage\n【使用中】ポレポレ英文読解'}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">具体的な弱点</label>
            <input
              type="text"
              value={aiForm.weak_points}
              onChange={e => setAiForm(f => ({ ...f, weak_points: e.target.value }))}
              placeholder="例: 確率・場合の数、長文読解のスピード"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">学習スタイルの好み</label>
            <div className="flex flex-col gap-2">
              {[
                { value: '解説重視', label: '解説が丁寧なものが好み' },
                { value: '問題量重視', label: '問題量重視' },
                { value: 'どちらでもよい', label: 'どちらでもよい' },
              ].map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="learning_style"
                    value={value}
                    checked={aiForm.learning_style === value}
                    onChange={() => setAiForm(f => ({ ...f, learning_style: value }))}
                    className="accent-blue-600"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400">入力項目数が多いほうが適切なリコメンドが可能になります</p>

          {diagError && <p className="text-sm text-red-600">{diagError}</p>}

          <button
            type="submit"
            disabled={diagnosing}
            className="w-full bg-blue-600 text-white py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {diagnosing ? 'AI診断中...' : 'AIに診断してもらう'}
          </button>
        </form>
      )}

      {tab === 'manual' && (
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">科目</label>
            <select
              value={manualSubject}
              onChange={e => setManualSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">学習レイヤー</label>
            <div className="space-y-2">
              {Object.entries(LAYERS).map(([k, v]) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="manual-layer"
                    value={k}
                    checked={manualLayer === Number(k)}
                    onChange={() => setManualLayer(Number(k))}
                    className="accent-blue-600"
                  />
                  <span className="text-sm"><strong>{k}.</strong> {v}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI診断結果 */}
      {diagResult && tab === 'ai' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-blue-900">
                推奨レイヤー: {diagResult.layer} — {LAYERS[diagResult.layer]}
              </h2>
              <button
                onClick={downloadResult}
                className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                .txt ダウンロード
              </button>
            </div>
            <p className="text-sm text-blue-800">{diagResult.diagnosis_reason}</p>
          </div>

          {diagResult.recommended_books.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">AI推薦参考書</h2>
              <div className="space-y-3">
                {diagResult.recommended_books.map((book, i) => (
                  <Link
                    key={book.book_id}
                    to={`/books/${book.book_id}`}
                    className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg font-bold text-blue-600 min-w-[1.5rem]">{i + 1}</span>
                      <div>
                        <p className="font-medium text-gray-900">{book.title}</p>
                        <p className="text-sm text-gray-500 mt-1">{book.reason}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <DiagnosisFeedbackForm diagRequest={aiForm} diagResult={diagResult} />
        </div>
      )}

      {/* 手動タブのランキング */}
      {tab === 'manual' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            {manualSubject} / {LAYERS[manualLayer]} ランキング
          </h2>
          {rankingLoading ? (
            <p className="text-gray-500 text-center py-4">読み込み中...</p>
          ) : (
            <RankingList items={ranking as RankingItem[]} />
          )}
        </div>
      )}
    </div>
  )
}
