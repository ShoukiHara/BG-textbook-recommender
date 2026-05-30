import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchReviewsFiltered, fetchBooks, fetchInstructors,
  updateReview, deleteReview, adminCreateReviews, createInstructor, updateInstructor, deleteInstructor,
  login, generateAllGuides, fetchAIFeedbackList, fetchAIFeedbackSummary,
} from '../lib/api'
import { LAYERS, SUBJECTS, ENGLISH_CATEGORIES, MATH_CATEGORIES, MATH_SUBJECTS, SCIENCE_CATEGORIES, SCIENCE_SUBJECTS } from '../lib/constants'

const currentYear = new Date().getFullYear()
const ENROLLMENT_YEARS = [
  String(currentYear + 1),
  ...Array.from({ length: 10 }, (_, i) => String(currentYear - i)),
  '既卒',
]
import StarRating from '../components/StarRating'
import type { Review, Book, Instructor, AIDiagnosisFeedbackOut, FeedbackSummaryItem } from '../lib/api'

// ----------------------------------------------------------------
// 型
// ----------------------------------------------------------------

type EditFields = {
  period: string; before_connection: string; after_connection: string; usage_feel: string
  explanation_quality: string; problem_volume: string; target_deviation: string
  completion_period: string; self_study_suitability: string; strengthens_weaknesses: string
  english_category: string; math_category: string; science_category: string
}

const EMPTY_EDIT_FIELDS: EditFields = {
  period: '', before_connection: '', after_connection: '', usage_feel: '',
  explanation_quality: '', problem_volume: '', target_deviation: '',
  completion_period: '', self_study_suitability: '', strengthens_weaknesses: '',
  english_category: '', math_category: '', science_category: '',
}

const SELECT_OPTIONS = [
  { key: 'explanation_quality', label: '解説の充実度', options: ['丁寧', '標準', 'シンプル'] },
  { key: 'problem_volume',      label: '問題量',       options: ['多い', '標準', '少ない'] },
  { key: 'target_deviation',    label: '対象偏差値帯（駿台模試準拠）', options: ['〜50', '50〜60', '60〜65', '65〜70', '70〜'] },
  { key: 'completion_period',   label: '完了期間',     options: ['2週間', '1ヶ月', '2〜3ヶ月', '3ヶ月以上'] },
] as const

const TEXT_FIELDS = [
  { key: 'period',            label: '① 使用時期・期間' },
  { key: 'before_connection', label: '② 前の参考書との接続' },
  { key: 'after_connection',  label: '③ 後の参考書との接続' },
  { key: 'usage_feel',        label: '④ 使用感' },
] as const

// ----------------------------------------------------------------
// ReviewEditForm — レビュー編集フォーム
// ----------------------------------------------------------------

function ReviewEditForm({
  reviewId, subject, layerRatings, fields, saveError,
  onLayerToggle, onRatingChange, onFieldChange, onSave, onCancel,
}: {
  reviewId: string
  subject: string
  layerRatings: Record<number, number>
  onLayerToggle: (layer: number, checked: boolean) => void
  onRatingChange: (layer: number, rating: number) => void
  onFieldChange: (key: keyof EditFields, value: string) => void
  fields: EditFields
  saveError: string | null
  onSave: () => void; onCancel: () => void
}) {
  const toggleCategory = (
    current: string,
    value: string,
    fieldKey: keyof EditFields,
  ) => {
    const list = current ? current.split(',') : []
    const next = list.includes(value)
      ? list.filter(v => v !== value)
      : list.length < 2 ? [...list, value] : list
    onFieldChange(fieldKey, next.join(','))
  }

  const englishCats = fields.english_category ? fields.english_category.split(',') : []
  const mathCats = fields.math_category ? fields.math_category.split(',') : []
  const scienceCats = fields.science_category ? fields.science_category.split(',') : []

  return (
    <div className="space-y-4">
      {/* レイヤー + 評価（複数選択可） */}
      <div>
        <label className="block text-xs text-gray-600 mb-2">対象レイヤー（複数選択可）</label>
        <div className="space-y-2">
          {Object.entries(LAYERS).map(([k, v]) => {
            const l = Number(k)
            const checked = l in layerRatings
            return (
              <div key={k} className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer min-w-[240px]">
                  <input type="checkbox" checked={checked}
                    onChange={e => onLayerToggle(l, e.target.checked)}
                    className="accent-blue-600 w-4 h-4"
                  />
                  <span className="text-sm">{k}: {v}</span>
                </label>
                {checked && (
                  <StarRating value={layerRatings[l]} onChange={r => onRatingChange(l, r)} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 伸ばせる分野 */}
      {subject === '英語' && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">伸ばせる分野<span className="text-xs text-gray-400 ml-1">（2つまで）</span></label>
          <div className="flex flex-wrap gap-2">
            {ENGLISH_CATEGORIES.map(c => (
              <button key={c} type="button"
                onClick={() => toggleCategory(fields.english_category, c, 'english_category')}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  englishCats.includes(c) ? 'bg-blue-600 text-white border-blue-600'
                  : englishCats.length >= 2 ? 'bg-white text-gray-300 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >{c}</button>
            ))}
          </div>
        </div>
      )}
      {(MATH_SUBJECTS as readonly string[]).includes(subject) && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">伸ばせる分野<span className="text-xs text-gray-400 ml-1">（2つまで）</span></label>
          <div className="flex flex-wrap gap-2">
            {MATH_CATEGORIES.map(c => (
              <button key={c} type="button"
                onClick={() => toggleCategory(fields.math_category, c, 'math_category')}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  mathCats.includes(c) ? 'bg-blue-600 text-white border-blue-600'
                  : mathCats.length >= 2 ? 'bg-white text-gray-300 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >{c}</button>
            ))}
          </div>
        </div>
      )}
      {(SCIENCE_SUBJECTS as readonly string[]).includes(subject) && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">伸ばせる分野<span className="text-xs text-gray-400 ml-1">（2つまで）</span></label>
          <div className="flex flex-wrap gap-2">
            {SCIENCE_CATEGORIES.map(c => (
              <button key={c} type="button"
                onClick={() => toggleCategory(fields.science_category, c, 'science_category')}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  scienceCats.includes(c) ? 'bg-blue-600 text-white border-blue-600'
                  : scienceCats.length >= 2 ? 'bg-white text-gray-300 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >{c}</button>
            ))}
          </div>
        </div>
      )}

      {/* 参考書の特徴（選択式） */}
      <div className="grid grid-cols-2 gap-3">
        {SELECT_OPTIONS.map(({ key, label, options }) => (
          <div key={key}>
            <label className="block text-xs text-gray-500 mb-1">{label}</label>
            <select
              value={fields[key as keyof EditFields]}
              onChange={e => onFieldChange(key as keyof EditFields, e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="">未入力</option>
              {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">独学適性</label>
        <div className="flex gap-4">
          {['独学向き', '授業との併用推奨'].map(v => (
            <label key={v} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="radio" name={`self_study_${reviewId}`} value={v}
                checked={fields.self_study_suitability === v}
                onChange={() => onFieldChange('self_study_suitability', v)}
                className="accent-blue-600"
              />
              {v}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">強化できる弱点・スキル</label>
        <input type="text"
          value={fields.strengthens_weaknesses}
          onChange={e => onFieldChange('strengthens_weaknesses', e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
        />
      </div>

      {TEXT_FIELDS.map(({ key, label }) => (
        <div key={key}>
          <label className="block text-xs text-gray-500 mb-1">{label}</label>
          <textarea
            value={fields[key]}
            onChange={e => onFieldChange(key, e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm resize-none"
          />
        </div>
      ))}

      {saveError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{saveError}</p>
      )}

      <div className="flex gap-2">
        <button onClick={onSave} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">保存</button>
        <button onClick={onCancel} className="text-sm border px-3 py-1.5 rounded">キャンセル</button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// ReviewCard — レビュー表示カード（読み取り専用）
// ----------------------------------------------------------------

function ReviewCard({ review, onEdit, onDelete }: {
  review: Review; onEdit: () => void; onDelete: () => void
}) {
  const chips = [
    review.explanation_quality && `解説: ${review.explanation_quality}`,
    review.problem_volume && `問題量: ${review.problem_volume}`,
    review.target_deviation && `偏差値: ${review.target_deviation}`,
    review.completion_period && review.completion_period,
    review.self_study_suitability && review.self_study_suitability,
  ].filter(Boolean)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{review.instructor_name}</span>
          {review.book_title && (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{review.book_title}</span>
          )}
          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{LAYERS[review.layer]}</span>
          <StarRating value={review.rating} readOnly />
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="text-xs text-blue-600 hover:underline">編集</button>
          <button onClick={onDelete} className="text-xs text-red-600 hover:underline">削除</button>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {chips.map(chip => (
            <span key={chip} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{chip}</span>
          ))}
        </div>
      )}

      {review.strengthens_weaknesses && (
        <p className="text-xs text-gray-600 mb-1">強化できる弱点: {review.strengthens_weaknesses}</p>
      )}

      {[
        { label: '使用時期', value: review.period },
        { label: '前の参考書', value: review.before_connection },
        { label: '後の参考書', value: review.after_connection },
        { label: '使用感', value: review.usage_feel },
      ].filter(f => f.value).map(({ label, value }) => (
        <p key={label} className="text-xs text-gray-600">
          <span className="font-medium text-gray-500">{label}: </span>{value}
        </p>
      ))}
    </div>
  )
}

// ----------------------------------------------------------------
// ReviewManager — レビュー管理セクション
// ----------------------------------------------------------------

function ReviewManager({ token }: { token: string }) {
  const qc = useQueryClient()
  const { data: books = [] } = useQuery({
    queryKey: ['books'], queryFn: () => fetchBooks(), staleTime: 5 * 60 * 1000,
  })
  const { data: instructors = [] } = useQuery({
    queryKey: ['instructors'], queryFn: fetchInstructors, staleTime: 5 * 60 * 1000,
  })

  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedBookId, setSelectedBookId] = useState('')
  const [selectedInstructorId, setSelectedInstructorId] = useState('')

  const filteredBooks = selectedSubject
    ? (books as Book[]).filter(b => b.subject === selectedSubject)
    : (books as Book[])

  const enabled = !!selectedBookId || !!selectedInstructorId
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews-filtered', selectedBookId, selectedInstructorId],
    queryFn: () => fetchReviewsFiltered(
      { book_id: selectedBookId || undefined, instructor_id: selectedInstructorId || undefined },
      token,
    ),
    enabled,
    staleTime: 0,
  })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLayerRatings, setEditLayerRatings] = useState<Record<number, number>>({})
  const [editFields, setEditFields] = useState<EditFields>(EMPTY_EDIT_FIELDS)
  const [saveError, setSaveError] = useState<string | null>(null)

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteReview(id, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews-filtered'] }),
  })

  const startEdit = (r: Review) => {
    setEditingId(r.id)
    setSaveError(null)
    setEditLayerRatings({ [r.layer]: r.rating })
    setEditFields({
      period: r.period, before_connection: r.before_connection,
      after_connection: r.after_connection, usage_feel: r.usage_feel,
      explanation_quality: r.explanation_quality, problem_volume: r.problem_volume,
      target_deviation: r.target_deviation, completion_period: r.completion_period,
      self_study_suitability: r.self_study_suitability, strengthens_weaknesses: r.strengthens_weaknesses,
      english_category: r.english_category, math_category: r.math_category, science_category: r.science_category,
    })
  }

  const handleSave = async (r: Review) => {
    const entries = Object.entries(editLayerRatings)
    if (entries.length === 0) return
    setSaveError(null)
    try {
      const originalEntry = entries.find(([l]) => Number(l) === r.layer)
      const [primaryLayer, primaryRating] = originalEntry ?? entries[0]
      const additionalEntries = entries.filter(([l]) => Number(l) !== Number(primaryLayer))

      await updateReview(r.id, {
        layer: Number(primaryLayer),
        rating: Number(primaryRating),
        ...editFields,
      }, token)

      if (additionalEntries.length > 0) {
        await adminCreateReviews({
          book_id: r.book_id,
          instructor_id: r.instructor_id,
          layer_ratings: additionalEntries.map(([l, rt]) => ({ layer: Number(l), rating: Number(rt) })),
          ...editFields,
        }, token)
      }

      await qc.invalidateQueries({ queryKey: ['reviews-filtered'] })
      setEditingId(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setSaveError(`保存エラー: ${msg}`)
      await qc.invalidateQueries({ queryKey: ['reviews-filtered'] })
    }
  }

  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">レビュー管理</h2>
      <div className="mb-4 flex flex-wrap gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">科目</label>
          <select
            value={selectedSubject}
            onChange={e => { setSelectedSubject(e.target.value); setSelectedBookId(''); setEditingId(null) }}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-36"
          >
            <option value="">すべて</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">参考書</label>
          <select
            value={selectedBookId}
            onChange={e => { setSelectedBookId(e.target.value); setEditingId(null) }}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-64"
          >
            <option value="">すべて</option>
            {filteredBooks.map(b => (
              <option key={b.id} value={b.id}>
                {b.title}{!selectedSubject ? `（${b.subject}）` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">講師</label>
          <select
            value={selectedInstructorId}
            onChange={e => { setSelectedInstructorId(e.target.value); setEditingId(null) }}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-48"
          >
            <option value="">すべて</option>
            {(instructors as Instructor[]).map(i => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>
        {(selectedSubject || selectedBookId || selectedInstructorId) && (
          <div className="flex items-end">
            <button
              onClick={() => { setSelectedSubject(''); setSelectedBookId(''); setSelectedInstructorId(''); setEditingId(null) }}
              className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2 py-1.5"
            >クリア</button>
          </div>
        )}
      </div>

      {isLoading && <p className="text-gray-500 text-sm">読み込み中...</p>}
      {reviews.length > 0 && (
        <div className="space-y-3">
          {(reviews as Review[]).map(r => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-4">
              {editingId === r.id ? (
                <ReviewEditForm
                  reviewId={r.id}
                  subject={r.subject}
                  layerRatings={editLayerRatings}
                  fields={editFields}
                  saveError={saveError}
                  onLayerToggle={(layer, checked) =>
                    setEditLayerRatings(prev => {
                      const next = { ...prev }
                      if (checked) next[layer] = 0
                      else delete next[layer]
                      return next
                    })
                  }
                  onRatingChange={(layer, rating) =>
                    setEditLayerRatings(prev => ({ ...prev, [layer]: rating }))
                  }
                  onFieldChange={(key, value) => setEditFields(f => ({ ...f, [key]: value }))}
                  onSave={() => handleSave(r)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <ReviewCard
                  review={r}
                  onEdit={() => startEdit(r)}
                  onDelete={() => { if (confirm('削除しますか？')) deleteMut.mutate(r.id) }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ----------------------------------------------------------------
// AIGuideManager — AIガイド一括生成セクション
// ----------------------------------------------------------------

function AIGuideManager({ token }: { token: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    setResult(null)
    try {
      const { queued } = await generateAllGuides(token)
      setResult(queued > 0
        ? `${queued}冊のAIガイドをバックグラウンドで生成中です。`
        : 'すべての参考書にAIガイドが生成済みです。')
    } catch {
      setResult('エラーが発生しました。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-gray-800 mb-2">AIガイド管理</h2>
      <p className="text-sm text-gray-500 mb-3">レビューがあるがAIガイド未生成の参考書をまとめて生成します。生成はバックグラウンドで行われます。</p>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? '処理中...' : 'AIガイドを一括生成'}
      </button>
      {result && <p className="mt-2 text-sm text-gray-600">{result}</p>}
    </section>
  )
}

// ----------------------------------------------------------------
// InstructorManager — 講師マスタ管理セクション
// ----------------------------------------------------------------

function InstructorManager({ token }: { token: string }) {
  const qc = useQueryClient()
  const { data: instructors = [] } = useQuery({
    queryKey: ['instructors'], queryFn: fetchInstructors, staleTime: 5 * 60 * 1000,
  })

  const [name, setName] = useState('')
  const [newYear, setNewYear] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editYear, setEditYear] = useState('')

  const createMut = useMutation({
    mutationFn: ({ n, y }: { n: string; y: string }) => createInstructor(n, token, y),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['instructors'] }); setName(''); setNewYear('') },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, enrollment_year }: { id: string; enrollment_year: string }) => updateInstructor(id, enrollment_year, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['instructors'] }); setEditingId(null) },
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteInstructor(id, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instructors'] }),
  })

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">講師マスタ管理</h2>
      <form
        onSubmit={e => { e.preventDefault(); if (name.trim()) createMut.mutate({ n: name.trim(), y: newYear }) }}
        className="flex gap-2 mb-4 flex-wrap"
      >
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="講師名を入力"
          className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1 max-w-xs"
        />
        <select
          value={newYear}
          onChange={e => setNewYear(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">入学年度未設定</option>
          {ENROLLMENT_YEARS.map(y => <option key={y} value={y}>{y === '既卒' ? '既卒' : `${y}年度入学`}</option>)}
        </select>
        <button
          type="submit" disabled={createMut.isPending}
          className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
        >
          追加
        </button>
      </form>

      <div className="space-y-2">
        {(instructors as Instructor[]).map(ins => (
          <div key={ins.id} className="bg-white border border-gray-200 rounded-md px-4 py-2">
            {editingId === ins.id ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-800 font-medium">{ins.name}</span>
                <select
                  value={editYear}
                  onChange={e => setEditYear(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">入学年度未設定</option>
                  {ENROLLMENT_YEARS.map(y => <option key={y} value={y}>{y === '既卒' ? '既卒' : `${y}年度入学`}</option>)}
                </select>
                <button
                  onClick={() => updateMut.mutate({ id: ins.id, enrollment_year: editYear })}
                  disabled={updateMut.isPending}
                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                >保存</button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-xs border px-3 py-1 rounded"
                >キャンセル</button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-sm ${ins.enrollment_year === '既卒' ? 'text-gray-400' : 'text-gray-800'}`}>{ins.name}</span>
                  {ins.enrollment_year
                    ? <span className={`text-xs px-2 py-0.5 rounded ${ins.enrollment_year === '既卒' ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-700'}`}>
                        {ins.enrollment_year === '既卒' ? '既卒' : `${ins.enrollment_year}年度入学`}
                      </span>
                    : <span className="text-xs text-gray-300">未設定</span>
                  }
                  <span className="text-xs text-gray-400">{ins.review_count}件</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setEditingId(ins.id); setEditYear(ins.enrollment_year) }}
                    className="text-xs text-blue-600 hover:underline"
                  >入学年度編集</button>
                  <button
                    onClick={() => {
                      if (confirm(`「${ins.name}」を削除しますか？\nこの講師のレビューは匿名になります。`))
                        deleteMut.mutate(ins.id)
                    }}
                    className="text-xs text-red-600 hover:underline"
                  >削除</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

// ----------------------------------------------------------------
// FeedbackViewer — AI診断フィードバック閲覧セクション
// ----------------------------------------------------------------

const SCORE_COLOR = (score: number) => {
  if (score >= 8) return 'bg-green-100 text-green-800'
  if (score >= 5) return 'text-yellow-800 bg-yellow-100'
  return 'bg-red-100 text-red-800'
}

function FeedbackCard({ fb }: { fb: AIDiagnosisFeedbackOut }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-bold px-2 py-0.5 rounded ${SCORE_COLOR(fb.score)}`}>
            {fb.score}/10
          </span>
          <span className="text-sm font-medium text-gray-800">{fb.subject}</span>
          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
            レイヤー{fb.diagnosed_layer}：{LAYERS[fb.diagnosed_layer]}
          </span>
          <span className="text-xs text-gray-400">
            {fb.grade} / {new Date(fb.created_at).toLocaleDateString('ja-JP')}
          </span>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="text-xs text-blue-600 hover:underline shrink-0"
        >
          {open ? '閉じる' : '詳細'}
        </button>
      </div>

      {fb.feedback_comment && (
        <p className="mt-2 text-sm text-gray-700 border-l-2 border-blue-300 pl-3">
          {fb.feedback_comment}
        </p>
      )}

      {open && (
        <div className="mt-3 space-y-2 text-xs text-gray-600 border-t pt-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {[
              ['志望校学部', fb.target_department],
              ['模試成績', fb.mock_score],
              ['学習スタイル', fb.learning_style],
              ['弱点', fb.weak_points],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label}>
                <span className="font-medium text-gray-500">{label}: </span>{value}
              </div>
            ))}
          </div>
          {fb.books_history && (
            <div>
              <span className="font-medium text-gray-500">使用参考書: </span>
              <span className="whitespace-pre-wrap">{fb.books_history}</span>
            </div>
          )}
          <div>
            <p className="font-medium text-gray-500 mb-1">AI判定理由:</p>
            <p className="whitespace-pre-wrap">{fb.diagnosis_reason}</p>
          </div>
          {fb.recommended_books.length > 0 && (
            <div>
              <p className="font-medium text-gray-500 mb-1">AI推薦参考書:</p>
              <ol className="list-decimal list-inside space-y-1">
                {fb.recommended_books.map(b => (
                  <li key={b.book_id}><span className="font-medium">{b.title}</span> — {b.reason}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FeedbackViewer({ token }: { token: string }) {
  const [subject, setSubject] = useState('')
  const [scoreFilter, setScoreFilter] = useState<'all' | 'low' | 'high'>('all')

  const scoreParams = scoreFilter === 'low'
    ? { max_score: 4 }
    : scoreFilter === 'high'
    ? { min_score: 8 }
    : {}

  const { data: summary = [] } = useQuery({
    queryKey: ['feedback-summary'],
    queryFn: () => fetchAIFeedbackSummary(token),
    staleTime: 2 * 60 * 1000,
  })

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['feedback-list', subject, scoreFilter],
    queryFn: () => fetchAIFeedbackList({ subject: subject || undefined, ...scoreParams }, token),
    staleTime: 0,
  })

  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">AI診断フィードバック</h2>

      {/* 集計サマリー */}
      {(summary as FeedbackSummaryItem[]).length > 0 && (
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">科目×レイヤー別 平均スコア</p>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse w-full max-w-xl">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-3 py-1.5 text-left">科目</th>
                  <th className="border border-gray-200 px-3 py-1.5 text-center">レイヤー</th>
                  <th className="border border-gray-200 px-3 py-1.5 text-center">平均スコア</th>
                  <th className="border border-gray-200 px-3 py-1.5 text-center">件数</th>
                </tr>
              </thead>
              <tbody>
                {(summary as FeedbackSummaryItem[]).map(row => (
                  <tr key={`${row.subject}-${row.diagnosed_layer}`} className="hover:bg-gray-50">
                    <td className="border border-gray-200 px-3 py-1.5">{row.subject}</td>
                    <td className="border border-gray-200 px-3 py-1.5 text-center">{row.diagnosed_layer}</td>
                    <td className={`border border-gray-200 px-3 py-1.5 text-center font-medium ${
                      row.avg_score >= 8 ? 'text-green-700' : row.avg_score >= 5 ? 'text-yellow-700' : 'text-red-700'
                    }`}>
                      {row.avg_score}
                    </td>
                    <td className="border border-gray-200 px-3 py-1.5 text-center text-gray-500">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* フィルタ */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">科目</label>
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
          <label className="block text-xs text-gray-500 mb-1">スコア</label>
          <select
            value={scoreFilter}
            onChange={e => setScoreFilter(e.target.value as typeof scoreFilter)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="all">すべて</option>
            <option value="low">低評価（4点以下）</option>
            <option value="high">高評価（8点以上）</option>
          </select>
        </div>
      </div>

      {/* 個票一覧 */}
      {isLoading ? (
        <p className="text-gray-500 text-sm">読み込み中...</p>
      ) : list.length === 0 ? (
        <p className="text-gray-400 text-sm">フィードバックがありません。</p>
      ) : (
        <div className="space-y-3">
          {(list as AIDiagnosisFeedbackOut[]).map(fb => (
            <FeedbackCard key={fb.id} fb={fb} />
          ))}
        </div>
      )}
    </section>
  )
}

// ----------------------------------------------------------------
// AdminDashboard / AdminPanel — エントリーポイント
// ----------------------------------------------------------------

function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">管理者パネル</h1>
        <button onClick={onLogout} className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-1.5 rounded">
          ログアウト
        </button>
      </div>
      <FeedbackViewer token={token} />
      <ReviewManager token={token} />
      <AIGuideManager token={token} />
      <InstructorManager token={token} />
    </div>
  )
}

export default function AdminPanel() {
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const data = await login(password)
      setToken(data.access_token)
      setPassword('')
    } catch {
      setError('パスワードが正しくありません')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="max-w-sm mx-auto py-16 px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">管理者ログイン</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="パスワード"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-gray-900 text-white py-2 rounded-md font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    )
  }

  return <AdminDashboard token={token} onLogout={() => setToken(null)} />
}
