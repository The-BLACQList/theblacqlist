// Shared constants for the Report a problem flow. Kept out of the server action
// file because a 'use server' module may export only async functions, and the
// client dialog needs the same limits for its textarea.

/** Matches the DB CHECK exactly; the constraint is the backstop, these are the message. */
export const PROBLEM_REPORT_MIN = 10
export const PROBLEM_REPORT_MAX = 1000

export const PROBLEM_REPORT_STATUSES = ['new', 'triaged', 'fixed', 'dismissed'] as const
export type ProblemReportStatus = (typeof PROBLEM_REPORT_STATUSES)[number]
