/**
 * Sent when an admin approves a submitted listing and it goes live.
 *
 * This template existed only as a promise until now. PublishSection.tsx:113
 * tells every owner "You'll receive an email when it's approved," and
 * `rejectEntityAction` has always sent one on the way down — but
 * `approveEntityAction` sent nothing on the way up. An owner who submitted a
 * listing and was approved heard silence.
 *
 * Structure and styles are copied from claim-approved.tsx verbatim. The other
 * eleven templates each carry their own copy of these style objects; a shared
 * layout is the right refactor and the wrong week for it.
 */

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

interface EntityApprovedEmailProps {
  listingName: string
  /**
   * Absolute URL of the live listing page. Optional because the action can
   * only build it when the listing has a slug and an entity type — a missing
   * URL must degrade to the dashboard button, never to a broken link or a
   * failed send.
   */
  listingUrl?: string | null
  siteUrl?: string
}

export function EntityApprovedEmail({
  listingName,
  listingUrl = null,
  siteUrl = 'https://theblacqlist.com',
}: EntityApprovedEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{listingName} is approved and live on The BLACQList.</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>THE BLACQLIST</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Text style={eyebrow}>Listing Approved</Text>
            <Text style={heading}>{listingName} is live on The BLACQList.</Text>
            <Text style={paragraph}>
              Your submission has been reviewed and published. People can now find {listingName}{' '}
              through search and browsing on The BLACQList.
            </Text>
            <Text style={paragraph}>
              The site is still in private preview, so you may need to be signed in to see your
              page. Once we open to the public, anyone with the link will be able to view it.
            </Text>

            <Button href={listingUrl ?? `${siteUrl}/dashboard`} style={button}>
              {listingUrl ? 'View your listing' : 'Go to your dashboard'}
            </Button>

            <Hr style={divider} />

            <Text style={paragraph}>
              You can update your details, add photos, and respond to reviews any time from{' '}
              <a href={`${siteUrl}/dashboard`} style={link}>
                your dashboard
              </a>
              . Need a hand?{' '}
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
