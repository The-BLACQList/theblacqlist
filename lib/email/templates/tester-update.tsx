import { Button, Hr, Text } from '@react-email/components'

import {
  CollectiveFirstLook,
  DEFAULT_SITE_URL,
  ReportProblemCallout,
  TesterEmailShell,
  styles,
} from '@/lib/email/templates/tester-email-parts'
import type { TesterInviteVariant } from '@/lib/email/templates/tester-invite'

interface TesterUpdateEmailProps {
  /** Required with no default, for the same reason as the invite's. */
  variant: TesterInviteVariant
  /**
   * A fresh one-tap link for this tester, `https://…/t#<token>`, minted on
   * /admin/testers. Links last 14 days, so the one in their invite may have
   * run out. A tester who is already enrolled sees "pick up where you left
   * off" on /t, so a new link takes them straight back to their guide.
   *
   * Required, no default: the token never lives in this file.
   */
  testerLink: string
  firstName?: string | null
  /**
   * Free text, e.g. "Tuesday, 17 November". Typed in at send time because the
   * public opening date has moved more than once; a date baked into the
   * template would go stale. Left out, the line reads "soon".
   */
  openingDate?: string | null
  siteUrl?: string
}

/**
 * For people already testing: thank them, ask them to finish the guide before
 * we open to the public, and give them a first look at The Collective.
 *
 * Rendered on /admin/email-preview and pasted into Gmail one recipient at a
 * time. Never a group email and never BCC (tester runbook, GATE-COMMS).
 */
export function TesterUpdateEmail({
  variant,
  testerLink,
  firstName = null,
  openingDate = null,
  siteUrl = DEFAULT_SITE_URL,
}: TesterUpdateEmailProps) {
  const isOwner = variant === 'owner'
  const opening = openingDate?.trim() ? `on ${openingDate.trim()}` : 'soon'

  return (
    <TesterEmailShell
      siteUrl={siteUrl}
      preview="Before we open: finish your walk, and take a first look at The Collective."
    >
      <Text style={styles.eyebrow}>Tester update</Text>
      <Text style={styles.heading}>{firstName ? `Thank you, ${firstName}.` : 'Thank you.'}</Text>

      {/* One string, not text around an expression: React would split it with
          <!-- --> markers, which is noise in a Gmail paste. */}
      <Text style={styles.paragraph}>
        {`You helped shape The BLACQList before anyone else saw it. We open to everyone ${opening}. Two things before then.`}
      </Text>

      <Hr style={styles.divider} />

      <Text style={styles.subheading}>1. Finish your walk</Text>

      <Text style={styles.paragraph}>
        Pick up where you left off in the guide down the side of the site. The last note, what
        worked, what didn&rsquo;t, and would you tell a friend, is the one we read most.
      </Text>

      {isOwner && (
        // Same founder decision as the invite: one free month on any tier,
        // unlocked by finishing, and it can be held (lib/tour/freeMonth.ts).
        <Text style={styles.paragraph}>
          Finish the guide and your one month of The BLACQList free on any tier unlocks. Use it
          right away, or save it until the plan you want opens.
        </Text>
      )}

      <Button href={testerLink} style={styles.button}>
        Pick up where you left off
      </Button>

      <Text style={styles.note}>
        Tap the button, then tap Start. We sign you back in. No password needed.
      </Text>

      <Text style={styles.subheading}>2. See what&rsquo;s coming next</Text>

      <CollectiveFirstLook siteUrl={siteUrl} />

      <ReportProblemCallout />

      <Text style={styles.paragraph}>
        Thank you for being one of the first through the door. It shows in what we&rsquo;re opening
        with.
      </Text>
    </TesterEmailShell>
  )
}
