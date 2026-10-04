import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import type { LaunchEmailCopy } from '@/lib/email/launch-copy'

/**
 * Shared frame for the launch-list emails (W0, W1, E1 to E4).
 *
 * Header: the outlined lockup (public/brand/blacqlist-lockup-email.png, white
 * wordmark and gold node-Q) on #08080A. Body: black text on white, amber
 * #8F6600 buttons, the light-ground pairing from the brand guidelines. Type is
 * Jost for the button and Inter for the body, each falling back to the system
 * stack, because most mail clients ignore web fonts.
 *
 * Footer: an unsubscribe link and the sender's postal address, both required
 * on every send (CAN-SPAM / CASL). When the address is missing the email
 * renders a red banner across the top instead of quietly omitting it, so a
 * preview or test send cannot be mistaken for a sendable one.
 *
 * Copy is passed in from lib/email/launch-copy.ts and rendered as given.
 */

export const POSTAL_ADDRESS_REQUIRED_BANNER = 'POSTAL ADDRESS REQUIRED BEFORE SENDING'

export const DEFAULT_SITE_URL = 'https://theblacqlist.com'
export const LOCKUP_EMAIL_PATH = '/brand/blacqlist-lockup-email.png'

export interface LaunchEmailFrameProps {
  /**
   * Where the unsubscribe link points. Broadcasts sent from Resend pass the
   * merge tag {{{RESEND_UNSUBSCRIBE_URL}}}; W0 passes LAUNCH_UNSUBSCRIBE_URL.
   * Required, with no default, so no email renders without one.
   */
  unsubscribeUrl: string
  /** SENDER_POSTAL_ADDRESS. Missing or blank renders the red banner. */
  postalAddress?: string | null
  siteUrl?: string
  /** Override for the header image (the preview export uses a local copy). */
  logoSrc?: string
}

interface LaunchLayoutProps extends LaunchEmailFrameProps {
  copy: LaunchEmailCopy
}

export function LaunchLayout({
  copy,
  unsubscribeUrl,
  postalAddress,
  siteUrl = DEFAULT_SITE_URL,
  logoSrc,
}: LaunchLayoutProps) {
  const address = postalAddress?.trim() || null
  const logo = logoSrc ?? `${siteUrl}${LOCKUP_EMAIL_PATH}`

  return (
    <Html lang="en">
      <Head />
      <Preview>{copy.preheader}</Preview>
      <Body style={body}>
        <Container style={container}>
          {!address && (
            <Section style={banner}>
              <Text style={bannerText}>{POSTAL_ADDRESS_REQUIRED_BANNER}</Text>
            </Section>
          )}

          {/* Header */}
          <Section style={header}>
            <Link href={siteUrl}>
              <Img src={logo} width="220" height="76" alt="The BLACQList" style={logoImg} />
            </Link>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Text style={paragraph}>{copy.greeting}</Text>

            {copy.body.map((block, i) =>
              block.kind === 'quote' ? (
                <Section key={i} style={quote}>
                  <Text style={quoteText}>{block.text}</Text>
                </Section>
              ) : (
                <Text key={i} style={paragraph}>
                  {block.text}
                </Text>
              )
            )}

            <Button href={copy.cta.href} style={button}>
              {copy.cta.label}
            </Button>

            {copy.signature && (
              <Text style={signature}>
                {copy.signature.name}
                <br />
                {copy.signature.title}
              </Text>
            )}

            {copy.ps && (
              <Text style={ps}>
                <strong>P.S.</strong> {copy.ps.lead}
                <Link href={copy.ps.url} style={inlineLink}>
                  {copy.ps.url}
                </Link>
                {copy.ps.tail}
              </Text>
            )}
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>The BLACQList</Text>
            {address && <Text style={footerText}>{address}</Text>}
            <Text style={footerText}>
              <Link href={unsubscribeUrl} style={footerLink}>
                Unsubscribe
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const BODY_FONT =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif"
const DISPLAY_FONT =
  "Jost, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif"

const body: React.CSSProperties = {
  backgroundColor: '#F5F5F0',
  fontFamily: BODY_FONT,
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

const banner: React.CSSProperties = {
  backgroundColor: '#B42318',
  padding: '12px 32px',
}

const bannerText: React.CSSProperties = {
  color: '#FFFFFF',
  fontFamily: BODY_FONT,
  fontSize: '13px',
  fontWeight: '700',
  letterSpacing: '0.06em',
  margin: 0,
  textAlign: 'center',
}

const header: React.CSSProperties = {
  backgroundColor: '#08080A',
  padding: '24px 32px',
  textAlign: 'center',
}

const logoImg: React.CSSProperties = {
  display: 'inline-block',
  border: 0,
  height: '76px',
  width: '220px',
}

const content: React.CSSProperties = {
  padding: '32px 32px 24px',
}

const paragraph: React.CSSProperties = {
  color: '#000000',
  fontFamily: BODY_FONT,
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 16px',
}

const quote: React.CSSProperties = {
  backgroundColor: '#FAF6EC',
  borderLeft: '3px solid #C4A065',
  borderRadius: '4px',
  margin: '0 0 16px',
  padding: '14px 18px',
}

const quoteText: React.CSSProperties = {
  color: '#000000',
  fontFamily: BODY_FONT,
  fontSize: '14px',
  lineHeight: '1.6',
  margin: 0,
  wordBreak: 'break-word',
}

const button: React.CSSProperties = {
  backgroundColor: '#8F6600',
  borderRadius: '100px',
  color: '#FFFFFF',
  display: 'inline-block',
  fontFamily: DISPLAY_FONT,
  fontSize: '15px',
  fontWeight: '600',
  margin: '8px 0 24px',
  padding: '12px 28px',
  textDecoration: 'none',
}

const signature: React.CSSProperties = {
  color: '#000000',
  fontFamily: BODY_FONT,
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 16px',
}

const ps: React.CSSProperties = {
  color: '#595758',
  fontFamily: BODY_FONT,
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '8px 0 0',
  wordBreak: 'break-word',
}

const inlineLink: React.CSSProperties = {
  color: '#8F6600',
  textDecoration: 'underline',
}

const footer: React.CSSProperties = {
  backgroundColor: '#F5F5F0',
  padding: '20px 32px',
  textAlign: 'center',
}

const footerText: React.CSSProperties = {
  color: '#595758',
  fontFamily: BODY_FONT,
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0 0 4px',
}

const footerLink: React.CSSProperties = {
  color: '#595758',
  textDecoration: 'underline',
}
