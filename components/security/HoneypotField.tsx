import { HONEYPOT_FIELD } from '@/lib/security/honeypot'

// The visible half of lib/security/honeypot.ts. Off screen rather than
// display:none, because some bots skip fields that are display:none. Out of the
// tab order and hidden from assistive tech, so no person ever lands in it.
export function HoneypotField() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
      <label>
        Leave this field blank
        <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  )
}
