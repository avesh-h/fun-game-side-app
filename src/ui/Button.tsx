import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'default' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant
  readonly size?: ButtonSize
  readonly fullWidth?: boolean
  readonly children: ReactNode
}

/**
 * Sizes are driven by thumbs, not by text. Even `sm` clears the 44px target
 * that makes a button reliable to hit on a phone lying on a table in bad light.
 */
const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-3 text-sm',
  md: 'min-h-12 px-4 text-sm',
  lg: 'min-h-14 px-5 text-base',
}

// `enabled:hover:` rather than plain `hover:` — a disabled button should not
// light up under the mouse as though it were about to do something.
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'border-accent bg-accent text-accent-ink font-semibold enabled:hover:bg-accent/90 active:bg-accent/85',
  default:
    'border-line bg-raised text-ink enabled:hover:border-accent/40 enabled:hover:bg-line active:bg-line',
  danger: 'border-bad/45 bg-bad/10 text-bad enabled:hover:bg-bad/20 active:bg-bad/25',
  ghost:
    'border-transparent bg-transparent text-muted enabled:hover:bg-raised enabled:hover:text-ink active:bg-raised',
}

export function Button({
  variant = 'default',
  size = 'md',
  fullWidth = false,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg border',
        'transition-colors duration-75',
        // Not `pointer-events-none` — that would hide the not-allowed cursor
        // too, and a disabled button should still explain itself on hover.
        'disabled:opacity-35',
        SIZES[size],
        VARIANTS[variant],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
