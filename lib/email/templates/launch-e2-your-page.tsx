import { E2_COPY } from '@/lib/email/launch-copy'

import { LaunchLayout, type LaunchEmailFrameProps } from './launch-layout'

/**
 * E2, owner broadcast: your Page may already be here. Sent by the founder from Resend.
 * Copy: lib/email/launch-copy.ts (E2_COPY), verbatim from the marketing OS draft.
 * Status: prepared_awaiting_approval (send_email gate). Not wired to any send.
 */
export const LAUNCH_E2_SUBJECT = E2_COPY.subjects[0]

export function LaunchE2YourPageEmail(props: LaunchEmailFrameProps) {
  return <LaunchLayout copy={E2_COPY} {...props} />
}
