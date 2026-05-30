import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { diagnose, fetchRanking } from '../lib/api'
import BookCardList from '../components/BookCardList'
import DiagnosisFeedbackForm from '../components/DiagnosisFeedbackForm'
import { SUBJECTS, LAYERS, GRADES, ENGLISH_CATEGORIES, MATH_CATEGORIES, MATH_SUBJECTS, getSubjectCategory } from '../lib/constants'
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
    english_weak_areas: [] as string[],
  })
  const [mockScores, setMockScores] = useState<{ exam: string; deviation: string }[]>([{ exam: '', deviation: '' }])

  const updateMockScore = (i: number, key: 'exam' | 'deviation', value: string) => {
    setMockScores(prev => {
      const next = prev.map((ms, idx) => idx === i ? { ...ms, [key]: value } : ms)
      const scoreText = next.filter(ms => ms.exam || ms.deviation)
        .map(ms => [ms.exam, ms.deviation ? `偏差値${ms.deviation}` : ''].filter(Boolean).join(' '))
        .join(' / ')
      setAiForm(f => ({ ...f, mock_score: scoreText }))
      return next
    })
  }

  const addMockScore = () => setMockScores(prev => [...prev, { exam: '', deviation: '' }])

  const removeMockScore = (i: number) => {
    setMockScores(prev => {
      const next = prev.filter((_, idx) => idx !== i)
      const scoreText = next.filter(ms => ms.exam || ms.deviation)
        .map(ms => [ms.exam, ms.deviation ? `偏差値${ms.deviation}` : ''].filter(Boolean).join(' '))
        .join(' / ')
      setAiForm(f => ({ ...f, mock_score: scoreText }))
      return next
    })
  }

  const [diagnosing, setDiagnosing] = useState(false)
  const [diagResult, setDiagResult] = useState<DiagnoseResponse | null>(saved?.diagResult ?? null)
  const [diagError, setDiagError] = useState<string | null>(null)

  // 手動タブ状態
  const [manualSubject, setManualSubject] = useState(saved?.manualSubject ?? SUBJECTS[0])
  const [manualLayer, setManualLayer] = useState(saved?.manualLayer ?? 1)
  const [manualCategory, setManualCategory] = useState<string>('')

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">志望校学部学科</label>
            <input
              type="text"
              value={aiForm.target_department}
              onChange={e => setAiForm(f => ({ ...f, target_department: e.target.value }))}
              placeholder="例: 京都大学 理学部 数学系"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">現在の模試成績</label>
            <div className="space-y-2">
              {mockScores.map((ms, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={ms.exam}
                    onChange={e => updateMockScore(i, 'exam', e.target.value)}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">模試を選択</option>
                    {['駿台全国模試', '河合全統模試', '進研模試', '東進共通テスト本番レベル模試'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-500 whitespace-nowrap">偏差値</span>
                    <input
                      type="number"
                      min={20}
                      max={100}
                      value={ms.deviation}
                      onChange={e => updateMockScore(i, 'deviation', e.target.value)}
                      placeholder="65"
                      className="w-20 border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  {mockScores.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMockScore(i)}
                      className="text-gray-400 hover:text-red-500 text-lg leading-none"
                    >×</button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addMockScore}
                className="text-sm text-blue-600 hover:text-blue-700"
              >＋ 模試を追加</button>
            </div>
          </div>

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

          {aiForm.subject === '英語' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">英語の弱点分野（複数選択可）</label>
              <div className="flex flex-wrap gap-2">
                {(['文法', '単語', '長文', '解釈', '英作文'] as const).map(area => {
                  const selected = aiForm.english_weak_areas.includes(area)
                  return (
                    <button
                      key={area}
                      type="button"
                      onClick={() => setAiForm(f => ({
                        ...f,
                        english_weak_areas: selected
                          ? f.english_weak_areas.filter(a => a !== area)
                          : [...f.english_weak_areas, area],
                      }))}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        selected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {area}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

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
              onChange={e => { setManualSubject(e.target.value); setManualCategory('') }}
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
          {getSubjectCategory(manualSubject) === 'english' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">伸ばしたい分野（任意）</label>
              <div className="flex flex-wrap gap-2">
                {ENGLISH_CATEGORIES.map(c => (
                  <button key={c} type="button"
                    onClick={() => setManualCategory(prev => prev === c ? '' : c)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      manualCategory === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >{c}</button>
                ))}
              </div>
            </div>
          )}
          {getSubjectCategory(manualSubject) === 'math' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">克服したい苦手（任意）</label>
              <div className="flex flex-wrap gap-2">
                {MATH_CATEGORIES.map(c => (
                  <button key={c} type="button"
                    onClick={() => setManualCategory(prev => prev === c ? '' : c)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      manualCategory === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >{c}</button>
                ))}
              </div>
            </div>
          )}
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

      {/* 手動タブの参考書一覧 */}
      {tab === 'manual' && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-3">
            {manualSubject} / {LAYERS[manualLayer]}
            {manualCategory && ` / ${manualCategory}`}
            {' '}の参考書
          </h2>
          {rankingLoading ? (
            <p className="text-gray-500 text-center py-4">読み込み中...</p>
          ) : (
            <BookCardList
              items={(ranking as RankingItem[]).filter(item => {
                if (!manualCategory) return true
                const cat = getSubjectCategory(manualSubject)
                if (cat === 'english') return item.english_category === manualCategory
                if (cat === 'math') return item.math_category === manualCategory
                return true
              })}
            />
          )}
        </div>
      )}
    </div>
  )
}
