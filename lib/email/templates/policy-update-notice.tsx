import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import { POLICY_UPDATE } from '@/lib/legal/policyUpdate'

/**
 * The 14-day notice for the October 2026 policy update (ticket 139). Privacy
 * §10 and Terms §13 promise this email to registered users before the change
 * takes effect, so it is a service message, not marketing: it goes to every
 * confirmed account and carries no promotion.
 *
 * [Needs professional review] Counsel reads this copy along with the new
 * policy text before scripts/ops/send-policy-notice.ts is ever run.
 *
 * Dates come from lib/legal/policyUpdate.ts so the email, the banners and the
 * page switch can never disagree.
 */

interface PolicyUpdateNoticeEmailProps {
  siteUrl?: string
}

export function policyUpdateNoticeSubject(): string {
  return `We're updating our Privacy Policy and Terms on ${POLICY_UPDATE.effectiveOnLabel}`
}

export function PolicyUpdateNoticeEmail({
  siteUrl = 'https://theblacqlist.com',
}: PolicyUpdateNoticeEmailProps) {
  const effective = POLICY_UPDATE.effectiveOnLabel

  return (
    <Html lang="en">
      <Head />
      <Preview>{`What's changing on ${effective}. You don't need to do anything.`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logoText}>THE BLACQLIST</Text>
          </Section>

          <Section style={content}>
            <Text style={eyebrow}>Policy update</Text>
            <Text style={heading}>We&rsquo;re updating our Privacy Policy and Terms</Text>

            <Text style={paragraph}>
              On {effective}, updated versions of our Privacy Policy, Terms of Service, and Cookie
              Policy take effect. Here&rsquo;s what&rsquo;s changing.
            </Text>

            <Text style={item}>
              <strong style={itemTitle}>Optional AI writing help for business owners.</strong>{' '}
              Owners can ask for drafts of their page&rsquo;s tagline, About section, and search
              text. To write them, we send a short, cleaned description of the business to
              Anthropic, the company that makes the Claude AI model. We take out email addresses,
              phone numbers, street addresses, and the owner&rsquo;s name first, and we never attach
              account details or receipts. Nothing goes on a page until the owner chooses to use it.
            </Text>
            <Text style={item}>
              <strong style={itemTitle}>Bringing in a website.</strong> Owners can give us a link to
              their business website to fill in their page draft. We read that public page once,
              when they ask, and keep only what they save.
            </Text>
            <Text style={item}>
              <strong style={itemTitle}>Bot protection.</strong> We now name Cloudflare Turnstile,
              which checks that a person, not a bot, is using forms like sign-up and sign-in.
            </Text>
            <Text style={item}>
              <strong style={itemTitle}>Clearer wording.</strong> We now say plainly that The
              BLACQList centers Black-owned businesses and also lists Ally businesses that support
              them.
            </Text>

            <Button href={`${siteUrl}/privacy/upcoming`} style={button}>
              Read the updated Privacy Policy
            </Button>

            <Text style={paragraph}>
              You can also read the updated{' '}
              <a href={`${siteUrl}/terms/upcoming`} style={inlineLink}>
                Terms of Service
              </a>{' '}
              and{' '}
              <a href={`${siteUrl}/cookies/upcoming`} style={inlineLink}>
                Cookie Policy
              </a>
              .
            </Text>

            <Hr style={divider} />

            <Text style={paragraph}>
              You don&rsquo;t need to do anything. If you keep using The BLACQList on or after{' '}
              {effective}, the updated versions apply. If you don&rsquo;t agree with them, you can
              delete your account in your account settings before then.
            </Text>
            <Text style={paragraph}>
              Questions? Email us at{' '}
              <a href="mailto:privacy@theblacqlist.com" style={inlineLink}>
                privacy@theblacqlist.com
              </a>
              .
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              You&rsquo;re getting this because you have an account on The BLACQList. We send
              policy notices like this one to every account.
            </Text>
            <Text style={footerText}>
              The BLACQList, LLC · 3133 Maple Dr NE, Ste 240 #1130 · Atlanta, GA 30305
            </Text>
            <Text style={footerText}>
              <a href={siteUrl} style={footerLink}>
                theblacqlist.com
              </a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const body: React.CSSProperties = {
  backgroundColor: '#F5F5F0',
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  margin: 0,
  padding: '24px 0',
}

const container: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: '8px',
  maxWidth: '560px',
  margin: '0 auto',
  overflow: 'hidden',
}

const header: React.CSSProperties = {
  backgroundColor: '#08080A',
  padding: '24px 32px',
}

const logoText: React.CSSProperties = {
  color: '#C4A065',
  fontSize: '18px',
  fontWeight: '700',
  letterSpacing: '0.12em',
  margin: 0,
}

const content: React.CSSProperties = {
  padding: '32px 32px 24px',
}

const eyebrow: React.CSSProperties = {
  color: '#8F6600',
  fontSize: '11px',
  fontWeight: '700',
  letterSpacing: '0.12em',
  margin: '0 0 8px',
  textTransform: 'uppercase',
}

const heading: React.CSSProperties = {
  color: '#000000',
  fontSize: '22px',
  fontWeight: '700',
  lineHeight: '1.25',
  margin: '0 0 16px',
}

const paragraph: React.CSSProperties = {
  color: '#595758',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 16px',
}

const item: React.CSSProperties = {
  color: '#595758',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 14px',
}

const itemTitle: React.CSSProperties = {
  color: '#08080A',
}

const button: React.CSSProperties = {
  backgroundColor: '#8F6600',
  borderRadius: '100px',
  color: '#FFFFFF',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '700',
  margin: '8px 0 16px',
  padding: '12px 28px',
  textDecoration: 'none',
}

const inlineLink: React.CSSProperties = {
  color: '#8F6600',
  textDecoration: 'underline',
}

const divider: React.CSSProperties = {
  borderColor: '#ECEAE6',
  margin: '8px 0 24px',
}

const footer: React.CSSProperties = {
  backgroundColor: '#F5F5F0',
  padding: '20px 32px',
  textAlign: 'center',
}

const footerText: React.CSSProperties = {
  color: '#9B9B9B',
  fontSize: '12px',
  lineHeight: '1.6',
  margin: '0 0 6px',
}

const footerLink: React.CSSProperties = {
  color: '#9B9B9B',
  textDecoration: 'underline',
}
