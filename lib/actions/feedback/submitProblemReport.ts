'use server'

import { headers } from 'next/headers'
import { z } from 'zod'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { PROBLEM_REPORT_MAX, PROBLEM_REPORT_MIN } from '@/lib/feedback/problem-report'

// The "Report a problem" button (components/feedback/ReportProblemButton.tsx).
// One text box on every signed-in page; the row lands in `problem_reports`
// (supabase/migrations/20260921000000_problem_reports.sql) where /admin/feedback
// reads it. Same shape as submitCorrectionAction so the two report paths feel
// alike to whoever maintains them next.
//
// Signed-in only, on purpose. Testers are signed in, the button is not rendered
// for anyone else, and a report without an account behind it cannot be followed
// up. The generic error string is the same one corrections use: the row failing
// to insert is not the reporter's problem to debug.

export type SubmitProblemReportState = { success: true } | { error: string } | null

/** 5 reports per 10 minutes per user. Enough for a bad afternoon, not for a script. */
const RATE_LIMIT = 5
const RATE_WINDOW_SECONDS = 10 * 60

const schema = z.object({
  body: z
    .string()
    .trim()
    .min(PROBLEM_REPORT_MIN, `Tell us a little more (at least ${PROBLEM_REPORT_MIN} characters).`)
    .max(PROBLEM_REPORT_MAX, `Keep it under ${PROBLEM_REPORT_MAX} characters.`),
  // The pathname only. A query string could carry a search term, and the
  // report is about the page, not the search.
  page_path: z
    .string()
    .trim()
    .max(512)
    .transform((p) => (p.startsWith('/') ? (p.split('?')[0] ?? '/') : '/'))
    .catch('/'),
})

export async function submitProblemReportAction(
  _prev: SubmitProblemReportState,
  formData: FormData
): Promise<SubmitProblemReportState> {
  const parsed = schema.safeParse({
    body: formData.get('body')?.toString() ?? '',
    page_path: formData.get('page_path')?.toString() ?? '/',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your report and try again.' }
  }

  // Read the user from the request-scoped client, never from form data.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sign in to send a report.' }

  const allowed = await checkRateLimit({
    bucket: 'problem_report',
    identifier: user.id,
    limit: RATE_LIMIT,
    windowSeconds: RATE_WINDOW_SECONDS,
  })
  if (!allowed) {
    return { error: 'You have sent a few reports already. Give it a few minutes and try again.' }
  }

  const serviceClient = createServiceClient()

  // Role is context for triage, not authorization. Best effort: a missing row
  // (an account that never finished onboarding) is stored as null, not an error.
  const { data: roleRow } = await serviceClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['owner', 'supporter', 'admin', 'super_admin'])
    .limit(1)
    .maybeSingle()

  const h = await headers()
  const userAgent = h.get('user-agent')?.slice(0, 512) ?? null

  const { error } = await serviceClient.from('problem_reports').insert({
    user_id: user.id,
    role: roleRow?.role ?? null,
    page_path: parsed.data.page_path,
    user_agent: userAgent,
    body: parsed.data.body,
  })

  if (error) return { error: 'Failed to send your report. Please try again.' }

  return { success: true }
}
