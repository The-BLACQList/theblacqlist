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

// Sent to the support inbox for each new Report a Problem submission (user
// feedback plan, founder decision 2026-11-19: "Email each to support@"). The
// row is already in problem_reports; this only makes sure it is seen. Same
// shell as claim-admin-notification.tsx.

interface ProblemReportNotificationEmailProps {
  pagePath: string
  body: string
  role: string | null
  reporterEmail: string | null
  adminUrl?: string
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Business Owner',
  supporter: 'Member',
  admin: 'Admin',
  super_admin: 'Admin',
}

export function ProblemReportNotificationEmail({
  pagePath,
  body: message,
  role,
  reporterEmail,
  adminUrl = 'https://theblacqlist.com/admin/feedback',
}: ProblemReportNotificationEmailProps) {
  const roleLabel = role ? (ROLE_LABELS[role] ?? role) : 'Not Set'

  return (
    <Html lang="en">
      <Head />
      <Preview>New problem report on {pagePath}</Preview>
      <Body style={bodyStyle}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logoText}>THE BLACQLIST</Text>
            <Text style={adminBadge}>Admin Notification</Text>
          </Section>

          <Section style={content}>
            <Text style={eyebrow}>New Problem Report</Text>
            <Text style={heading}>Someone reported a problem on {pagePath}.</Text>

            <Text style={quote}>{message}</Text>

            <Hr style={divider} />

            <Text style={metaLabel}>Page</Text>
            <Text style={metaValue}>{pagePath}</Text>

            <Text style={metaLabel}>Account Type</Text>
            <Text style={metaValue}>{roleLabel}</Text>

            <Text style={metaLabel}>Reporter Email</Text>
            <Text style={metaValue}>{reporterEmail ?? 'Not Available'}</Text>

            <Hr style={divider} />

            <Button href={adminUrl} style={button}>
              Open the Feedback Queue
            </Button>

            <Text style={footnote}>
              Replying to this email writes to the person who sent the report. Set its status in the
              feedback queue once it is handled.
            </Text>
          </Section>

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

const bodyStyle: React.CSSProperties = {
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
  color: '#B5B5B5',
  fontSize: '14px',
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

const quote: React.CSSProperties = {
  borderLeft: '3px solid #8F6600',
  color: '#2B2B2B',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 16px',
  padding: '4px 0 4px 14px',
  whiteSpace: 'pre-wrap',
}

const divider: React.CSSProperties = {
  borderColor: '#ECEAE6',
  margin: '0 0 16px',
}

const metaLabel: React.CSSProperties = {
  color: '#6B6B6B',
  fontSize: '14px',
  fontWeight: '700',
  letterSpacing: '0.08em',
  margin: '0 0 4px',
  textTransform: 'uppercase',
}

const metaValue: React.CSSProperties = {
  color: '#2B2B2B',
  fontFamily: 'monospace',
  fontSize: '14px',
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
  color: '#6B6B6B',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '8px 0 0',
}

const footer: React.CSSProperties = {
  backgroundColor: '#F5F5F0',
  padding: '20px 32px',
  textAlign: 'center',
}

const footerText: React.CSSProperties = {
  color: '#6B6B6B',
  fontSize: '14px',
  margin: 0,
}
