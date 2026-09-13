import { useId, type ReactNode } from 'react'

interface NumberInputProps {
  readonly label: string
  readonly value: string
  readonly onChange: (next: string) => void
  readonly hint?: ReactNode
  readonly error?: string | null
  /** Red border without a message — for rows that show one error underneath. */
  readonly invalid?: boolean
  readonly placeholder?: string
  readonly disabled?: boolean
  readonly autoFocus?: boolean
  /** Hides the label visually but keeps it for screen readers. */
  readonly labelHidden?: boolean
}

/**
 * Whole-number field, used for every amount in the app.
 *
 * Digits only — a decimal point cannot be typed, because money here is always
 * an integer. `inputMode="numeric"` brings up the number pad rather than the
 * full keyboard, which matters when someone is entering a raise mid-hand.
 */
export function NumberInput({
  label,
  value,
  onChange,
  hint,
  error,
  invalid = false,
  placeholder,
  disabled,
  autoFocus,
  labelHidden = false,
}: NumberInputProps) {
  const id = useId()

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label
        htmlFor={id}
        className={
          labelHidden ? 'sr-only' : 'text-xs font-medium uppercase tracking-wider text-faint'
        }
      >
        {label}
      </label>

      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        // Selects the whole value on focus so typing replaces rather than appends.
        onFocus={(e) => e.currentTarget.select()}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-invalid={error || invalid ? true : undefined}
        aria-describedby={error || hint ? `${id}-note` : undefined}
        onChange={(e) => onChange(e.currentTarget.value.replace(/[^\d]/g, ''))}
        className={[
          'tnum min-h-12 w-full rounded-lg border bg-raised px-3 text-ink',
          'placeholder:text-faint disabled:opacity-40',
          error || invalid ? 'border-bad' : 'border-line',
        ].join(' ')}
      />

      {(error || hint) && (
        <p id={`${id}-note`} className={`text-xs ${error ? 'text-bad' : 'text-faint'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}
