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
import { countedLine } from '@/lib/spend/receipt-emails'
import { JOINED_MAP_LINE, OFF_MAP_LINE, countedReceiptHref } from '@/lib/spend/counted-receipt'

interface ReceiptCountedEmailProps {
  receiptId: string
  amountCents: number
  businessName: string
  /** False for an unlisted business or a receipt kept out of the totals. */
  joinedMap?: boolean
  siteUrl?: string
}

/**
 * Sent when the founder approves a receipt (ticket 165). The shopper can turn
 * it off on /account/settings, and the footer says where. The button opens
 * the counted screen (ticket 166).
 */
export function ReceiptCountedEmail({
  receiptId,
  amountCents,
  businessName,
  joinedMap = true,
  siteUrl = 'https://theblacqlist.com',
}: ReceiptCountedEmailProps) {
  const line = countedLine(amountCents, businessName)
  const mapLine = joinedMap ? JOINED_MAP_LINE : OFF_MAP_LINE
  return (
    <Html lang="en">
      <Head />
      <Preview>
        {line} {mapLine}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>THE BLACQLIST</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Text style={eyebrow}>Receipt counted</Text>
            <Text style={heading}>{line}</Text>
            <Text style={paragraph}>{mapLine}</Text>

            <Button href={`${siteUrl}${countedReceiptHref(receiptId)}`} style={button}>
              {joinedMap ? 'See it on the map' : 'See your receipt'}
            </Button>

            <Hr style={divider} />

            <Text style={paragraph}>
              Don&apos;t want an email each time a receipt is counted?{' '}
              <a href={`${siteUrl}/account/settings`} style={link}>
                Turn these off in your settings.
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
  color: '#22C55E',
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
