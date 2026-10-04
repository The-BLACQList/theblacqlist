import { E4_COPY } from '@/lib/email/launch-copy'

import { LaunchLayout, type LaunchEmailFrameProps } from './launch-layout'

/**
 * E4, D14 broadcast: two weeks of The BLACQList. Sent by the founder from Resend.
 * Copy: lib/email/launch-copy.ts (E4_COPY), verbatim from the marketing OS draft.
 * Status: prepared_awaiting_approval (send_email gate). Not wired to any send.
 */
export const LAUNCH_E4_SUBJECT = E4_COPY.subjects[0]

export function LaunchE4TwoWeeksEmail(props: LaunchEmailFrameProps) {
  return <LaunchLayout copy={E4_COPY} {...props} />
}
