/**
 * pnpm email:export
 *
 * Renders the launch-list emails (W0, W1 A and B, E1 to E4) to static HTML and
 * plain text under email-previews/ (gitignored), for the founder to review and
 * to paste into a Resend broadcast. SENDS NOTHING: no Resend client is created
 * and no network call is made.
 *
 *   SENDER_POSTAL_ADDRESS   Read from the shell environment only. Unset or
 *                           blank, every email renders with the red
 *                           "POSTAL ADDRESS REQUIRED BEFORE SENDING" banner.
 *                           No .env file is read.
 *
 * The unsubscribe link is Resend's broadcast merge tag
 * {{{RESEND_UNSUBSCRIBE_URL}}}, which Resend fills in per recipient. The header
 * image points at a local copy of public/brand/blacqlist-lockup-email.png so
 * the previews open offline; the HTML for Resend should be re-exported with
 * EMAIL_EXPORT_HOSTED_LOGO=1, which uses https://theblacqlist.com/brand/... .
 *
 * Example:
 *   SENDER_POSTAL_ADDRESS="..." pnpm email:export
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { render } from '@react-email/components'
import type { ReactElement } from 'react'

import {
  E1_COPY,
  E2_COPY,
  E3_COPY,
  E4_COPY,
  W0_COPY,
  w1Copy,
  type LaunchEmailCopy,
} from '../lib/email/launch-copy'
import {
  LOCKUP_EMAIL_PATH,
  POSTAL_ADDRESS_REQUIRED_BANNER,
  type LaunchEmailFrameProps,
} from '../lib/email/templates/launch-layout'
import { LaunchW0OnTheListEmail } from '../lib/email/templates/launch-w0-on-the-list'
import { LaunchW1FirstLookEmail } from '../lib/email/templates/launch-w1-first-look'
import { LaunchE1LiveEmail } from '../lib/email/templates/launch-e1-live'
import { LaunchE2YourPageEmail } from '../lib/email/templates/launch-e2-your-page'
import { LaunchE3SaveEmail } from '../lib/email/templates/launch-e3-save'
import { LaunchE4TwoWeeksEmail } from '../lib/email/templates/launch-e4-two-weeks'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'email-previews')
const RESEND_UNSUBSCRIBE_MERGE_TAG = '{{{RESEND_UNSUBSCRIBE_URL}}}'

const postalAddress = process.env.SENDER_POSTAL_ADDRESS?.trim() || null
const hostedLogo = process.env.EMAIL_EXPORT_HOSTED_LOGO === '1'

mkdirSync(OUT_DIR, { recursive: true })

let logoSrc: string | undefined
if (!hostedLogo) {
  const logoFile = path.basename(LOCKUP_EMAIL_PATH)
  copyFileSync(path.join(ROOT, 'public', LOCKUP_EMAIL_PATH), path.join(OUT_DIR, logoFile))
  logoSrc = logoFile
}

const frame: LaunchEmailFrameProps = {
  unsubscribeUrl: RESEND_UNSUBSCRIBE_MERGE_TAG,
  postalAddress,
  logoSrc,
}

interface Entry {
  file: string
  label: string
  copy: LaunchEmailCopy
  element: ReactElement
}

const ENTRIES: Entry[] = [
  { file: 'w0-on-the-list', label: 'W0 (automatic on signup)', copy: W0_COPY, element: <LaunchW0OnTheListEmail {...frame} /> },
  { file: 'w1-first-look-A', label: 'W1, opening A (W0 was sent)', copy: w1Copy('A'), element: <LaunchW1FirstLookEmail opening="A" {...frame} /> },
  { file: 'w1-first-look-B', label: 'W1, opening B (W0 was skipped)', copy: w1Copy('B'), element: <LaunchW1FirstLookEmail opening="B" {...frame} /> },
  { file: 'e1-live', label: 'E1, launch day', copy: E1_COPY, element: <LaunchE1LiveEmail {...frame} /> },
  { file: 'e2-your-page', label: 'E2', copy: E2_COPY, element: <LaunchE2YourPageEmail {...frame} /> },
  { file: 'e3-save', label: 'E3', copy: E3_COPY, element: <LaunchE3SaveEmail {...frame} /> },
  { file: 'e4-two-weeks', label: 'E4', copy: E4_COPY, element: <LaunchE4TwoWeeksEmail {...frame} /> },
]

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function main() {
  const rows: string[] = []
  for (const entry of ENTRIES) {
    const html = await render(entry.element)
    const text = await render(entry.element, { plainText: true })
    writeFileSync(path.join(OUT_DIR, `${entry.file}.html`), html)
    writeFileSync(path.join(OUT_DIR, `${entry.file}.txt`), text)
    rows.push(
      `<tr><td><a href="${entry.file}.html">${escapeHtml(entry.label)}</a><br><a href="${entry.file}.txt">plain text</a></td>` +
        `<td>${escapeHtml(entry.copy.subjects[0])}<br><small>alt: ${escapeHtml(entry.copy.subjects[1])}</small></td>` +
        `<td>${escapeHtml(entry.copy.preheader)}</td></tr>`
    )
    console.log(`  wrote email-previews/${entry.file}.html and .txt`)
  }

  const banner = postalAddress
    ? ''
    : `<p style="background:#B00020;color:#fff;padding:12px;font-weight:bold">${POSTAL_ADDRESS_REQUIRED_BANNER}: SENDER_POSTAL_ADDRESS was not set, so every email carries the banner.</p>`

  const index = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Launch email previews</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;max-width:1100px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;vertical-align:top;text-align:left}</style>
</head><body>
<h1>Launch email previews</h1>
<p>Local previews only. Nothing here has been sent. Every email is prepared_awaiting_approval (send_email gate).</p>
${banner}
<table><thead><tr><th>Email</th><th>Subject (primary, alternate)</th><th>Preheader</th></tr></thead>
<tbody>
${rows.join('\n')}
</tbody></table>
<p>Unsubscribe links use Resend's broadcast merge tag ${escapeHtml(RESEND_UNSUBSCRIBE_MERGE_TAG)}. ${
    hostedLogo ? 'Header image: hosted URL.' : 'Header image: local copy (re-export with EMAIL_EXPORT_HOSTED_LOGO=1 for Resend).'
  }</p>
</body></html>
`
  writeFileSync(path.join(OUT_DIR, 'index.html'), index)

  console.log(`\nWrote ${ENTRIES.length} emails to email-previews/ (open index.html). Nothing was sent.`)
  if (!postalAddress) {
    console.log(`\n${POSTAL_ADDRESS_REQUIRED_BANNER}: set SENDER_POSTAL_ADDRESS and re-run.`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
