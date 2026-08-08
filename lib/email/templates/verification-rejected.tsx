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

interface VerificationRejectedEmailProps {
  listingName: string
  listingId: string
  /** Admin's verification_notes. May be null — the copy adapts rather than rendering an empty box. */
  notes: string | null
  siteUrl?: string
}

export function VerificationRejectedEmail({
  listingName,
  listingId,
  notes,
  siteUrl = 'https://theblacqlist.com',
}: VerificationRejectedEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>An update on your verification request for {listingName}.</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>THE BLACQLIST</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Text style={eyebrow}>Verification Update</Text>
            <Text style={heading}>
              We couldn&apos;t verify {listingName} with the documents provided.
            </Text>
            <Text style={paragraph}>
              This is not a rejection of your business, and it does not affect your claim — you keep
              full owner access to your page. It only means the documents we received weren&apos;t
              enough to grant the Verified badge yet.
            </Text>

            {notes ? (
              <Section style={reasonBox}>
                <Text style={reasonLabel}>What our team noted</Text>
                <Text style={reasonText}>{notes}</Text>
              </Section>
            ) : (
              <Text style={paragraph}>
                Our team didn&apos;t leave a specific note on this one. Reach out and we&apos;ll
                tell you exactly what would clear the bar.
              </Text>
            )}

            <Text style={paragraph}>
              You can upload new documents any time — there&apos;s no waiting period and no limit on
              attempts.
            </Text>

            <Button href={`${siteUrl}/dashboard/pages/${listingId}/verification`} style={button}>
              Upload New Documents
            </Button>

            <Hr style={divider} />

            <Text style={paragraph}>
              Think this was a mistake?{' '}
              <a href="mailto:support@theblacqlist.com" style={link}>
                Contact support
              </a>{' '}
              and we&apos;ll take another look.
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
  color: '#595758',
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

const reasonBox: React.CSSProperties = {
  backgroundColor: '#F5F5F0',
  borderLeft: '3px solid #ECEAE6',
  borderRadius: '4px',
  margin: '0 0 20px',
  padding: '14px 16px',
}

const reasonLabel: React.CSSProperties = {
  color: '#9B9B9B',
  fontSize: '11px',
  fontWeight: '700',
  letterSpacing: '0.08em',
  margin: '0 0 6px',
  textTransform: 'uppercase',
}

const reasonText: React.CSSProperties = {
  color: '#595758',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: 0,
}

const button: React.CSSProperties = {
  backgroundColor: '#08080A',
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
