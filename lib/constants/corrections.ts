export const CORRECTION_ISSUE_TYPES = [
  'name_wrong',
  'address_wrong',
  'phone_wrong',
  'hours_wrong',
  'website_broken',
  'category_wrong',
  'permanently_closed',
  'duplicate',
  'other',
] as const

export type CorrectionIssueType = (typeof CORRECTION_ISSUE_TYPES)[number]

export const ISSUE_LABELS: Record<CorrectionIssueType, string> = {
  name_wrong: 'Business name is wrong',
  address_wrong: 'Address / location is wrong',
  phone_wrong: 'Phone number is wrong or disconnected',
  hours_wrong: 'Hours are wrong',
  website_broken: 'Website link is broken',
  category_wrong: 'Category is wrong',
  permanently_closed: 'This business is permanently closed',
  duplicate: 'This is a duplicate listing',
  other: 'Other',
}
