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
import { ADMIN_FALLBACK_DAYS, receiptToVerifyLine } from '@/lib/spend/owner-receipts'

interface ReceiptToVerifyEmailProps {
  /** First name and last initial only, e.g. "Jordan S.". */
  buyer: string
  businessName: string
  siteUrl?: string
}

/**
 * Sent to a business owner when a shopper uploads a receipt for their business
 * (ticket 183). No amount and no receipt in the email: the owner checks those
 * on the dashboard, behind sign-in.
 */
export function ReceiptToVerifyEmail({
  buyer,
  businessName,
  siteUrl = 'https://theblacqlist.com',
}: ReceiptToVerifyEmailProps) {
  const line = receiptToVerifyLine(buyer, businessName)
  return (
    <Html lang="en">
      <Head />
      <Preview>{line} Take a look and verify it.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logoText}>THE BLACQLIST</Text>
          </Section>

          <Section style={content}>
            <Text style={eyebrow}>A receipt to verify</Text>
            <Text style={heading}>{line}</Text>
            <Text style={paragraph}>
              They uploaded a receipt to show it. Check it against your own records. Once you verify
              it, their purchase counts toward The Collective and they can share that you verified
              it.
            </Text>

            <Button href={`${siteUrl}/dashboard/receipts`} style={button}>
              Verify the receipt
            </Button>

            <Hr style={divider} />

            <Text style={paragraph}>
              If you haven&apos;t checked it in {ADMIN_FALLBACK_DAYS} days, The BLACQList team will
              check it for you.
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
