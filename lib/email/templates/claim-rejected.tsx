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
} from "@react-email/components"

interface ClaimRejectedEmailProps {
  listingName: string
  reason: string
  siteUrl?: string
}

export function ClaimRejectedEmail({
  listingName,
  reason,
  siteUrl = "https://theblacqlist.com",
}: ClaimRejectedEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>An update on your claim for {listingName} — next steps inside.</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>THE BLACQLIST</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Text style={eyebrow}>Claim Update</Text>
            <Text style={heading}>
              We were unable to verify your claim for {listingName}.
            </Text>
            <Text style={paragraph}>
              After reviewing your submission, our team was not able to verify ownership of this
              listing at this time.
            </Text>

            <Section style={reasonBox}>
              <Text style={reasonLabel}>Reason provided</Text>
              <Text style={reasonText}>{reason}</Text>
            </Section>

            <Text style={paragraph}>
              If you believe this decision was made in error, or if you can provide additional
              documentation, please reach out to our support team. We want to make sure every
              legitimate owner gets access to their page.
            </Text>

            <Button href={`mailto:support@theblacqlist.com`} style={button}>
              Contact Support
            </Button>

            <Hr style={divider} />

            <Text style={paragraph}>
              You can also{" "}
              <a href={`${siteUrl}/for-business`} style={link}>
                submit a new claim
              </a>{" "}
              with updated information.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} The BLACQList. All rights reserved.
            </Text>
            <Text style={footerText}>
              <a href={siteUrl} style={footerLink}>theblacqlist.com</a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const body: React.CSSProperties = {
  backgroundColor: "#F5F5F0",
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "24px 0",
}

const container: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  borderRadius: "8px",
  maxWidth: "560px",
  margin: "0 auto",
  overflow: "hidden",
}

const header: React.CSSProperties = {
  backgroundColor: "#19191E",
  padding: "24px 32px",
}

const logoText: React.CSSProperties = {
  color: "#E2A428",
  fontSize: "18px",
  fontWeight: "700",
  letterSpacing: "0.12em",
  margin: 0,
}

const content: React.CSSProperties = {
  padding: "32px 32px 24px",
}

const eyebrow: React.CSSProperties = {
  color: "#595758",
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.12em",
  margin: "0 0 8px",
  textTransform: "uppercase",
}

const heading: React.CSSProperties = {
  color: "#000000",
  fontSize: "22px",
  fontWeight: "700",
  lineHeight: "1.25",
  margin: "0 0 16px",
}

const paragraph: React.CSSProperties = {
  color: "#595758",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 16px",
}

const reasonBox: React.CSSProperties = {
  backgroundColor: "#F5F5F0",
  borderLeft: "3px solid #E9E9F7",
  borderRadius: "4px",
  margin: "0 0 20px",
  padding: "14px 16px",
}

const reasonLabel: React.CSSProperties = {
  color: "#9B9B9B",
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.08em",
  margin: "0 0 6px",
  textTransform: "uppercase",
}

const reasonText: React.CSSProperties = {
  color: "#595758",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: 0,
}

const button: React.CSSProperties = {
  backgroundColor: "#19191E",
  borderRadius: "100px",
  color: "#FFFFFF",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "700",
  margin: "8px 0 24px",
  padding: "12px 28px",
  textDecoration: "none",
}

const divider: React.CSSProperties = {
  borderColor: "#E9E9F7",
  margin: "0 0 24px",
}

const link: React.CSSProperties = {
  color: "#E2A428",
  textDecoration: "underline",
}

const footer: React.CSSProperties = {
  backgroundColor: "#F5F5F0",
  padding: "20px 32px",
  textAlign: "center",
}

const footerText: React.CSSProperties = {
  color: "#9B9B9B",
  fontSize: "12px",
  margin: "0 0 4px",
}

const footerLink: React.CSSProperties = {
  color: "#9B9B9B",
  textDecoration: "underline",
}
