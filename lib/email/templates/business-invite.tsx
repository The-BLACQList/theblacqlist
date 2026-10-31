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
import {
  ADD_BUSINESS_PATH,
  BUSINESS_INVITE_ADDRESS,
  BUSINESS_INVITE_STOP_LINE,
  businessInviteBody,
} from '@/lib/spend/unlisted'

interface BusinessInviteEmailProps {
  businessName: string
  siteUrl?: string
}

/**
 * The founder's one-to-one invite to a business shoppers buy from that is not
 * on The BLACQList yet (ticket 168, O2 B). Sent one at a time from
 * /admin/receipts/unlisted, never in bulk. The footer carries our physical
 * address and the STOP line.
 */
export function BusinessInviteEmail({
  businessName,
  siteUrl = 'https://theblacqlist.com',
}: BusinessInviteEmailProps) {
  const bodyLine = businessInviteBody(businessName, siteUrl)
  return (
    <Html lang="en">
      <Head />
      <Preview>{bodyLine}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>THE BLACQLIST</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Text style={paragraph}>{bodyLine}</Text>

            <Button href={`${siteUrl}${ADD_BUSINESS_PATH}`} style={button}>
              Add your business
            </Button>

            <Hr style={divider} />
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>{BUSINESS_INVITE_ADDRESS}</Text>
            <Text style={footerText}>{BUSINESS_INVITE_STOP_LINE}</Text>
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
  padding: '32px 32px 0',
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
  margin: '0 0 8px',
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
