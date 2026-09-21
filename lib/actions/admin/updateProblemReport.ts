'use server'

import { revalidatePath } from 'next/cache'

import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'
import {
  PROBLEM_REPORT_STATUSES,
  type ProblemReportStatus,
} from '@/lib/feedback/problem-report'

// Moves a problem report through new -> triaged -> fixed | dismissed from
// /admin/feedback. Same shape as resolveQueueItemAction. `pr_ref` is the PR
// that fixed it (e.g. "#142"); it is optional and only meaningful on `fixed`,
// but stored on any transition so a triager can note it early.

export type UpdateProblemReportState = { success: true } | { error: string } | null

const PR_REF_MAX = 64

function isStatus(value: string): value is ProblemReportStatus {
  return (PROBLEM_REPORT_STATUSES as readonly string[]).includes(value)
}

export async function updateProblemReportAction(
  _prev: UpdateProblemReportState,
  formData: FormData
): Promise<UpdateProblemReportState> {
  const admin = await getAdminSession()
  if (!admin) return { error: 'You do not have permission to perform this action.' }

  const reportId = formData.get('report_id')?.toString().trim() ?? ''
  const status = formData.get('status')?.toString().trim() ?? ''
  const prRefRaw = formData.get('pr_ref')?.toString().trim() ?? ''

  if (!reportId) return { error: 'Missing report ID.' }
  if (!isStatus(status)) return { error: 'Status must be new, triaged, fixed, or dismissed.' }
  if (prRefRaw.length > PR_REF_MAX) return { error: `Keep the PR reference under ${PR_REF_MAX} characters.` }

  const serviceClient = createServiceClient()

  const { data: report } = await serviceClient
    .from('problem_reports')
    .select('id, status, pr_ref')
    .eq('id', reportId)
    .maybeSingle()

  if (!report) return { error: 'Report not found.' }

  // An empty pr_ref field leaves the stored value alone, so "Mark triaged"
  // without a ref does not erase one typed earlier.
  const prRef = prRefRaw || report.pr_ref

  const { error } = await serviceClient
    .from('problem_reports')
    .update({ status, pr_ref: prRef, updated_at: new Date().toISOString() })
    .eq('id', reportId)

  if (error) return { error: 'Failed to update the report. Please try again.' }

  void writeAuditLog({
    adminUserId: admin.user.id,
    action: 'update_problem_report',
    targetTable: 'problem_reports',
    targetId: reportId,
    beforeState: { status: report.status, pr_ref: report.pr_ref },
    afterState: { status, pr_ref: prRef },
  })

  // 'layout' so the sidebar pill (counts `new`) refreshes with the page.
  revalidatePath('/admin', 'layout')
  return { success: true }
}
