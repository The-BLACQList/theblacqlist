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

export type CategoryRequestOutcome = 'added' | 'moved' | 'declined'

interface CategoryRequestUpdateEmailProps {
  listingId: string
  listingName: string
  /** The name the owner suggested. */
  proposedName: string
  outcome: CategoryRequestOutcome
  /** Where the page sits now: the new category, the one it moved to, or the one it stays in. */
  categoryName: string
  siteUrl?: string
}

// Sent when the team reviews a category an owner asked for on /add-business
// (ticket 126). The founder's rule: email the owner either way.
export function CategoryRequestUpdateEmail({
  listingId,
  listingName,
  proposedName,
  outcome,
  categoryName,
  siteUrl = 'https://theblacqlist.com',
}: CategoryRequestUpdateEmailProps) {
  const copy = {
    added: {
      preview: `${proposedName} is now a category on The BLACQList.`,
      heading: `${proposedName} is now a category.`,
      body: `Thanks for the suggestion. We added it and moved ${listingName} into it, so people looking for ${proposedName} can find you there.`,
    },
    moved: {
      preview: `We found a close fit for ${listingName}.`,
      heading: `We found a close fit for ${listingName}.`,
      body: `Instead of adding ${proposedName} as a new category, we moved your page to ${categoryName}, which already covers what you do.`,
    },
    declined: {
      preview: `An update on the category you suggested for ${listingName}.`,
      heading: 'An update on the category you suggested.',
      body: `We are not adding ${proposedName} as a category right now. Your page stays under ${categoryName}, so people can still find you there.`,
    },
  }[outcome]

  return (
    <Html lang="en">
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logoText}>THE BLACQLIST</Text>
          </Section>

          <Section style={content}>
            <Text style={eyebrow}>Category update</Text>
            <Text style={heading}>{copy.heading}</Text>
            <Text style={paragraph}>{copy.body}</Text>

            <Button href={`${siteUrl}/dashboard/pages/${listingId}/edit`} style={button}>
              See your page
            </Button>

            <Hr style={divider} />

            <Text style={paragraph}>
              {outcome === 'added'
                ? 'Questions? Write to us at '
                : 'If this does not feel right, write to us at '}
              <a href="mailto:support@theblacqlist.com" style={link}>
                support@theblacqlist.com
              </a>
              .
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
  color: '#595758',
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
  backgroundColor: '#08080A',
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
