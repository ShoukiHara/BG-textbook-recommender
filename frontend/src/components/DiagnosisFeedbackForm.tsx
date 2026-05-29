import { useState } from 'react'
import { submitAIFeedback } from '../lib/api'
import type { DiagnoseRequest, DiagnoseResponse } from '../lib/api'

interface Props {
  diagRequest: DiagnoseRequest
  diagResult: DiagnoseResponse
}

export default function DiagnosisFeedbackForm({ diagRequest, diagResult }: Props) {
  const [score, setScore] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (score === null) return
    setStatus('submitting')
    try {
      await submitAIFeedback({
        ...diagRequest,
        diagnosed_layer: diagResult.layer,
        diagnosis_reason: diagResult.diagnosis_reason,
        recommended_books: diagResult.recommended_books,
        score,
        feedback_comment: comment,
      })
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
        フィードバックを送信しました。ありがとうございます。
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
      <p className="text-sm font-medium text-gray-700">この診断結果はどのくらい役に立ちましたか？（1〜10点）</p>

      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setScore(n)}
            className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${
              score === n
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:border-blue-400'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {score !== null && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            理由・コメント（任意）
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={
              score >= 7
                ? '例: 今のレベルに合った参考書を選んでもらえた'
                : '例: 推薦された参考書が難しすぎた、レイヤー判定がズレていた'
            }
            rows={2}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
          />
        </div>
      )}

      {status === 'error' && (
        <p className="text-sm text-red-600">送信に失敗しました。もう一度お試しください。</p>
      )}

      <button
        type="submit"
        disabled={score === null || status === 'submitting'}
        className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-40 transition-colors"
      >
        {status === 'submitting' ? '送信中...' : 'フィードバックを送る'}
      </button>
    </form>
  )
}
