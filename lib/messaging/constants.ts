// Customer -> business messaging (decision 2026-11-13). Shared by the server
// actions, the loaders and the client components, so nothing here may import
// server-only code.

/** messages.body CHECK (char_length(body) BETWEEN 1 AND 2000). */
export const MESSAGE_MAX_LENGTH = 2000

/** conversations.last_message_preview CHECK (<= 160). */
export const MESSAGE_PREVIEW_LENGTH = 160

export const REPORT_NOTE_MAX_LENGTH = 500

export const REPORT_REASONS = ['spam', 'harassment', 'scam', 'inappropriate', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam',
  harassment: 'Harassment or threats',
  scam: 'Scam or fraud',
  inappropriate: 'Inappropriate content',
  other: 'Something else',
}

// Per-account limits (lib/security/rate-limit.ts, which fails open).
export const START_RATE_LIMIT = { limit: 5, windowSeconds: 60 * 60 } as const
export const SEND_RATE_LIMIT = { limit: 30, windowSeconds: 60 * 60 } as const
export const REPORT_RATE_LIMIT = { limit: 10, windowSeconds: 24 * 60 * 60 } as const

/**
 * The one message a customer sees when they are blocked, suspended, or the
 * business is not taking new messages. It is deliberately the same for all
 * three, so a block is never revealed as a block.
 */
export const MESSAGING_UNAVAILABLE_ERROR = "You can't message this business."

/** The hash the listing page's composer listens for. */
export const COMPOSE_HASH = '#send-message'

export const CUSTOMER_INBOX_PATH = '/account/messages'
export const OWNER_INBOX_PATH = '/dashboard/messages'

// Saved replies (messages about postings, 2026-11-13). The table CHECKs match.
export const SAVED_REPLY_LIMIT = 30
export const SAVED_REPLY_TITLE_MAX = 60
export const SAVED_REPLY_KINDS = ['any', 'customer', 'job', 'event'] as const
export type SavedReplyKind = (typeof SAVED_REPLY_KINDS)[number]
export const SAVED_REPLY_KIND_LABELS: Record<SavedReplyKind, string> = {
  any: 'Any conversation',
  customer: 'Customers',
  job: 'Job applicants',
  event: 'Event guests',
}
