import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'accent' | 'good' | 'bad' | 'warn' | 'quiet'

const TONES: Record<BadgeTone, string> = {
  neutral: 'border-line bg-raised text-muted',
  accent: 'border-accent/50 bg-accent-soft text-ink',
  good: 'border-good/40 bg-good/10 text-good',
  bad: 'border-bad/40 bg-bad/10 text-bad',
  warn: 'border-warn/40 bg-warn/10 text-warn',
  quiet: 'border-transparent bg-transparent text-faint',
}

/** Small pill for a status or a position marker — D, ALL-IN, folded. */
export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  readonly tone?: BadgeTone
  readonly children: ReactNode
  readonly className?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
