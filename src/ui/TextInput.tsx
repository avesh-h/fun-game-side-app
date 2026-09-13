import { useId } from 'react'

interface TextInputProps {
  readonly label: string
  readonly value: string
  readonly onChange: (next: string) => void
  readonly placeholder?: string
  readonly error?: string | null
  /** Red border without a message — for rows that show one error underneath. */
  readonly invalid?: boolean
  readonly maxLength?: number
  /** Hides the label visually but keeps it for screen readers. */
  readonly labelHidden?: boolean
  readonly autoFocus?: boolean
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  error,
  invalid = false,
  maxLength = 24,
  labelHidden = false,
  autoFocus,
}: TextInputProps) {
  const id = useId()

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label
        htmlFor={id}
        className={
          labelHidden
            ? 'sr-only'
            : 'text-xs font-medium uppercase tracking-wider text-faint'
        }
      >
        {label}
      </label>

      <input
        id={id}
        type="text"
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-invalid={error || invalid ? true : undefined}
        onChange={(e) => onChange(e.currentTarget.value)}
        className={[
          'min-h-12 w-full rounded-lg border bg-raised px-3 text-ink',
          'placeholder:text-faint',
          error || invalid ? 'border-bad' : 'border-line',
        ].join(' ')}
      />

      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  )
}
