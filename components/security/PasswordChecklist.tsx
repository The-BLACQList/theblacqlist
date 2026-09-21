'use client'

import { Check, Circle } from 'lucide-react'

import { checkPassword } from '@/lib/auth/password-policy'
import { cn } from '@/lib/utils'

interface Props {
  /** The live value of the password input this list describes. */
  password: string
  /**
   * Element id, so the input can point at the list with aria-describedby the
   * same way it pointed at the old static hint.
   */
  id: string
  className?: string
}

/**
 * Live password requirements. Each rule flips from an open circle to a check
 * as the user types, with a text label and an sr-only "met / not met" so the
 * state never depends on colour alone. The progress line is the one polite
 * live region; the list itself is not announced on every keystroke.
 */
export function PasswordChecklist({ password, id, className }: Props) {
  const { rules, isValid, passedCount } = checkPassword(password)
  const started = password.length > 0

  return (
    <div id={id} className={cn('flex flex-col gap-1', className)}>
      <p className="text-xs font-subhead text-charcoal-soft" aria-live="polite">
        {!started
          ? 'Your password needs:'
          : isValid
            ? 'Your password meets every requirement.'
            : `${passedCount} of ${rules.length} requirements met.`}
      </p>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
        {rules.map((rule) => {
          const met = started && rule.passed
          return (
            <li
              key={rule.id}
              data-rule={rule.id}
              data-met={met ? 'true' : 'false'}
              className={cn(
                'flex items-center gap-1.5 text-xs font-subhead',
                met ? 'text-green-700' : 'text-charcoal-soft'
              )}
            >
              {met ? (
                <Check className="size-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Circle className="size-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>{rule.label}</span>
              <span className="sr-only">{met ? ', met' : ', not met'}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
