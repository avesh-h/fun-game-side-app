import type { ReactNode } from 'react'

/** The standard raised surface. Everything on a screen sits in one of these. */
export function Panel({
  children,
  className = '',
  padded = true,
}: {
  readonly children: ReactNode
  readonly className?: string
  readonly padded?: boolean
}) {
  return (
    <section
      className={`rounded-xl border border-line bg-surface ${padded ? 'p-4' : ''} ${className}`}
    >
      {children}
    </section>
  )
}

export function PanelTitle({ children }: { readonly children: ReactNode }) {
  return <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">{children}</h2>
}

/** Placeholder used by screens that are not built yet. */
export function EmptyState({
  title,
  detail,
}: {
  readonly title: string
  readonly detail?: string
}) {
  return (
    <Panel className="text-center">
      <p className="text-sm text-muted">{title}</p>
      {detail && <p className="mt-1 text-xs text-faint">{detail}</p>}
    </Panel>
  )
}
