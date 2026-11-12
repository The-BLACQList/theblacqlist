import { Button, Hr, Text } from '@react-email/components'

import {
  CollectiveFirstLook,
  DEFAULT_SITE_URL,
  ReportProblemCallout,
  TesterEmailShell,
  styles,
} from '@/lib/email/templates/tester-email-parts'

/**
 * Who the invite is for. One template, two bodies: a separate supporter file
 * would slip past the source checks in tests/tester-invite-email.test.ts that
 * keep a real token out of this repo.
 *
 * Required with no default so a caller has to say which one they mean.
 */
export type TesterInviteVariant = 'owner' | 'supporter'

interface TesterInviteEmailProps {
  variant: TesterInviteVariant
  /**
   * The one-tap tester link, `https://…/t#<token>`, minted on /admin/testers.
   *
   * Required, and deliberately without a default. Two reasons:
   *  1. Forgetting it is a compile error, not an email with a dead button.
   *  2. A default would mean a token living in this file. The token never
   *     appears in the repo. It is pasted into /admin/email-preview at send
   *     time and passed in from there. It rides in the URL fragment, so it
   *     never reaches a server log when the tester taps it (lib/tester/links.ts).
   */
  testerLink: string
  /** Optional: the greeting degrades to "You're in early." with no dangling comma. */
  firstName?: string | null
  siteUrl?: string
}

/**
 * The first email a new tester gets. It matches the one-tap flow on prod:
 * tap the link, tap Start on /t, signed in with no password, and a short guide
 * (the Tester Tour rail) walks them through the site.
 *
 * The step lines below mirror TOUR_STEP_COPY in lib/tour/verify.ts. If the
 * rail's steps change, change these with them.
 */
export function TesterInviteEmail({
  variant,
  testerLink,
  firstName = null,
  siteUrl = DEFAULT_SITE_URL,
}: TesterInviteEmailProps) {
  const isOwner = variant === 'owner'

  return (
    <TesterEmailShell
      siteUrl={siteUrl}
      preview={
        isOwner
          ? 'One tap and you’re in. Add your business to The BLACQList before we open to the public.'
          : 'One tap and you’re in. Explore The BLACQList before we open to the public.'
      }
    >
      <Text style={styles.eyebrow}>Private Preview</Text>
      <Text style={styles.heading}>
        {firstName ? `You're in early, ${firstName}.` : "You're in early."}
      </Text>

      {isOwner ? (
        <Text style={styles.paragraph}>
          The BLACQList isn&rsquo;t open to the public yet. We&rsquo;re bringing a small group of
          business owners in first to put their business on the list, tell us what&rsquo;s
          confusing, and help us fix it before everyone else arrives.
        </Text>
      ) : (
        <Text style={styles.paragraph}>
          The BLACQList isn&rsquo;t open to the public yet. We&rsquo;re bringing a small group of
          people in first to find Black-owned businesses, save the ones they love, tell us
          what&rsquo;s confusing, and help us fix it before everyone else arrives.
        </Text>
      )}

      <Text style={styles.paragraph}>
        <strong>One tap and you&rsquo;re in.</strong> Tap the button, then tap{' '}
        <strong>Start</strong>. We sign you in. No password, nothing to confirm.
      </Text>

      <Button href={testerLink} style={styles.button}>
        Start here
      </Button>

      <Text style={styles.note}>
        This link is yours for 14 days. Open it again any time and you pick up where you left off.
      </Text>

      <Hr style={styles.divider} />

      <Text style={styles.subheading}>What it takes: about 15 minutes</Text>

      <Text style={styles.paragraph}>
        A short guide down the side of the site walks you through it, one step at a time.
      </Text>

      {isOwner ? (
        <>
          {/* The owner hint matches the role card on /t (StartTourButton). */}
          <Text style={styles.step}>
            <strong style={styles.stepNumber}>1.</strong> If we ask, pick{' '}
            <strong>&ldquo;I own a business.&rdquo;</strong>
          </Text>
          <Text style={styles.step}>
            <strong style={styles.stepNumber}>2.</strong> Claim your page, or make one: the name,
            what you do, where you are, and a photo or two. We review it and email you when
            it&rsquo;s live.
          </Text>
          <Text style={styles.step}>
            <strong style={styles.stepNumber}>3.</strong> Walk the site the way a shopper would:
            search, save a place you&rsquo;d actually go, find businesses on the map, and leave a
            review.
          </Text>
          <Text style={styles.step}>
            <strong style={styles.stepNumber}>4.</strong> Tell us what worked and what didn&rsquo;t.
          </Text>
          {/* Owner compensation [Decision — founder, 2026-09-19, made
              conditional 2026-10-10]: one free month on any tier, used now or
              held until the tier they want opens. It unlocks when the owner
              finishes the guide (lib/tour/freeMonth.ts), so the email ties it
              to finishing rather than promising it on sign-up. The word
              "trial" stays out; the test guards it. */}
          <Text style={styles.paragraph}>
            Finish the guide and you get one month of The BLACQList free on any tier. Use it right
            away, or save it until the plan you want opens.
          </Text>
        </>
      ) : (
        <>
          {/* Supporter copy promises only what the product does this week. No
              personalising (onboarding categories are not saved), no following
              (does not exist). */}
          <Text style={styles.step}>
            <strong style={styles.stepNumber}>1.</strong> Search for something you&rsquo;d really
            look for: a city, a category, a name.
          </Text>
          <Text style={styles.step}>
            <strong style={styles.stepNumber}>2.</strong> Open a few places. Save one you&rsquo;d
            actually go to.
          </Text>
          <Text style={styles.step}>
            <strong style={styles.stepNumber}>3.</strong> Find businesses on the map, and browse a
            collection.
          </Text>
          <Text style={styles.step}>
            <strong style={styles.stepNumber}>4.</strong> Leave a review on a place you know, or
            flag a listing that looks out of date.
          </Text>
          <Text style={styles.step}>
            <strong style={styles.stepNumber}>5.</strong> Tell us what worked and what didn&rsquo;t.
          </Text>
        </>
      )}

      <Text style={styles.paragraph}>
        A few steps ask for a sentence or two. Those notes are the part we read.
      </Text>

      <ReportProblemCallout />

      <CollectiveFirstLook siteUrl={siteUrl} />

      <Text style={styles.paragraph}>Thank you for being one of the first through the door.</Text>
    </TesterEmailShell>
  )
}
