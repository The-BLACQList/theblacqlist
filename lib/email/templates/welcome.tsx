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

interface WelcomeEmailProps {
  displayName: string
  siteUrl?: string
}

export function WelcomeEmail({
  displayName,
  siteUrl = 'https://theblacqlist.com',
}: WelcomeEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Welcome to The BLACQList. Find and support Black-owned businesses.</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>THE BLACQLIST</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Text style={heading}>Welcome, {displayName}.</Text>
            <Text style={paragraph}>
              You&apos;re now part of the national directory for Black-owned businesses, built by
              community and powered by culture.
            </Text>
            <Text style={paragraph}>
              Start by exploring businesses in your city, saving your favorites, and leaving reviews
              for places you love. Every interaction helps the community grow.
            </Text>

            <Button href={`${siteUrl}/discover`} style={button}>
              Explore Businesses
            </Button>

            <Hr style={divider} />

            <Text style={paragraph}>
              Own a Black-owned business?{' '}
              <a href={`${siteUrl}/for-business`} style={link}>
                Claim your free listing
              </a>{' '}
              and get found by the community that wants to support you.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} The BLACQList. All rights reserved.
            </Text>
            <Text style={footerText}>
              <a href={`${siteUrl}`} style={footerLink}>
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

const heading: React.CSSProperties = {
  color: '#000000',
  fontSize: '24px',
  fontWeight: '700',
  lineHeight: '1.2',
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
