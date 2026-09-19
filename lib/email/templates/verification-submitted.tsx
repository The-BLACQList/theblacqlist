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

interface VerificationSubmittedEmailProps {
  listingName: string
  listingId: string
  siteUrl?: string
}

export function VerificationSubmittedEmail({
  listingName,
  listingId,
  siteUrl = 'https://theblacqlist.com',
}: VerificationSubmittedEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>We have your verification documents for {listingName}.</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>THE BLACQLIST</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Text style={eyebrow}>Verification Received</Text>
            <Text style={heading}>We have your documents for {listingName}.</Text>
            <Text style={paragraph}>
              Your verification request is in our review queue. Our team reviews documents within
              2–3 business days. Verification is a stronger trust signal than a claim, so every
              request is reviewed by hand. That is what makes the badge mean something.
            </Text>
            <Text style={paragraph}>
              You do not need to do anything else right now. We will email you as soon as a decision
              is made. If we need more documentation, we will tell you exactly what is missing.
            </Text>

            <Button href={`${siteUrl}/dashboard/pages/${listingId}/verification`} style={button}>
              View Your Request
            </Button>

            <Hr style={divider} />

            <Text style={paragraph}>
              Questions about verification?{' '}
              <a href="mailto:support@theblacqlist.com" style={link}>
                We&apos;re here to help.
              </a>
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
