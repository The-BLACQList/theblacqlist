// Honeypot: a form field people never see and bots fill in.
//
// Scripted submitters fill every input they find. A real person never reaches
// this one: it is moved off screen, skipped by Tab, and hidden from screen
// readers (components/security/HoneypotField.tsx). A filled field means a bot,
// and the action returns its normal success state without writing anything,
// so the bot learns nothing about what tripped it.
//
// This is a cheap first filter in front of Turnstile, not a replacement for it.
// The name is deliberately one that browser autofill and password managers
// have no reason to fill, so a real person is never silently dropped.

export const HONEYPOT_FIELD = 'leave_this_blank'

export function isHoneypotTripped(formData: FormData): boolean {
  const value = formData.get(HONEYPOT_FIELD)
  return typeof value === 'string' && value.trim().length > 0
}
