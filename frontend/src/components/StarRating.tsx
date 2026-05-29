interface Props {
  value: number
  onChange?: (v: number) => void
  max?: number
  readOnly?: boolean
}

export default function StarRating({ value, onChange, max = 5, readOnly = false }: Props) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => i + 1).map(star => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          className={`text-2xl leading-none transition-colors ${
            readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
          } ${star <= value ? 'text-yellow-400' : 'text-gray-300'}`}
          aria-label={`${star}点`}
        >
          ★
        </button>
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange?.(0)}
          className="ml-1 text-xs text-gray-400 hover:text-gray-600 self-center"
        >
          クリア
        </button>
      )}
    </div>
  )
}
