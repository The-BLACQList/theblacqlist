// =============================================================================
// "Order on" platforms and "Find us at" stores (owner-experience round 2,
// part D, 2026-11-13)
// =============================================================================
// Order on: a page lists its store link on DoorDash, Grubhub, Instacart and
// Uber Eats (listing_order_platforms, migration 20261118000000). Each link must
// be https on that platform's own domain, so a button labelled "DoorDash" can't
// send anyone anywhere else.
//
// Find us at: the stores that carry a page's products (listing_stockists). A
// store is a chain from retail_chains or a name the owner types. Each has its
// own cities ("Atlanta, GA") and zips (listing_stockist_areas), or is marked
// nationwide. Discover's "Sold near" filter matches a zip, or any store marked
// nationwide.
//
// No plan check. Jobs and events can't list either.
//
// Pure and client-safe: the page read, the actions and the editors share it.
// =============================================================================

export const ORDER_PLATFORM_IDS = ['doordash', 'grubhub', 'instacart', 'ubereats'] as const
export type OrderPlatform = (typeof ORDER_PLATFORM_IDS)[number]

/**
 * The platforms, in the order the page shows them. `hosts` is the allowlist: a
 * link's host must be one of these or a subdomain of one (www., order., …).
 * order.online is DoorDash's own ordering site for restaurants.
 */
export const ORDER_PLATFORMS: Record<
  OrderPlatform,
  { label: string; hosts: readonly string[]; example: string }
> = {
  doordash: {
    label: 'DoorDash',
    hosts: ['doordash.com', 'order.online'],
    example: 'https://www.doordash.com/store/…',
  },
  grubhub: {
    label: 'Grubhub',
    hosts: ['grubhub.com'],
    example: 'https://www.grubhub.com/restaurant/…',
  },
  instacart: {
    label: 'Instacart',
    hosts: ['instacart.com'],
    example: 'https://www.instacart.com/store/…',
  },
  ubereats: {
    label: 'Uber Eats',
    hosts: ['ubereats.com'],
    example: 'https://www.ubereats.com/store/…',
  },
}

export const ORDER_URL_MAX = 500
/** Stores on one page. */
export const STOCKISTS_MAX = 25
/** Cities and zips on one store. */
export const STOCKIST_AREAS_MAX = 50
export const STORE_NAME_MAX = 80
export const SERVICE_AREA_MAX = 200

export function isOrderPlatform(value: unknown): value is OrderPlatform {
  return typeof value === 'string' && (ORDER_PLATFORM_IDS as readonly string[]).includes(value)
}

function hostAllowed(host: string, allowed: readonly string[]): boolean {
  const h = host.toLowerCase().replace(/\.$/, '')
  return allowed.some((d) => h === d || h.endsWith(`.${d}`))
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

/**
 * Checks a store link for one platform. A link pasted without `https://` gets
 * it; `http://` is upgraded. Anything not on the platform's own domain, with a
 * login or a port in it, or longer than ORDER_URL_MAX is refused.
 */
export function parseOrderUrl(platform: OrderPlatform, raw: unknown): Parsed<string> {
  const meta = ORDER_PLATFORMS[platform]
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (!text) return { ok: false, error: `Paste your ${meta.label} link.` }
  if (/\s/.test(text)) return { ok: false, error: `That doesn’t look like a ${meta.label} link.` }
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return { ok: false, error: `That doesn’t look like a ${meta.label} link.` }
  }
  if (url.protocol === 'http:') url.protocol = 'https:'
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    return { ok: false, error: `That doesn’t look like a ${meta.label} link.` }
  }
  if (!hostAllowed(url.hostname, meta.hosts)) {
    return {
      ok: false,
      error: `Use the link to your store on ${meta.label} (${meta.hosts.join(' or ')}).`,
    }
  }
  const out = url.toString()
  if (out.length > ORDER_URL_MAX) {
    return { ok: false, error: `That link is too long. Keep it to ${ORDER_URL_MAX} characters.` }
  }
  return { ok: true, value: out }
}

// ── Cities and zips ─────────────────────────────────────────────────────────

/** Matches listing_stockist_areas_value_check for a zip. */
export const ZIP_RE = /^\d{5}$/

export function isZip(value: unknown): value is string {
  return typeof value === 'string' && ZIP_RE.test(value)
}

/** A 5-digit zip, or null. "30318-1234" keeps the first five. */
export function parseZip(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const m = /^\s*(\d{5})(?:-\d{4})?\s*$/.exec(raw)
  return m?.[1] ?? null
}

const STATES = new Set(
  (
    'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH ' +
    'NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA VI WA WV WI WY GU AS MP'
  ).split(' ')
)

function titleWord(word: string): string {
  // Leave words the owner already capitalized ("McDonough", "DeKalb") alone.
  return word === word.toLowerCase() ? word.charAt(0).toUpperCase() + word.slice(1) : word
}

/** "atlanta, ga" → "Atlanta, GA". Null unless it is a city, a comma and a state. */
export function parseCity(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const m = /^\s*([^,]+?)\s*,\s*([A-Za-z]{2})\s*$/.exec(raw)
  if (!m?.[1] || !m[2]) return null
  const state = m[2].toUpperCase()
  if (!STATES.has(state)) return null
  const city = m[1]
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => w.split('-').map(titleWord).join('-'))
    .join(' ')
  if (!/^[A-Za-z][A-Za-z .'’-]*$/.test(city)) return null
  const out = `${city}, ${state}`
  return out.length <= 80 ? out : null
}

export interface StockistAreas {
  cities: string[]
  zips: string[]
}

/**
 * Reads what the owner typed for one store: zips and "City, ST", one per entry.
 * Duplicates are dropped. Anything that is neither is an error naming it.
 */
export function parseAreas(entries: unknown): Parsed<StockistAreas> {
  const list = Array.isArray(entries) ? entries : []
  const cities: string[] = []
  const zips: string[] = []
  for (const entry of list) {
    if (typeof entry !== 'string' || !entry.trim()) continue
    const zip = parseZip(entry)
    if (zip) {
      if (!zips.includes(zip)) zips.push(zip)
      continue
    }
    const city = parseCity(entry)
    if (city) {
      if (!cities.some((c) => c.toLowerCase() === city.toLowerCase())) cities.push(city)
      continue
    }
    return {
      ok: false,
      error: `“${entry.trim().slice(0, 40)}” isn’t a zip or a city. Use 30318 or Atlanta, GA.`,
    }
  }
  if (cities.length + zips.length > STOCKIST_AREAS_MAX) {
    return { ok: false, error: `Add up to ${STOCKIST_AREAS_MAX} cities and zips for one store.` }
  }
  return { ok: true, value: { cities, zips } }
}

// ── Stores ──────────────────────────────────────────────────────────────────

export interface RetailChain {
  slug: string
  name: string
}

/** One store on a page. */
export interface Stockist {
  id: string
  /** Set for a chain from the list; null for a store the owner named. */
  chainSlug: string | null
  /** What the page shows: the chain's name or the owner's. */
  name: string
  nationwide: boolean
  position: number
  cities: string[]
  zips: string[]
}

export interface OrderLink {
  platform: OrderPlatform
  label: string
  url: string
}

/** The select that toStockists reads. */
export const STOCKIST_SELECT =
  'id, chain_slug, store_name, nationwide, position, created_at, retail_chains(name), listing_stockist_areas(kind, value)'

/** Rows from listing_order_platforms, in ORDER_PLATFORMS order, anything malformed left out. */
export function toOrderLinks(rows: unknown): OrderLink[] {
  if (!Array.isArray(rows)) return []
  const byPlatform = new Map<OrderPlatform, string>()
  for (const r of rows) {
    const row = r as { platform?: unknown; url?: unknown } | null
    if (!row || !isOrderPlatform(row.platform) || typeof row.url !== 'string') continue
    // Read back through the same check, so a row that slipped in can't link elsewhere.
    const parsed = parseOrderUrl(row.platform, row.url)
    if (parsed.ok) byPlatform.set(row.platform, parsed.value)
  }
  return ORDER_PLATFORM_IDS.flatMap((p) => {
    const url = byPlatform.get(p)
    return url ? [{ platform: p, label: ORDER_PLATFORMS[p].label, url }] : []
  })
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

/** Rows from STOCKIST_SELECT, in position order (then oldest first). */
export function toStockists(rows: unknown): Stockist[] {
  if (!Array.isArray(rows)) return []
  const out: (Stockist & { created: string })[] = []
  for (const r of rows) {
    const row = r as {
      id?: unknown
      chain_slug?: unknown
      store_name?: unknown
      nationwide?: unknown
      position?: unknown
      created_at?: unknown
      retail_chains?: { name?: unknown } | { name?: unknown }[] | null
      listing_stockist_areas?: unknown
    } | null
    if (!row || typeof row.id !== 'string') continue
    const chainSlug = typeof row.chain_slug === 'string' ? row.chain_slug : null
    const chainName = one(row.retail_chains)?.name
    const name = chainSlug
      ? typeof chainName === 'string'
        ? chainName
        : null
      : typeof row.store_name === 'string'
        ? row.store_name
        : null
    if (!name) continue
    const cities: string[] = []
    const zips: string[] = []
    if (Array.isArray(row.listing_stockist_areas)) {
      for (const a of row.listing_stockist_areas as { kind?: unknown; value?: unknown }[]) {
        if (typeof a?.value !== 'string') continue
        if (a.kind === 'zip') zips.push(a.value)
        else if (a.kind === 'city') cities.push(a.value)
      }
    }
    cities.sort((a, b) => a.localeCompare(b))
    zips.sort()
    out.push({
      id: row.id,
      chainSlug,
      name,
      nationwide: row.nationwide === true,
      position: typeof row.position === 'number' ? row.position : 0,
      cities,
      zips,
      created: typeof row.created_at === 'string' ? row.created_at : '',
    })
  }
  out.sort((a, b) => a.position - b.position || a.created.localeCompare(b.created))
  return out.map(({ created: _created, ...s }) => s)
}

/** Rows from retail_chains, sorted by name. */
export function toRetailChains(rows: unknown): RetailChain[] {
  if (!Array.isArray(rows)) return []
  return rows
    .flatMap((r): RetailChain[] => {
      const row = r as { slug?: unknown; name?: unknown } | null
      return row && typeof row.slug === 'string' && typeof row.name === 'string'
        ? [{ slug: row.slug, name: row.name }]
        : []
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Line breaks and other control characters become spaces: a name is one line.
const CONTROL = /[\u0000-\u001f\u007f]+/g
const LINK_IN_TEXT = /https?:\/\/|www\./i

export interface StockistFields {
  chain_slug: string | null
  store_name: string | null
  nationwide: boolean
  areas: StockistAreas
}

/**
 * Checks one store. `store` is a chain slug from `chains`, or a name the owner
 * typed; a typed name that is a chain's name becomes that chain. A store needs
 * a city or zip, or to be marked nationwide (then its cities and zips are
 * dropped).
 */
export function parseStockist(
  input: { store: unknown; nationwide: unknown; areas: unknown },
  chains: readonly RetailChain[]
): Parsed<StockistFields> {
  const store =
    typeof input.store === 'string'
      ? input.store.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim()
      : ''
  if (!store) return { ok: false, error: 'Pick a store, or type its name.' }
  const chain =
    chains.find((c) => c.slug === store) ??
    chains.find((c) => c.name.toLowerCase() === store.toLowerCase())
  if (!chain) {
    if (store.length > STORE_NAME_MAX) {
      return { ok: false, error: `Keep the store name to ${STORE_NAME_MAX} characters or fewer.` }
    }
    if (LINK_IN_TEXT.test(store)) return { ok: false, error: 'Use the store’s name, not a link.' }
  }
  const nationwide = input.nationwide === true
  const areas = parseAreas(input.areas)
  if (!areas.ok) return areas
  if (!nationwide && areas.value.cities.length + areas.value.zips.length === 0) {
    return { ok: false, error: 'Add a city or zip where it’s sold, or mark it nationwide.' }
  }
  return {
    ok: true,
    value: {
      chain_slug: chain?.slug ?? null,
      store_name: chain ? null : store,
      nationwide,
      areas: nationwide ? { cities: [], zips: [] } : areas.value,
    },
  }
}

/** "Atlanta, GA · Decatur, GA · 30318", or "Nationwide". */
export function stockistAreaLabel(s: Pick<Stockist, 'nationwide' | 'cities' | 'zips'>): string {
  if (s.nationwide) return 'Nationwide'
  return [...s.cities, ...s.zips].join(' · ')
}

/** The service-area line, one line, or null. */
export function parseServiceArea(raw: unknown): Parsed<string | null> {
  const text = typeof raw === 'string' ? raw.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim() : ''
  if (!text) return { ok: true, value: null }
  if (text.length > SERVICE_AREA_MAX) {
    return { ok: false, error: `Keep the service area to ${SERVICE_AREA_MAX} characters or fewer.` }
  }
  if (LINK_IN_TEXT.test(text)) return { ok: false, error: 'Leave links out of your service area.' }
  return { ok: true, value: text }
}
