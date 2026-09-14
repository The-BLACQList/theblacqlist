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

interface TesterInviteEmailProps {
  /**
   * The full preview URL, including the `?preview=` query.
   *
   * Required, and deliberately without a default. Two reasons:
   *  1. Forgetting it is a compile error, not an email that silently sends a
   *     door-less link to a gated site.
   *  2. A default would mean a token value living in this file. The token
   *     never appears in the repo — it is typed into /admin/email-preview at
   *     send time and passed in from there.
   */
  previewLink: string
  /** Optional: the greeting degrades to "You're in early." with no dangling comma. */
  firstName?: string | null
  siteUrl?: string
}

export function TesterInviteEmail({
  previewLink,
  firstName = null,
  siteUrl = 'https://theblacqlist.com',
}: TesterInviteEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        You&rsquo;re invited to add your business to The BLACQList before we open to the public.
      </Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>THE BLACQLIST</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Text style={eyebrow}>Private Preview</Text>
            <Text style={heading}>
              {firstName ? `You're in early, ${firstName}.` : "You're in early."}
            </Text>

            <Text style={paragraph}>
              The BLACQList isn&rsquo;t open to the public yet. We&rsquo;re bringing a small group
              of business owners in first to add their business, tell us what&rsquo;s confusing, and
              help us fix it before everyone else arrives.
            </Text>

            <Text style={paragraph}>
              <strong>Start with this link.</strong> It&rsquo;s your door in. It remembers you for 30
              days on whichever browser you open it in.
            </Text>

            <Button href={previewLink} style={button}>
              Start here
            </Button>

            <Text style={note}>
              If you ever land on a &ldquo;coming soon&rdquo; page, open this link again — that
              always puts you back in.
            </Text>

            <Hr style={divider} />

            <Text style={subheading}>What it takes — about ten minutes</Text>

            <Text style={step}>
              <strong style={stepNumber}>1.</strong> Create an account. When we ask what brings you
              here, pick <strong>&ldquo;I have a business.&rdquo;</strong>
            </Text>
            <Text style={step}>
              <strong style={stepNumber}>2.</strong> Confirm your email. We send a link — click it.
            </Text>
            <Text style={step}>
              <strong style={stepNumber}>3.</strong> Answer two quick questions.
            </Text>
            <Text style={step}>
              <strong style={stepNumber}>4.</strong> Fill in your business — the name, what you do,
              where you are, and a photo or two.
            </Text>
            <Text style={step}>
              <strong style={stepNumber}>5.</strong> We review it and email you when it&rsquo;s live.
            </Text>

            {/* The one callout that earns its place. This is the most common
                way the invite path breaks, and the fix is behavioral, not code. */}
            <Section style={callout}>
              <Text style={calloutTitle}>Open the confirmation email in the same browser.</Text>
              <Text style={calloutBody}>
                If you sign up on your laptop and then open our confirmation email on your phone,
                the link won&rsquo;t work. Same browser, same device — that&rsquo;s the one thing
                that trips people up.
              </Text>
            </Section>

            <Hr style={divider} />

            <Text style={paragraph}>
              Anything that looks wrong, reads wrong, or just doesn&rsquo;t work — reply to this
              email and tell us. Blunt is more useful to us than kind.
            </Text>

            <Text style={paragraph}>Thank you for being one of the first through the door.</Text>
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

const subheading: React.CSSProperties = {
  color: '#000000',
  fontSize: '16px',
  fontWeight: '700',
  lineHeight: '1.4',
  margin: '0 0 12px',
}

const paragraph: React.CSSProperties = {
  color: '#595758',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 16px',
}

const note: React.CSSProperties = {
  color: '#9B9B9B',
  fontSize: '13px',
  lineHeight: '1.6',
  margin: '0 0 24px',
}

const step: React.CSSProperties = {
  color: '#595758',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 10px',
}

const stepNumber: React.CSSProperties = {
  color: '#08080A',
}

const button: React.CSSProperties = {
  backgroundColor: '#8F6600',
  borderRadius: '100px',
  color: '#FFFFFF',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '700',
  margin: '8px 0 12px',
  padding: '12px 28px',
  textDecoration: 'none',
}

const callout: React.CSSProperties = {
  backgroundColor: '#FAF6EC',
  borderLeft: '3px solid #C4A065',
  borderRadius: '4px',
  margin: '20px 0 8px',
  padding: '16px 18px',
}

const calloutTitle: React.CSSProperties = {
  color: '#08080A',
  fontSize: '14px',
  fontWeight: '700',
  lineHeight: '1.4',
  margin: '0 0 6px',
}

const calloutBody: React.CSSProperties = {
  color: '#595758',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: 0,
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
