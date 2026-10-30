import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  id: string
  label: string
  required?: boolean
  optionalNote?: string
  hint?: string
  error?: string
  children: (a: { describedBy: string | undefined; invalid: boolean }) => ReactNode
  className?: string
}

export const labelCls = 'font-subhead text-sm font-semibold text-brand-black'
export const hintCls = 'text-xs font-subhead text-charcoal-soft'
export const errCls = 'text-xs font-subhead text-red-700 mt-0.5'

export function inputCls(invalid: boolean): string {
  return cn(
    'h-11 w-full rounded-lg border bg-white font-subhead text-sm text-brand-black px-3',
    'placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black',
    invalid ? 'border-red-400' : 'border-charcoal/30'
  )
}

/** A visible label, optional hint, and an inline error linked with aria-describedby. */
export function Field({ id, label, required, optionalNote, hint, error, children, className }: Props) {
  const hintId = hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className={labelCls}>
        {label}{' '}
        {required && (
          <span className="text-red-700" aria-hidden="true">
            *
          </span>
        )}
        {optionalNote && <span className="font-normal text-charcoal-soft text-xs">{optionalNote}</span>}
      </label>
      {children({ describedBy, invalid: Boolean(error) })}
      {hint && (
        <p id={hintId} className={hintCls}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className={errCls}>
          {error}
        </p>
      )}
    </div>
  )
}
