// Ticket 284: the reasons an admin can hide a Page. The keys are checked again
// by admin_hide_page() (20261207000000_admin_page_unpublish.sql).

export const PAGE_HIDE_REASONS = [
  { value: 'owner_asked', label: 'Owner Asked' },
  { value: 'closed', label: 'Closed' },
  { value: 'not_eligible', label: 'Not Eligible' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'other', label: 'Other' },
] as const

export type PageHideReason = (typeof PAGE_HIDE_REASONS)[number]['value']

export const PAGE_HIDE_NOTE_MAX = 500

export function isPageHideReason(value: string): value is PageHideReason {
  return PAGE_HIDE_REASONS.some((r) => r.value === value)
}

export function pageHideReasonLabel(value: string | null | undefined): string {
  return PAGE_HIDE_REASONS.find((r) => r.value === value)?.label ?? 'Other'
}
