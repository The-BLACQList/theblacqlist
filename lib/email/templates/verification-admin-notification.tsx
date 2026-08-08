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

interface VerificationAdminNotificationEmailProps {
  listingName: string
  listingId: string
  ownerEmail: string
  documentCount: number
  adminUrl?: string
}

export function VerificationAdminNotificationEmail({
  listingName,
  listingId,
  ownerEmail,
  documentCount,
  adminUrl = 'https://theblacqlist.com/admin/verification',
}: VerificationAdminNotificationEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Verification requested for {listingName} — founder review required.</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>THE BLACQLIST</Text>
            <Text style={adminBadge}>Admin Notification</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Text style={eyebrow}>Verification Request</Text>
            <Text style={heading}>{listingName} requested verification.</Text>
            <Text style={paragraph}>
              A claimed listing has submitted documents for the Verified badge. Verification grants
              are founder-level and are never batched — review the documents individually against
              the evidence bar before deciding.
            </Text>

            <Hr style={divider} />

            <Text style={metaLabel}>Listing</Text>
            <Text style={metaValue}>{listingName}</Text>

            <Text style={metaLabel}>Listing ID</Text>
            <Text style={metaValue}>{listingId}</Text>

            <Text style={metaLabel}>Owner email</Text>
            <Text style={metaValue}>{ownerEmail}</Text>

            <Text style={metaLabel}>Documents submitted</Text>
            <Text style={metaValue}>{documentCount}</Text>

            <Hr style={divider} />

            <Button href={`${adminUrl}/${listingId}`} style={button}>
              Review This Request
            </Button>

            <Text style={footnote}>
              This is an automated notification sent to BLACQList administrators. Do not reply to
              this email.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} The BLACQList. All rights reserved.
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
  padding: '20px 32px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const logoText: React.CSSProperties = {
  color: '#C4A065',
  fontSize: '18px',
  fontWeight: '700',
  letterSpacing: '0.12em',
  margin: 0,
}

const adminBadge: React.CSSProperties = {
  color: '#9B9B9B',
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '0.08em',
  margin: 0,
  textTransform: 'uppercase',
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

const footnote: React.CSSProperties = {
  color: '#9B9B9B',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '8px 0 0',
}

const footer: React.CSSProperties = {
  backgroundColor: '#F5F5F0',
  padding: '20px 32px',
  textAlign: 'center',
}

const footerText: React.CSSProperties = {
  color: '#9B9B9B',
  fontSize: '12px',
  margin: 0,
}
