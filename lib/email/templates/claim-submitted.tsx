import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components'

interface ClaimSubmittedEmailProps {
  listingName: string
  claimId: string
  siteUrl?: string
}

export function ClaimSubmittedEmail({
  listingName,
  claimId,
  siteUrl = 'https://theblacqlist.com',
}: ClaimSubmittedEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your claim for {listingName} is under review. We&apos;ll be in touch soon.</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>THE BLACQLIST</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Text style={eyebrow}>Claim Submitted</Text>
            <Text style={heading}>We received your claim for {listingName}.</Text>
            <Text style={paragraph}>
              Our team will review your submission and verify the information you provided. This
              typically takes 2–3 business days.
            </Text>
            <Text style={paragraph}>
              You&apos;ll receive an email as soon as a decision has been made. In the meantime, you
              can check the status of your claim in your account dashboard.
            </Text>

            <Hr style={divider} />

            <Text style={metaLabel}>Claim reference</Text>
            <Text style={metaValue}>{claimId}</Text>

            <Hr style={divider} />

            <Text style={paragraph}>
              Have questions?{' '}
              <a href={`mailto:support@theblacqlist.com`} style={link}>
                Contact our support team
              </a>
              .
            </Text>
          </Section>

          {/* Footer */}
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

const divider: React.CSSProperties = {
  borderColor: '#ECEAE6',
  margin: '0 0 16px',
}

const metaLabel: React.CSSProperties = {
  color: '#9B9B9B',
  fontSize: '11px',
  fontWeight: '700',
  letterSpacing: '0.08em',
  margin: '0 0 4px',
  textTransform: 'uppercase',
}

const metaValue: React.CSSProperties = {
  color: '#595758',
  fontFamily: 'monospace',
  fontSize: '13px',
  margin: '0 0 16px',
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
