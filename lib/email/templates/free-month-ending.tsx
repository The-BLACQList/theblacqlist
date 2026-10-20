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

// The reminder five days before a tester's free month on a bigger plan ends
// (ticket 136). Copy approved by the founder before merge. The month needs
// nothing from them: it goes back to the plan they had on its own.

interface FreeMonthEndingEmailProps {
  /** e.g. "Growth" */
  tierName: string
  /** e.g. "Starter" */
  returnTierName: string
  /** Monthly price of the plan they go back to, in dollars. */
  returnPrice: number
  /** e.g. "November 19, 2026" */
  endsOn: string
  siteUrl?: string
}

export function freeMonthEndingSubject(tierName: string): string {
  return `Your free ${tierName} month ends soon`
}

export function FreeMonthEndingEmail({
  tierName,
  returnTierName,
  returnPrice,
  endsOn,
  siteUrl = 'https://theblacqlist.com',
}: FreeMonthEndingEmailProps) {
  const heading = `Your free ${tierName} month ends on ${endsOn}.`
  return (
    <Html lang="en">
      <Head />
      <Preview>{heading}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logoText}>THE BLACQLIST</Text>
          </Section>

          <Section style={content}>
            <Text style={eyebrow}>Your free month</Text>
            <Text style={headingStyle}>{heading}</Text>
            <Text style={paragraph}>
              {`You'll go back to ${returnTierName} at $${returnPrice}/month. Nothing to do if that's what you want.`}
            </Text>
            <Text style={paragraph}>
              {`If you'd rather end your plan when the free month ends, you can do that from your dashboard before ${endsOn}. You won't be charged.`}
            </Text>

            <Button href={`${siteUrl}/dashboard/upgrade#free-month`} style={button}>
              See your plan
            </Button>

            <Hr style={divider} />

            <Text style={paragraph}>
              Thank you for testing The BLACQList. Questions?{' '}
              <a href="mailto:support@theblacqlist.com" style={link}>
                support@theblacqlist.com
              </a>
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
  color: '#8F6600',
  fontSize: '11px',
  fontWeight: '700',
  letterSpacing: '0.12em',
  margin: '0 0 8px',
  textTransform: 'uppercase',
}

const headingStyle: React.CSSProperties = {
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
  color: '#9B9B9B',
  fontSize: '12px',
  margin: '0 0 4px',
}

const footerLink: React.CSSProperties = {
  color: '#9B9B9B',
  textDecoration: 'underline',
}
