/**
 * Exchange a short-lived Meta user access token for a long-lived one, then print
 * the long-lived Page token to paste into .env.local as META_PAGE_ACCESS_TOKEN.
 *
 * Does NOT write to disk — it only prints. Never commit the token.
 *
 * Usage:
 *   META_APP_ID=... META_APP_SECRET=... META_PAGE_ID=... \
 *   npx tsx scripts/meta/exchange-token.ts --short-token="EAAG..."
 *
 * See docs/blacqlist/ops/runbooks/meta-setup.md for how to obtain the short token.
 */
const GRAPH = 'https://graph.facebook.com/v22.0'

function arg(name: string): string | undefined {
  const prefix = `--${name}=`
  const match = process.argv.find((a) => a.startsWith(prefix))
  return match ? match.slice(prefix.length) : undefined
}

const appId = process.env.META_APP_ID
const appSecret = process.env.META_APP_SECRET
const pageId = process.env.META_PAGE_ID
const shortToken = arg('short-token')

const missing = [
  ['META_APP_ID', appId],
  ['META_APP_SECRET', appSecret],
  ['META_PAGE_ID', pageId],
].filter(([, v]) => !v).map(([k]) => k)

if (missing.length > 0 || !shortToken) {
  if (missing.length > 0) console.error(`Missing env: ${missing.join(', ')}`)
  if (!shortToken) console.error('Missing --short-token="..."')
  console.error('See docs/blacqlist/ops/runbooks/meta-setup.md')
  process.exit(1)
}

interface TokenResponse {
  access_token?: string
  error?: { message?: string }
}
interface PageAccounts {
  data?: Array<{ id: string; access_token?: string }>
  error?: { message?: string }
}

async function main(): Promise<void> {
  const longUrl = new URL(`${GRAPH}/oauth/access_token`)
  longUrl.search = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId as string,
    client_secret: appSecret as string,
    fb_exchange_token: shortToken as string,
  }).toString()

  const longRes = (await (await fetch(longUrl)).json()) as TokenResponse
  if (!longRes.access_token) {
    throw new Error(longRes.error?.message ?? 'token exchange failed')
  }
  console.log('[meta/exchange-token] long-lived USER token obtained.')

  const acctUrl = new URL(`${GRAPH}/me/accounts`)
  acctUrl.search = new URLSearchParams({ access_token: longRes.access_token }).toString()
  const accounts = (await (await fetch(acctUrl)).json()) as PageAccounts
  const page = accounts.data?.find((p) => p.id === pageId)

  if (page?.access_token) {
    console.log('\n[meta/exchange-token] Long-lived PAGE token (paste into .env.local):')
    console.log(`META_PAGE_ACCESS_TOKEN=${page.access_token}`)
  } else {
    console.log('\n[meta/exchange-token] Could not find a Page token for META_PAGE_ID.')
    console.log('Long-lived user token (fallback):')
    console.log(longRes.access_token)
  }
}

main().catch((err) => {
  console.error('[meta/exchange-token]', err)
  process.exit(1)
})
