/**
 * Meta Graph API client for The BLACQList ops bundle.
 *
 * Talks to the Facebook Graph API for a Facebook Page + linked Instagram
 * Business/Creator account — comments, mentions, DMs, insights, and publishing.
 * Base host is graph.facebook.com (NOT graph.instagram.com).
 *
 * One-time setup (Meta app, Page, IG Business link, permissions, App Review,
 * long-lived token) is documented in docs/blacqlist/ops/runbooks/meta-setup.md.
 *
 * Convention mirrors lib/stripe/client.ts (env-driven), but exposes a factory
 * rather than a module-load singleton so CLI scripts can validate env and exit
 * cleanly before constructing the client.
 */

export interface MetaEnv {
  token: string
  pageId: string
  igBusinessId: string
  version: string
}

type QueryParams = Record<string, string | number | undefined>

export interface MetaClient {
  env: MetaEnv
  /** GET graph.facebook.com/{version}/{path} */
  get<T = unknown>(path: string, params?: QueryParams): Promise<T>
  /** POST graph.facebook.com/{version}/{path} (form-encoded body) */
  post<T = unknown>(path: string, params?: QueryParams): Promise<T>
}

const GRAPH_HOST = 'https://graph.facebook.com'

/** Required env var names — used for friendly error messages in scripts. */
export const META_REQUIRED_ENV = [
  'META_PAGE_ACCESS_TOKEN',
  'META_PAGE_ID',
  'META_IG_BUSINESS_ID',
] as const

/** Returns the list of required Meta env vars that are not set. */
export function missingMetaEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  return META_REQUIRED_ENV.filter((key) => !env[key])
}

interface MetaError {
  error?: { message?: string; type?: string; code?: number }
}

export function createMetaClient(env: NodeJS.ProcessEnv = process.env): MetaClient {
  const missing = missingMetaEnv(env)
  if (missing.length > 0) {
    throw new Error(
      `Meta Graph API not configured — missing: ${missing.join(', ')}. ` +
        `See docs/blacqlist/ops/runbooks/meta-setup.md`
    )
  }

  const meta: MetaEnv = {
    token: env.META_PAGE_ACCESS_TOKEN as string,
    pageId: env.META_PAGE_ID as string,
    igBusinessId: env.META_IG_BUSINESS_ID as string,
    version: env.META_GRAPH_VERSION ?? 'v22.0',
  }

  async function call<T>(method: 'GET' | 'POST', path: string, params: QueryParams = {}): Promise<T> {
    const url = new URL(`${GRAPH_HOST}/${meta.version}/${path.replace(/^\//, '')}`)
    const search = new URLSearchParams()
    search.set('access_token', meta.token)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) search.set(key, String(value))
    }

    let response: Response
    if (method === 'GET') {
      url.search = search.toString()
      response = await fetch(url, { method })
    } else {
      response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: search.toString(),
      })
    }

    const json = (await response.json()) as T & MetaError
    if (!response.ok || json.error) {
      throw new Error(
        `Meta API ${method} ${path} failed (${response.status}): ${json.error?.message ?? response.statusText}`
      )
    }
    return json
  }

  return {
    env: meta,
    get: (path, params) => call('GET', path, params),
    post: (path, params) => call('POST', path, params),
  }
}
