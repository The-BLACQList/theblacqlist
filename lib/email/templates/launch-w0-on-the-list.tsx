import { W0_COPY } from '@/lib/email/launch-copy'

import { LaunchLayout, type LaunchEmailFrameProps } from './launch-layout'

/**
 * W0, the automatic launch-list confirmation: "You're on the list".
 * Copy: lib/email/launch-copy.ts (W0_COPY), verbatim from the marketing OS draft.
 * Sent only by lib/email/sendLaunchConfirmation.ts, and only when
 * LAUNCH_CONFIRMATION_EMAIL_ENABLED is 'true' (default off).
 */
export const LAUNCH_W0_SUBJECT = W0_COPY.subjects[0]

export function LaunchW0OnTheListEmail(props: LaunchEmailFrameProps) {
  return <LaunchLayout copy={W0_COPY} {...props} />
}
