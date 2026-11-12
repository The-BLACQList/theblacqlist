import type { ReactNode } from 'react'

import { Body, Container, Head, Html, Link, Preview, Section, Text } from '@react-email/components'

/**
 * The pieces the two tester emails share: the invite (tester-invite.tsx) and
 * the update for people already testing (tester-update.tsx). One place for the
 * house styling so the two cannot drift, and one place for The Collective
 * block so both emails describe it in the same words.
 *
 * Both emails are rendered on /admin/email-preview and pasted into Gmail by
 * the founder, one recipient at a time. Nothing here sends.
 */

export const DEFAULT_SITE_URL = 'https://theblacqlist.com'

export function TesterEmailShell({
  preview,
  siteUrl,
  children,
}: {
  preview: string
  siteUrl: string
  children: ReactNode
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.logoText}>THE BLACQLIST</Text>
          </Section>

          <Section style={styles.content}>{children}</Section>

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              © {new Date().getFullYear()} The BLACQList. All rights reserved.
            </Text>
            <Text style={styles.footerText}>
              <a href={siteUrl} style={styles.footerLink}>
                theblacqlist.com
              </a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

/**
 * The prompt to explore The Collective (/flow-map).
 *
 * Framed as a first look [Decision — founder, 2026-11-12]: testers see it
 * before the public does. The page is gated by FEATURE_COLLECTIVE_OPEN. It is
 * on in prod (since 2026-10-31), so a signed-in tester gets the live map, but
 * it has been switched off before (2026-10-30), and then the same link shows
 * the /soon/collective cover. The copy has to read true in both states, so it
 * says neither "it's open" nor "it isn't open yet", and makes no promise of a
 * waitlist or a receipt form.
 *
 * Wording follows lib/features/opening-soon.ts and the home ImpactBand.
 */
export function CollectiveFirstLook({ siteUrl }: { siteUrl: string }) {
  const href = `${siteUrl.replace(/\/+$/, '')}/flow-map`
  return (
    <Section style={styles.collective}>
      <Text style={styles.collectiveEyebrow}>First look</Text>
      <Text style={styles.collectiveTitle}>Explore The Collective</Text>
      <Text style={styles.collectiveBody}>
        The Collective is one live map of what our community spends with businesses on the list.
        Shop at a business on the list, add a receipt, and your spend joins the map.
      </Text>
      <Text style={styles.collectiveBody}>
        You&rsquo;re seeing it before the public does. Take a look.
      </Text>
      <Text style={styles.collectiveLinkLine}>
        <Link href={href} style={styles.collectiveLink}>
          See The Collective &rarr;
        </Link>
      </Text>
    </Section>
  )
}

/**
 * The "something broken?" callout both emails close on.
 *
 * `forwarded`: the email may reach people second-hand (the shared invite). A
 * reply to a forwarded email goes to whoever forwarded it, not to us, so that
 * version points at Report a problem only.
 */
export function ReportProblemCallout({ forwarded = false }: { forwarded?: boolean } = {}) {
  return (
    <Section style={styles.callout}>
      <Text style={styles.calloutTitle}>Something broken or confusing?</Text>
      {forwarded ? (
        <Text style={styles.calloutBody}>
          Tap <strong>Report a problem</strong> on any page and tell us. Blunt is more useful to us
          than kind.
        </Text>
      ) : (
        <Text style={styles.calloutBody}>
          Tap <strong>Report a problem</strong> on any page, or reply to this email and tell us.
          Blunt is more useful to us than kind.
        </Text>
      )}
    </Section>
  )
}

export const styles = {
  body: {
    backgroundColor: '#F5F5F0',
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    margin: 0,
    padding: '24px 0',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    maxWidth: '560px',
    margin: '0 auto',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#08080A',
    padding: '24px 32px',
  },
  logoText: {
    color: '#C4A065',
    fontSize: '18px',
    fontWeight: '700',
    letterSpacing: '0.12em',
    margin: 0,
  },
  content: {
    padding: '32px 32px 24px',
  },
  eyebrow: {
    color: '#8F6600',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.12em',
    margin: '0 0 8px',
    textTransform: 'uppercase',
  },
  heading: {
    color: '#000000',
    fontSize: '22px',
    fontWeight: '700',
    lineHeight: '1.25',
    margin: '0 0 16px',
  },
  subheading: {
    color: '#000000',
    fontSize: '16px',
    fontWeight: '700',
    lineHeight: '1.4',
    margin: '0 0 12px',
  },
  paragraph: {
    color: '#595758',
    fontSize: '15px',
    lineHeight: '1.6',
    margin: '0 0 16px',
  },
  note: {
    color: '#9B9B9B',
    fontSize: '13px',
    lineHeight: '1.6',
    margin: '0 0 24px',
  },
  step: {
    color: '#595758',
    fontSize: '15px',
    lineHeight: '1.6',
    margin: '0 0 10px',
  },
  stepNumber: {
    color: '#08080A',
  },
  button: {
    backgroundColor: '#8F6600',
    borderRadius: '100px',
    color: '#FFFFFF',
    display: 'inline-block',
    fontSize: '14px',
    fontWeight: '700',
    margin: '8px 0 12px',
    padding: '12px 28px',
    textDecoration: 'none',
  },
  callout: {
    backgroundColor: '#FAF6EC',
    borderLeft: '3px solid #C4A065',
    borderRadius: '4px',
    margin: '20px 0 24px',
    padding: '16px 18px',
  },
  calloutTitle: {
    color: '#08080A',
    fontSize: '14px',
    fontWeight: '700',
    lineHeight: '1.4',
    margin: '0 0 6px',
  },
  calloutBody: {
    color: '#595758',
    fontSize: '14px',
    lineHeight: '1.6',
    margin: 0,
  },
  // The Collective block: the cover page's own look, gold on near-black, so it
  // reads as a different thing from the steps above it.
  collective: {
    backgroundColor: '#08080A',
    borderRadius: '8px',
    margin: '8px 0 24px',
    padding: '20px 22px',
  },
  collectiveEyebrow: {
    color: '#C4A065',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.12em',
    margin: '0 0 6px',
    textTransform: 'uppercase',
  },
  collectiveTitle: {
    color: '#FFFFFF',
    fontSize: '18px',
    fontWeight: '700',
    lineHeight: '1.3',
    margin: '0 0 10px',
  },
  collectiveBody: {
    color: '#D9D6CF',
    fontSize: '14px',
    lineHeight: '1.6',
    margin: '0 0 10px',
  },
  collectiveLinkLine: {
    fontSize: '14px',
    fontWeight: '700',
    margin: '4px 0 0',
  },
  collectiveLink: {
    color: '#C4A065',
    textDecoration: 'underline',
  },
  divider: {
    borderColor: '#ECEAE6',
    margin: '0 0 24px',
  },
  footer: {
    backgroundColor: '#F5F5F0',
    padding: '20px 32px',
    textAlign: 'center',
  },
  footerText: {
    color: '#9B9B9B',
    fontSize: '12px',
    margin: '0 0 4px',
  },
  footerLink: {
    color: '#9B9B9B',
    textDecoration: 'underline',
  },
} satisfies Record<string, React.CSSProperties>
