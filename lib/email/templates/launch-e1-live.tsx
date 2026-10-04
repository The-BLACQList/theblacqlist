import { E1_COPY } from '@/lib/email/launch-copy'

import { LaunchLayout, type LaunchEmailFrameProps } from './launch-layout'

/**
 * E1, D0 broadcast: The BLACQList is open. Sent by the founder from Resend.
 * Copy: lib/email/launch-copy.ts (E1_COPY), verbatim from the marketing OS draft.
 * Status: prepared_awaiting_approval (send_email gate). Not wired to any send.
 */
export const LAUNCH_E1_SUBJECT = E1_COPY.subjects[0]

export function LaunchE1LiveEmail(props: LaunchEmailFrameProps) {
  return <LaunchLayout copy={E1_COPY} {...props} />
}
