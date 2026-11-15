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
import type { ReactNode } from 'react'

// Booking requests (ticket 109). Three emails:
//   - BookingRequestOwnerEmail: a visitor asked; to the page's owner, with
//     Reply-To set to the visitor so a plain reply reaches them.
//   - BookingRequestSentEmail: the visitor's copy of what they asked.
//   - BookingReplyEmail: the owner accepted, declined or suggested another
//     time; to the visitor, from noreply (the owner's sign-in email may be
//     personal), pointing them to the business's page.
// Nothing here is a booking until the owner says so, and every email says it.

export interface BookingSummary {
  /** "Sat, Dec 6 · Morning". */
  when: string
  service: string | null
  partySize: number | null
  note: string | null
}

function Details({ summary }: { summary: BookingSummary }) {
  return (
    <>
      <Text style={metaLabel}>When</Text>
      <Text style={metaValue}>{summary.when}</Text>
      {summary.service ? (
        <>
          <Text style={metaLabel}>Service</Text>
          <Text style={metaValue}>{summary.service}</Text>
        </>
      ) : null}
      {summary.partySize ? (
        <>
          <Text style={metaLabel}>Party Size</Text>
          <Text style={metaValue}>{summary.partySize}</Text>
        </>
      ) : null}
      {summary.note ? (
        <>
          <Text style={metaLabel}>Note</Text>
          <Text style={quote}>{summary.note}</Text>
        </>
      ) : null}
    </>
  )
}

function Shell({
  preview,
  siteUrl,
  children,
}: {
  preview: string
  siteUrl: string
  children: ReactNode
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logoText}>THE BLACQLIST</Text>
          </Section>
          <Section style={content}>{children}</Section>
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

interface OwnerEmailProps {
  businessName: string
  requesterName: string
  requesterEmail: string
  requesterPhone: string | null
  summary: BookingSummary
  inboxUrl: string
  siteUrl?: string
}

export function BookingRequestOwnerEmail({
  businessName,
  requesterName,
  requesterEmail,
  requesterPhone,
  summary,
  inboxUrl,
  siteUrl = 'https://theblacqlist.com',
}: OwnerEmailProps) {
  return (
    <Shell preview={`${requesterName} asked to book with ${businessName}.`} siteUrl={siteUrl}>
      <Text style={eyebrow}>New Booking Request</Text>
      <Text style={heading}>
        {requesterName} asked to book with {businessName}.
      </Text>
      <Text style={paragraph}>
        Nothing is booked yet. Accept it, decline it or suggest another time from your dashboard,
        and we&apos;ll email them your answer. You can also reply to this email to reach them
        directly.
      </Text>
      <Details summary={summary} />
      <Text style={metaLabel}>Email</Text>
      <Text style={metaValue}>{requesterEmail}</Text>
      {requesterPhone ? (
        <>
          <Text style={metaLabel}>Phone</Text>
          <Text style={metaValue}>{requesterPhone}</Text>
        </>
      ) : null}
      <Button href={inboxUrl} style={button}>
        Answer the Request
      </Button>
    </Shell>
  )
}

interface SentEmailProps {
  businessName: string
  summary: BookingSummary
  siteUrl?: string
}

export function BookingRequestSentEmail({
  businessName,
  summary,
  siteUrl = 'https://theblacqlist.com',
}: SentEmailProps) {
  return (
    <Shell preview={`Your request to ${businessName} is on its way.`} siteUrl={siteUrl}>
      <Text style={eyebrow}>Request Sent</Text>
      <Text style={heading}>Your request to {businessName} is on its way.</Text>
      <Text style={paragraph}>
        This isn&apos;t a booking yet. {businessName} will accept it, decline it or suggest another
        time, and we&apos;ll email you their answer.
      </Text>
      <Details summary={summary} />
      <Hr style={divider} />
      <Text style={small}>
        Didn&apos;t ask for this? Someone may have typed your address by mistake. You can ignore
        this email.
      </Text>
    </Shell>
  )
}

export type BookingReplyStatus = 'accepted' | 'declined' | 'proposed'

const REPLY_COPY: Record<
  BookingReplyStatus,
  { eyebrow: string; heading: (b: string) => string; body: string }
> = {
  accepted: {
    eyebrow: 'Request Accepted',
    heading: (b) => `${b} accepted your request.`,
    body: 'You’re booked for the time below. If anything changes, reach them through their page.',
  },
  declined: {
    eyebrow: 'Request Declined',
    heading: (b) => `${b} can’t take your request.`,
    body: 'They can’t make this one work. You’re welcome to ask for another time on their page.',
  },
  proposed: {
    eyebrow: 'Another Time Suggested',
    heading: (b) => `${b} suggested another time.`,
    body: 'Their note says what works for them. To take it, send a new request for that time or reach them through their page.',
  },
}

interface ReplyEmailProps {
  businessName: string
  status: BookingReplyStatus
  reply: string | null
  summary: BookingSummary
  pageUrl: string
  siteUrl?: string
}

export function BookingReplyEmail({
  businessName,
  status,
  reply,
  summary,
  pageUrl,
  siteUrl = 'https://theblacqlist.com',
}: ReplyEmailProps) {
  const copy = REPLY_COPY[status]
  const title = copy.heading(businessName)
  return (
    <Shell preview={title} siteUrl={siteUrl}>
      <Text style={eyebrow}>{copy.eyebrow}</Text>
      <Text style={heading}>{title}</Text>
      <Text style={paragraph}>{copy.body}</Text>
      {reply ? (
        <>
          <Text style={metaLabel}>Their Note</Text>
          <Text style={quote}>{reply}</Text>
        </>
      ) : null}
      <Hr style={divider} />
      <Text style={metaLabel}>You Asked For</Text>
      <Details summary={summary} />
      <Button href={pageUrl} style={button}>
        Visit {businessName}
      </Button>
    </Shell>
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

const paragraph: React.CSSProperties = {
  color: '#595758',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 16px',
}

const small: React.CSSProperties = {
  color: '#9B9B9B',
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '0 0 8px',
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
  color: '#2B2A2A',
  fontSize: '15px',
  margin: '0 0 16px',
}

const quote: React.CSSProperties = {
  borderLeft: '3px solid #C4A065',
  color: '#2B2A2A',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 16px',
  padding: '0 0 0 12px',
  whiteSpace: 'pre-wrap',
}

const button: React.CSSProperties = {
  backgroundColor: '#08080A',
  borderRadius: '6px',
  color: '#FFFFFF',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '700',
  margin: '8px 0 16px',
  padding: '12px 20px',
  textDecoration: 'none',
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
