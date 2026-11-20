/**
 * Ticket 235: sent when a paid job posting's payment lands and the role moves
 * into review (handleCheckoutSessionCompleted). Before this, the poster paid
 * $9.99 and heard nothing from the site until a moderator acted.
 *
 * Same layout as the other templates. Two colours differ on purpose: the
 * eyebrow green and the footer grey are darker than the older templates' so
 * both pass 4.5:1 on their backgrounds.
 */

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

import { SUPPORT_EMAIL } from '@/lib/email/support'

interface JobPostingPaidEmailProps {
  jobTitle: string
  /** What Stripe says was charged, e.g. "$9.99". Left out when nothing was charged. */
  amount?: string | null
  /** The poster's "Your role is in review" page. */
  roleUrl: string
  siteUrl?: string
}

export function jobPostingPaidSubject(jobTitle: string): string {
  return `Payment Received for ${jobTitle}`
}

export function JobPostingPaidEmail({
  jobTitle,
  amount,
  roleUrl,
  siteUrl = 'https://theblacqlist.com',
}: JobPostingPaidEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>We got your payment for {jobTitle}. Your role is in review.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logoText}>THE BLACQLIST</Text>
          </Section>

          <Section style={content}>
            <Text style={eyebrow}>Payment Received</Text>
            <Text style={heading}>Your Role Is in Review</Text>
            <Text style={paragraph}>
              Thanks for posting {jobTitle}.{' '}
              {amount ? <>We received your payment of {amount}.</> : <>We received your payment.</>}
            </Text>
            <Text style={paragraph}>
              Our team reviews every role before it goes on the job board. That usually takes 3 to 5
              business days, and we&apos;ll email you when it&apos;s live. Your 30 days on the board
              start the day it goes live.
            </Text>

            <Button href={roleUrl} style={button}>
              See Your Role
            </Button>

            <Hr style={divider} />

            <Text style={paragraph}>
              Questions about this charge? Email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} style={link}>
                {SUPPORT_EMAIL}
              </a>
              .
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} The BLACQList. All rights reserved.
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
  color: '#15803D',
  fontSize: '14px',
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

const button: React.CSSProperties = {
  backgroundColor: '#8F6600',
  borderRadius: '100px',
  color: '#FFFFFF',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '700',
  margin: '8px 0 24px',
  padding: '12px 28px',
  textDecoration: 'none',
}

const divider: React.CSSProperties = {
  borderColor: '#ECEAE6',
  margin: '0 0 24px',
}

const link: React.CSSProperties = {
  color: '#8F6600',
  textDecoration: 'underline',
}

const footer: React.CSSProperties = {
  backgroundColor: '#F5F5F0',
  padding: '20px 32px',
  textAlign: 'center',
}

const footerText: React.CSSProperties = {
  color: '#6B6B6B',
  fontSize: '14px',
  margin: '0 0 4px',
}

const footerLink: React.CSSProperties = {
  color: '#6B6B6B',
  textDecoration: 'underline',
}
