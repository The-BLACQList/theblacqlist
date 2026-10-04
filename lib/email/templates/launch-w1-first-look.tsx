import { w1Copy, type W1Opening } from '@/lib/email/launch-copy'

import { LaunchLayout, type LaunchEmailFrameProps } from './launch-layout'

/**
 * W1, the pre-launch first look. One broadcast the founder sends from Resend.
 * Copy: lib/email/launch-copy.ts (w1Copy), verbatim from the marketing OS draft.
 * Status: prepared_awaiting_approval (send_email gate). Not wired to any send.
 *
 * `opening` is the founder's choice before sending: A if W0 went out, B if W0
 * was skipped. Required, with no default, so the choice is made on purpose.
 * The draft's [VISUAL] slot is pending and deliberately not rendered.
 */
export const LAUNCH_W1_SUBJECT = w1Copy('A').subjects[0]

export function LaunchW1FirstLookEmail({
  opening,
  ...props
}: LaunchEmailFrameProps & { opening: W1Opening }) {
  return <LaunchLayout copy={w1Copy(opening)} {...props} />
}
