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
import { FALLBACK_FIX_REASON } from '@/lib/spend/receipt-emails'
import { formatDollarsExact } from '@/lib/spend/personal-spend'

interface ReceiptNeedsFixEmailProps {
  receiptId: string
  /** The saved rejection_reason. Null falls back to a general line. */
  reason: string | null
  amountCents: number
  businessName: string
  siteUrl?: string
}

/** Ends the reason with a full stop unless it already has one. */
function asSentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`
}

/**
 * Sent when the founder rejects a receipt (ticket 165). Always sends: the
 * shopper started this and has one thing to do. The button opens the edit form.
 */
export function ReceiptNeedsFixEmail({
  receiptId,
  reason,
  amountCents,
  businessName,
  siteUrl = 'https://theblacqlist.com',
}: ReceiptNeedsFixEmailProps) {
  const why = asSentence(reason?.trim() || FALLBACK_FIX_REASON)
  return (
    <Html lang="en">
      <Head />
      <Preview>{why} Fix it and resend.</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>THE BLACQLIST</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Text style={eyebrow}>Receipt needs a fix</Text>
            <Text style={heading}>Your receipt needs a quick fix.</Text>
            <Text style={paragraph}>
              <strong>{why}</strong>
            </Text>
            <Text style={paragraph}>
              This is your {formatDollarsExact(amountCents)} receipt at {businessName}. Fix it and
              resend, and we&apos;ll take another look.
            </Text>

            <Button href={`${siteUrl}/account/receipts/${receiptId}/edit`} style={button}>
              Fix and resend
            </Button>

            <Hr style={divider} />

            <Text style={paragraph}>
              Questions about a receipt?{' '}
              <a href={`mailto:support@theblacqlist.com`} style={link}>
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
  color: '#B45309',
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
