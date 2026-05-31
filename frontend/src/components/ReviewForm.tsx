import { useState } from 'react'
import StarRating from './StarRating'
import { LAYERS, ENGLISH_CATEGORIES, MATH_CATEGORIES, MATH_SUBJECTS, SCIENCE_CATEGORIES, SCIENCE_SUBJECTS } from '../lib/constants'
import type { Instructor } from '../lib/api'

interface Props {
  bookId: string
  subject?: string
  instructors: Instructor[]
  onSubmit: (data: {
    instructor_id: string
    layer_ratings: Array<{ layer: number; rating: number }>
    period: string
    before_connection: string
    after_connection: string
    usage_feel: string
    explanation_quality: string
    problem_volume: string
    strengthens_weaknesses: string
    target_deviation: string
    completion_period: string
    self_study_suitability: string
    english_category: string
    math_category: string
    science_category: string
  }) => Promise<void>
}

const TEXT_FIELDS = [
  { key: 'period',            label: '① 使用していた時期と期間',        placeholder: '例：高3の4月〜7月（3ヶ月）' },
  { key: 'before_connection', label: '② この参考書の前に使っていた参考書との接続', placeholder: '例：〇〇を終えてから取り組んだ。スムーズに移行できた。' },
  { key: 'after_connection',  label: '③ この参考書の後に使っていた参考書との接続', placeholder: '例：△△につなげた。レベル差が大きく少し苦労した。' },
  { key: 'usage_feel',        label: '④ 使用感',                      placeholder: '例：問題量が多く演習向き。' },
] as const

type TextKey = typeof TEXT_FIELDS[number]['key']

type SelectField = { key: string; label: string; options: string[] }

const SELECT_FIELDS: SelectField[] = [
  { key: 'explanation_quality',    label: '解説の充実度',        options: ['丁寧', '標準', 'シンプル'] },
  { key: 'problem_volume',         label: '問題量',              options: ['多い', '標準', '少ない'] },
  { key: 'completion_period',      label: '完了にかかる標準期間', options: ['2週間', '1ヶ月', '2〜3ヶ月', '3ヶ月以上'] },
]

const DEVIATION_OPTIONS = ['〜50', '50〜60', '60〜65', '65〜70', '70〜'] as const

export default function ReviewForm({ instructors, subject, onSubmit }: Props) {
  const [instructorId, setInstructorId] = useState('')

  // layer -> rating (layerが選択されていない場合はキーが存在しない)
  const [layerRatings, setLayerRatings] = useState<Record<number, number>>({})

  const [textFields, setTextFields] = useState<Record<TextKey, string>>({
    period: '', before_connection: '', after_connection: '', usage_feel: '',
  })
  const [selectFields, setSelectFields] = useState<Record<string, string>>({
    explanation_quality: '', problem_volume: '', completion_period: '',
  })
  const [targetDeviations, setTargetDeviations] = useState<string[]>([])
  const [selfStudy, setSelfStudy] = useState('')
  const [strengthens, setStrengthens] = useState('')
  const [englishCategories, setEnglishCategories] = useState<string[]>([])
  const [mathCategories, setMathCategories] = useState<string[]>([])
  const [scienceCategories, setScienceCategories] = useState<string[]>([])

  const toggleCategory = (
    list: string[],
    setList: (v: string[]) => void,
    value: string,
  ) => {
    if (list.includes(value)) {
      setList(list.filter(v => v !== value))
    } else if (list.length < 2) {
      setList([...list, value])
    }
  }

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleLayer = (layer: number, checked: boolean) => {
    setLayerRatings(prev => {
      const next = { ...prev }
      if (checked) next[layer] = 0
      else delete next[layer]
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!instructorId) { setError('講師を選択してください'); return }
    const selectedLayers = Object.keys(layerRatings)
    if (selectedLayers.length === 0) { setError('対象レイヤーを1つ以上選択してください'); return }
    if (selectedLayers.some(l => layerRatings[Number(l)] === 0)) {
      setError('選択したレイヤーすべてに評価を入力してください'); return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        instructor_id: instructorId,
        layer_ratings: Object.entries(layerRatings).map(([l, r]) => ({ layer: Number(l), rating: r })),
        period: textFields.period,
        before_connection: textFields.before_connection,
        after_connection: textFields.after_connection,
        usage_feel: textFields.usage_feel,
        explanation_quality: selectFields.explanation_quality,
        problem_volume: selectFields.problem_volume,
        target_deviation: targetDeviations.join(','),
        completion_period: selectFields.completion_period,
        strengthens_weaknesses: strengthens,
        self_study_suitability: selfStudy,
        english_category: englishCategories.join(','),
        math_category: mathCategories.join(','),
        science_category: scienceCategories.join(','),
      })
      setSuccess(true)
      setLayerRatings({})
      setTextFields({ period: '', before_connection: '', after_connection: '', usage_feel: '' })
      setSelectFields({ explanation_quality: '', problem_volume: '', completion_period: '' })
      setTargetDeviations([])
      setSelfStudy('')
      setStrengthens('')
      setEnglishCategories([])
      setMathCategories([])
      setScienceCategories([])
    } catch {
      setError('投稿に失敗しました。再度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <p className="text-green-700 font-semibold">投稿しました！</p>
        <button onClick={() => setSuccess(false)} className="mt-2 text-sm text-green-600 underline">
          続けて投稿する
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* 講師 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">講師</label>
        <select
          value={instructorId}
          onChange={e => setInstructorId(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- 選択してください --</option>
          {instructors.map(i => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
      </div>

      {/* 対象レイヤー + 評価 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">対象レイヤー（複数選択可）</label>
        <div className="space-y-2">
          {Object.entries(LAYERS).map(([k, v]) => {
            const layer = Number(k)
            const checked = layer in layerRatings
            return (
              <div key={k} className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer min-w-[240px]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => toggleLayer(layer, e.target.checked)}
                    className="accent-blue-600 w-4 h-4"
                  />
                  <span className="text-sm">{k}: {v}</span>
                </label>
                {checked && (
                  <StarRating
                    value={layerRatings[layer]}
                    onChange={r => setLayerRatings(prev => ({ ...prev, [layer]: r }))}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 英語カテゴリ（英語のみ） */}
      {subject === '英語' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">伸ばせる分野<span className="text-xs text-gray-400 ml-1">（2つまで）</span></label>
          <div className="flex flex-wrap gap-2">
            {ENGLISH_CATEGORIES.map(c => (
              <button key={c} type="button"
                onClick={() => toggleCategory(englishCategories, setEnglishCategories, c)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  englishCategories.includes(c) ? 'bg-blue-600 text-white border-blue-600'
                  : englishCategories.length >= 2 ? 'bg-white text-gray-300 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >{c}</button>
            ))}
          </div>
        </div>
      )}

      {/* 数学カテゴリ（数学のみ） */}
      {subject && (MATH_SUBJECTS as readonly string[]).includes(subject) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">伸ばせる分野<span className="text-xs text-gray-400 ml-1">（2つまで）</span></label>
          <div className="flex flex-wrap gap-2">
            {MATH_CATEGORIES.map(c => (
              <button key={c} type="button"
                onClick={() => toggleCategory(mathCategories, setMathCategories, c)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  mathCategories.includes(c) ? 'bg-blue-600 text-white border-blue-600'
                  : mathCategories.length >= 2 ? 'bg-white text-gray-300 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >{c}</button>
            ))}
          </div>
        </div>
      )}

      {/* 理科カテゴリ（理科のみ） */}
      {subject && (SCIENCE_SUBJECTS as readonly string[]).includes(subject) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">伸ばせる分野<span className="text-xs text-gray-400 ml-1">（2つまで）</span></label>
          <div className="flex flex-wrap gap-2">
            {SCIENCE_CATEGORIES.map(c => (
              <button key={c} type="button"
                onClick={() => toggleCategory(scienceCategories, setScienceCategories, c)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  scienceCategories.includes(c) ? 'bg-blue-600 text-white border-blue-600'
                  : scienceCategories.length >= 2 ? 'bg-white text-gray-300 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >{c}</button>
            ))}
          </div>
        </div>
      )}

      {/* 参考書の特徴（選択式） */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">参考書の特徴</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {SELECT_FIELDS.map(({ key, label, options }) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">{label}</label>
              <select
                value={selectFields[key]}
                onChange={e => setSelectFields(f => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">未入力</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">
            対象偏差値帯（駿台模試準拠）<span className="text-xs text-gray-400 ml-1">（2つまで）</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {DEVIATION_OPTIONS.map(v => (
              <button key={v} type="button"
                onClick={() => toggleCategory(targetDeviations, setTargetDeviations, v)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  targetDeviations.includes(v) ? 'bg-blue-600 text-white border-blue-600'
                  : targetDeviations.length >= 2 ? 'bg-white text-gray-300 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >{v}</button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs text-gray-500 mb-1">独学適性</label>
          <div className="flex gap-4">
            {['独学向き', '授業との併用推奨'].map(v => (
              <label key={v} className="flex items-center gap-1.5 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="self_study"
                  value={v}
                  checked={selfStudy === v}
                  onChange={() => setSelfStudy(v)}
                  className="accent-blue-600"
                />
                {v}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs text-gray-500 mb-1">強化できる弱点・スキル</label>
          <input
            type="text"
            value={strengthens}
            onChange={e => setStrengthens(e.target.value)}
            placeholder="例：確率・場合の数、英文読解スピード"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 接続・使用感（テキスト） */}
      <div className="space-y-3">
        {TEXT_FIELDS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <textarea
              value={textFields[key]}
              onChange={e => setTextFields(f => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-600 text-white py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {submitting ? '投稿中...' : 'レビューを投稿'}
      </button>
    </form>
  )
}
