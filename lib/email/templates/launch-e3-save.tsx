import { E3_COPY } from '@/lib/email/launch-copy'

import { LaunchLayout, type LaunchEmailFrameProps } from './launch-layout'

/**
 * E3, D7 broadcast: save what you find. Sent by the founder from Resend.
 * Copy: lib/email/launch-copy.ts (E3_COPY), verbatim from the marketing OS draft.
 * Status: prepared_awaiting_approval (send_email gate). Not wired to any send.
 */
export const LAUNCH_E3_SUBJECT = E3_COPY.subjects[0]

export function LaunchE3SaveEmail(props: LaunchEmailFrameProps) {
  return <LaunchLayout copy={E3_COPY} {...props} />
}
