import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ticket 194: documents (the menu, the rate card, the commission guide).
// What is pinned here:
//   * the rules: PDF only, up to 10 MB, a 1–60 character name, and the plan
//     limit (Free 0, Starter 1, Growth 3, Premium 10).
//   * the public link is a download (`?download=`), never rendered inline.
//   * start: type, size, ownership, the plan and the rate limit are checked
//     before a one-time upload URL is issued, for a path the server chose.
//   * finish: a row only points at an object in this listing's folder whose
//     stored type, size and first bytes are a PDF. Anything else is removed.
//   * the section gate shows the first ones the plan allows, deleting nothing.
//   * the migration: its CHECKs mirror the rules, RLS as listing_faqs, and the
//     bucket is its own, PDF only, 10 MB.

const PAGE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const FOLDER = `listings/${PAGE}/documents`
const NAME = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d.pdf'
const PATH = `${FOLDER}/${NAME}`
const OLD_NAME = 'ffffffff-ffff-4fff-8fff-ffffffffffff.pdf'
const X = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const Y = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3]
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]

type Row = Record<string, unknown>

const h = vi.hoisted(() => {
  const state = {
    user: null as { id: string } | null,
    listing: null as Row | null,
    items: [] as Row[],
    failWrite: false,
    rateOk: true,
    objects: [] as { name: string; created_at?: string; metadata: Record<string, unknown> }[],
    header: [] as number[],
  }
  const writes: { op: string; row?: Row; where: Record<string, unknown> }[] = []
  const removed: string[][] = []
  const signed: string[] = []
  let nextId = 0

  function query(table: string) {
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let payload: Row = {}
    const eqs: Record<string, unknown> = {}
    let single = false
    const matches = (r: Row) => Object.entries(eqs).every(([k, v]) => r[k] === v)
    const run = () => {
      if (table === 'listings') {
        const l = state.listing
        const ok = l && state.user && eqs.owner_user_id === state.user.id && eqs.id === l.id
        return { data: ok ? l : null, error: null }
      }
      if (op !== 'select' && state.failWrite) return { data: null, error: { message: 'denied' } }
      if (op === 'insert') {
        nextId += 1
        state.items.push({
          id: `dddddddd-dddd-4ddd-8ddd-${String(nextId).padStart(12, '0')}`,
          ...payload,
        })
        writes.push({ op, row: payload, where: {} })
      } else if (op === 'update') {
        for (const r of state.items.filter(matches)) Object.assign(r, payload)
        writes.push({ op, row: payload, where: { ...eqs } })
      } else if (op === 'delete') {
        state.items = state.items.filter((r) => !matches(r))
        writes.push({ op, where: { ...eqs } })
      }
      const out = state.items
        .filter(matches)
        .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))
        .map((r) => ({ ...r }))
      return { data: single ? (out[0] ?? null) : out, error: null }
    }
    const q = {
      select: () => q,
      order: () => q,
      limit: () => q,
      is: () => q,
      eq: (col: string, val: unknown) => {
        eqs[col] = val
        return q
      },
      insert: (row: Row) => {
        op = 'insert'
        payload = row
        return q
      },
      update: (row: Row) => {
        op = 'update'
        payload = row
        return q
      },
      delete: () => {
        op = 'delete'
        return q
      },
      maybeSingle: () => {
        single = true
        return q
      },
      then(resolve: (v: { data: unknown; error: unknown }) => void) {
        return resolve(run())
      },
    }
    return q
  }

  const storage = {
    list: vi.fn(async (_folder: string, opts?: { search?: string }) => ({
      data: state.objects.filter((o) => !opts?.search || o.name.includes(opts.search)),
      error: null,
    })),
    remove: vi.fn(async (paths: string[]) => {
      removed.push(paths)
      state.objects = state.objects.filter((o) => !paths.some((p) => p.endsWith(`/${o.name}`)))
      return { data: [], error: null }
    }),
    createSignedUploadUrl: vi.fn(async (path: string) => {
      signed.push(path)
      return { data: { signedUrl: `https://x.supabase.co/sign/${path}?token=t` }, error: null }
    }),
  }

  return {
    state,
    writes,
    removed,
    signed,
    storage,
    resetIds: () => {
      nextId = 0
    },
    createClient: vi.fn(async () => ({ from: (t: string) => query(t) })),
    createServiceClient: vi.fn(() => ({ storage: { from: () => storage } })),
    checkRateLimit: vi.fn(async () => state.rateOk),
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: h.createClient,
  createServiceClient: h.createServiceClient,
}))
vi.mock('@/lib/dashboard/guard', () => ({
  getOwnerSession: async () => (h.state.user ? { user: h.state.user } : null),
}))
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimit: h.checkRateLimit }))
vi.mock('@/lib/dashboard/revalidateEditors', () => ({ revalidateOwnerEditors: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/listings/url', () => ({ buildEntityUrl: () => '/l/x' }))

import {
  LISTING_DOCUMENT_MAX_BYTES,
  buildListingDocumentPath,
  checkDocumentAdd,
  checkDocumentFile,
  documentFileName,
  documentHref,
  documentSizeLabel,
  documentsShowOn,
  isListingDocumentPath,
  parseDocumentLabel,
  toOwnerDocuments,
  toPublicDocuments,
} from '@/lib/listings/documents'
import {
  deleteDocumentAction,
  finishDocumentUploadAction,
  renameDocumentAction,
  reorderDocumentsAction,
  startDocumentUploadAction,
} from '@/lib/actions/dashboard/documents'
import { applyTierGates } from '@/lib/entity-page/sections'
import { documentLimit } from '@/lib/stripe/features'
import type { EntityPageData } from '@/types'

function read(file: string): string {
  return readFileSync(join(__dirname, '..', file), 'utf8')
}

const fetchMock = vi.fn(
  async (_url: string, _init?: RequestInit) =>
    new Response(new Uint8Array(h.state.header), { status: 206 })
)

function doc(id: string, sortOrder: number, name = `${id}.pdf`): Row {
  return {
    id,
    listing_id: PAGE,
    label: `Doc ${sortOrder}`,
    path: `${FOLDER}/${name}`,
    size_bytes: 1000,
    sort_order: sortOrder,
  }
}

function setTier(tier: string) {
  h.state.listing = { ...h.state.listing, tier }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.writes.length = 0
  h.removed.length = 0
  h.signed.length = 0
  h.resetIds()
  h.state.user = { id: 'u1' }
  h.state.listing = {
    id: PAGE,
    owner_user_id: 'u1',
    slug: 'cafe',
    status: 'published',
    entity_type: 'business',
    tier: 'starter',
    cities: { slug: 'atlanta' },
  }
  h.state.items = []
  h.state.failWrite = false
  h.state.rateOk = true
  h.state.objects = [{ name: NAME, metadata: { mimetype: 'application/pdf', size: 240_000 } }]
  h.state.header = PDF_HEADER
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co')
  vi.stubGlobal('fetch', fetchMock)
})

// ── The rules ────────────────────────────────────────────────────────────────

describe('the rules', () => {
  it('plan limits: Free 0, Starter 1, Growth 3, Premium 10', () => {
    expect(documentLimit('free')).toBe(0)
    expect(documentLimit(null)).toBe(0)
    expect(documentLimit('starter')).toBe(1)
    expect(documentLimit('growth')).toBe(3)
    expect(documentLimit('premium')).toBe(10)
  })

  it('shows on Starter+ business pages only', () => {
    expect(documentsShowOn({ tier: 'free', entity_type: 'business' })).toBe(false)
    expect(documentsShowOn({ tier: 'starter', entity_type: 'business' })).toBe(true)
    expect(documentsShowOn({ tier: 'premium', entity_type: 'job' })).toBe(false)
    expect(documentsShowOn({ tier: 'premium', entity_type: 'event' })).toBe(false)
  })

  it('takes a PDF up to 10 MB, nothing else', () => {
    expect(checkDocumentFile('application/pdf', 1)).toBeNull()
    expect(checkDocumentFile('application/pdf', LISTING_DOCUMENT_MAX_BYTES)).toBeNull()
    expect(checkDocumentFile('application/pdf', LISTING_DOCUMENT_MAX_BYTES + 1)).toBe(
      'PDFs can be up to 10 MB.'
    )
    expect(checkDocumentFile('image/png', 10)).toBe('Choose a PDF file.')
    expect(checkDocumentFile('application/msword', 10)).toBe('Choose a PDF file.')
    expect(checkDocumentFile('application/pdf', 0)).toMatch(/empty/)
    expect(checkDocumentFile('application/pdf', Number.NaN)).toMatch(/empty/)
  })

  it('names are one line of 1–60 characters', () => {
    expect(parseDocumentLabel('  Lunch   Menu ')).toEqual({ ok: true, value: 'Lunch Menu' })
    expect(parseDocumentLabel('')).toMatchObject({ ok: false })
    expect(parseDocumentLabel(null)).toMatchObject({ ok: false })
    expect(parseDocumentLabel('x'.repeat(60))).toMatchObject({ ok: true })
    expect(parseDocumentLabel('x'.repeat(61))).toMatchObject({ ok: false })
  })

  it('adding stops at the plan limit; only Free is told it needs Starter', () => {
    expect(checkDocumentAdd('free', 0)).toMatch(/come with Starter/)
    expect(checkDocumentAdd('starter', 0)).toBeNull()
    expect(checkDocumentAdd('starter', 1)).toMatch(/includes 1 document\./)
    expect(checkDocumentAdd('growth', 2)).toBeNull()
    expect(checkDocumentAdd('growth', 3)).toMatch(/includes 3 documents\./)
    expect(checkDocumentAdd('premium', 9)).toBeNull()
    expect(checkDocumentAdd('premium', 10)).toMatch(/Remove one/)
  })

  it('paths are server-built and pinned to the listing folder', () => {
    const p = buildListingDocumentPath(PAGE)
    expect(p).toMatch(new RegExp(`^${FOLDER}/[0-9a-f-]{36}\\.pdf$`))
    expect(isListingDocumentPath(p, PAGE)).toBe(true)
    expect(isListingDocumentPath(p, OTHER)).toBe(false)
    expect(isListingDocumentPath(`${FOLDER}/../x.pdf`, PAGE)).toBe(false)
    expect(isListingDocumentPath(`${FOLDER}/${X}.html`, PAGE)).toBe(false)
    expect(isListingDocumentPath(`listings/${PAGE}/video/${X}.pdf`, PAGE)).toBe(false)
    expect(isListingDocumentPath(42, PAGE)).toBe(false)
  })

  it('size labels read as KB or MB', () => {
    expect(documentSizeLabel(240_000)).toBe('234 KB')
    expect(documentSizeLabel(100)).toBe('1 KB')
    expect(documentSizeLabel(1.2 * 1024 * 1024)).toBe('1.2 MB')
    expect(documentSizeLabel(0)).toBeNull()
    expect(documentSizeLabel(undefined)).toBeNull()
  })

  it('the public link is a download with a safe filename', () => {
    expect(documentFileName('Lunch Menu (2026)!')).toBe('Lunch-Menu-2026.pdf')
    expect(documentFileName('***')).toBe('document.pdf')
    expect(documentHref('https://x.supabase.co', PATH, 'Rate Card')).toBe(
      `https://x.supabase.co/storage/v1/object/public/listing-documents/${PATH}?download=Rate-Card.pdf`
    )
  })

  it('maps rows for the owner and the page; no link without a storage URL', () => {
    const owner = toOwnerDocuments([doc(X, 0), { id: 1 }, null])
    expect(owner).toEqual([
      { id: X, label: 'Doc 0', path: `${FOLDER}/${X}.pdf`, sizeBytes: 1000, sortOrder: 0 },
    ])
    expect(toPublicDocuments(owner, 'https://x.supabase.co')).toEqual([
      {
        id: X,
        label: 'Doc 0',
        href: expect.stringContaining('?download=Doc-0.pdf'),
        sizeLabel: '1 KB',
      },
    ])
    expect(toPublicDocuments(owner, '')).toEqual([])
    expect(toOwnerDocuments(null)).toEqual([])
  })
})

// ── The section gate ─────────────────────────────────────────────────────────

describe('the section gate', () => {
  const documents = Array.from({ length: 5 }, (_, i) => ({
    id: `d${i}`,
    label: `D${i}`,
    href: `https://x/d${i}.pdf`,
    sizeLabel: null,
  }))
  const entity = {
    documents,
    details: { videos: [] },
    images: [],
    faqs: [],
  } as unknown as EntityPageData

  it('shows the first ones the plan allows, deleting nothing', () => {
    expect(applyTierGates(entity, 'free').documents).toBeUndefined()
    expect(applyTierGates(entity, 'starter').documents?.map((d) => d.id)).toEqual(['d0'])
    expect(applyTierGates(entity, 'growth').documents?.map((d) => d.id)).toEqual(['d0', 'd1', 'd2'])
    expect(applyTierGates(entity, 'premium').documents).toHaveLength(5)
    expect(entity.documents).toHaveLength(5)
  })
})

// ── The owner's actions ──────────────────────────────────────────────────────

describe('startDocumentUploadAction', () => {
  const start = (patch: Record<string, unknown> = {}) =>
    startDocumentUploadAction({ listingId: PAGE, mime: 'application/pdf', size: 240_000, ...patch })

  it('issues an upload URL for a server-chosen path in the listing folder', async () => {
    const r = await start()
    expect('path' in r && r.path).toMatch(new RegExp(`^${FOLDER}/[0-9a-f-]{36}\\.pdf$`))
    expect(h.signed).toEqual(['path' in r ? r.path : ''])
    expect(h.checkRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'document_upload', identifier: 'u1' })
    )
  })

  it('refuses other types and oversized files before touching storage', async () => {
    expect(await start({ mime: 'image/png' })).toEqual({ error: 'Choose a PDF file.' })
    expect(await start({ size: LISTING_DOCUMENT_MAX_BYTES + 1 })).toEqual({
      error: 'PDFs can be up to 10 MB.',
    })
    expect(h.signed).toHaveLength(0)
  })

  it('refuses a page the owner does not own, a job, an event, or a signed-out user', async () => {
    expect(await start({ listingId: OTHER })).toHaveProperty('error')
    expect(await start({ listingId: 'not-a-uuid' })).toHaveProperty('error')
    h.state.listing = { ...h.state.listing, entity_type: 'event' }
    expect(await start()).toHaveProperty('error')
    h.state.listing = { ...h.state.listing, entity_type: 'business' }
    h.state.user = null
    expect(await start()).toEqual({ error: 'Please sign in again.' })
    expect(h.signed).toHaveLength(0)
  })

  it('refuses Free, and a Starter page that already has its one document', async () => {
    setTier('free')
    expect(await start()).toEqual({
      error: 'Documents come with Starter. Upgrade to add your menu or rate card.',
    })
    setTier('starter')
    h.state.items = [doc(X, 0)]
    expect(await start()).toHaveProperty('error', expect.stringMatching(/includes 1 document/))
    expect(h.signed).toHaveLength(0)
  })

  it('stops at the rate limit', async () => {
    h.state.rateOk = false
    expect(await start()).toEqual({ error: 'Too many uploads. Please wait a while and try again.' })
    expect(h.signed).toHaveLength(0)
  })
})

describe('finishDocumentUploadAction', () => {
  const finish = (patch: Record<string, unknown> = {}) =>
    finishDocumentUploadAction({ listingId: PAGE, path: PATH, label: 'Menu', ...patch })

  it('saves the document at the end of the list after checking the stored bytes', async () => {
    setTier('growth')
    h.state.items = [doc(X, 0)]
    const r = await finish()
    expect(r).toMatchObject({ success: true })
    expect('items' in r && r.items.map((d) => d.label)).toEqual(['Doc 0', 'Menu'])
    expect(h.writes[0]).toMatchObject({
      op: 'insert',
      row: { listing_id: PAGE, label: 'Menu', path: PATH, size_bytes: 240_000, sort_order: 1 },
    })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(`https://x.supabase.co/storage/v1/object/public/listing-documents/${PATH}`)
    expect(init?.headers).toEqual({ Range: 'bytes=0-11' })
  })

  it('refuses a path that is not this listing’s', async () => {
    const other = `listings/${OTHER}/documents/${NAME}`
    expect(await finish({ path: other })).toEqual({ error: 'That upload isn’t for this page.' })
    expect(await finish({ path: `${FOLDER}/${X}.exe` })).toHaveProperty('error')
    expect(h.writes).toHaveLength(0)
  })

  it('removes a file whose bytes are not a PDF', async () => {
    h.state.header = PNG_HEADER
    expect(await finish()).toHaveProperty('error')
    expect(h.removed).toEqual([[PATH]])
    expect(h.writes).toHaveLength(0)
  })

  it('removes a file storage says is the wrong type or too big', async () => {
    h.state.objects = [{ name: NAME, metadata: { mimetype: 'text/html', size: 10 } }]
    expect(await finish()).toEqual({ error: 'Choose a PDF file.' })
    h.state.objects = [
      {
        name: NAME,
        metadata: { mimetype: 'application/pdf', size: LISTING_DOCUMENT_MAX_BYTES + 1 },
      },
    ]
    expect(await finish()).toEqual({ error: 'PDFs can be up to 10 MB.' })
    expect(h.removed).toEqual([[PATH], [PATH]])
    expect(h.writes).toHaveLength(0)
  })

  it('says the upload did not finish when nothing arrived', async () => {
    h.state.objects = []
    expect(await finish()).toEqual({ error: 'The upload didn’t finish. Please try again.' })
    expect(h.writes).toHaveLength(0)
  })

  it('refuses at the plan limit, and finishing twice adds one row', async () => {
    expect(await finish()).toMatchObject({ success: true })
    expect(await finish()).toMatchObject({ success: true })
    expect(h.writes.filter((w) => w.op === 'insert')).toHaveLength(1)

    h.state.items = [doc(X, 0)]
    expect(await finish()).toHaveProperty('error', expect.stringMatching(/includes 1 document/))
  })

  it('needs a name', async () => {
    expect(await finish({ label: '  ' })).toHaveProperty('error')
    expect(h.storage.list).not.toHaveBeenCalled()
  })

  it('cleans up old files no row uses, but leaves a young one', async () => {
    const old = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    const young = new Date().toISOString()
    const youngName = '99999999-9999-4999-8999-999999999999.pdf'
    h.state.objects.push(
      { name: OLD_NAME, created_at: old, metadata: { mimetype: 'application/pdf', size: 5 } },
      { name: youngName, created_at: young, metadata: { mimetype: 'application/pdf', size: 5 } }
    )
    h.state.objects[0]!.created_at = old
    expect(await finish()).toMatchObject({ success: true })
    expect(h.removed).toEqual([[`${FOLDER}/${OLD_NAME}`]])
  })
})

describe('rename, reorder and remove (every plan)', () => {
  beforeEach(() => {
    setTier('free')
    h.state.items = [doc(X, 0), doc(Y, 1)]
  })

  it('renames on a Free page', async () => {
    const r = await renameDocumentAction({ listingId: PAGE, id: X, label: 'Rate Card' })
    expect('items' in r && r.items[0]!.label).toBe('Rate Card')
    expect(h.writes[0]).toMatchObject({ op: 'update', where: { id: X, listing_id: PAGE } })
    expect(await renameDocumentAction({ listingId: PAGE, id: 'nope', label: 'A' })).toHaveProperty(
      'error'
    )
  })

  it('reorders, writing only the rows that moved', async () => {
    const r = await reorderDocumentsAction({ listingId: PAGE, ids: [Y, X] })
    expect('items' in r && r.items.map((d) => d.id)).toEqual([Y, X])
    expect(h.writes).toHaveLength(2)
    expect(await reorderDocumentsAction({ listingId: PAGE, ids: [X] })).toHaveProperty('error')
    expect(await reorderDocumentsAction({ listingId: PAGE, ids: [X, X] })).toHaveProperty('error')
  })

  it('removes the row, then the file', async () => {
    const r = await deleteDocumentAction({ listingId: PAGE, id: X })
    expect('items' in r && r.items.map((d) => d.id)).toEqual([Y])
    expect(h.writes[0]).toMatchObject({ op: 'delete', where: { id: X, listing_id: PAGE } })
    expect(h.removed).toEqual([[`${FOLDER}/${X}.pdf`]])
  })

  it('keeps the file when the row could not be removed', async () => {
    h.state.failWrite = true
    expect(await deleteDocumentAction({ listingId: PAGE, id: X })).toHaveProperty('error')
    expect(h.removed).toHaveLength(0)
  })
})

// ── Wiring ───────────────────────────────────────────────────────────────────

describe('migration 20261125000000_listing_documents', () => {
  const sql = read('supabase/migrations/20261125000000_listing_documents.sql')

  it('the CHECKs mirror the rules', () => {
    expect(sql).toMatch(/CHECK \(char_length\(btrim\(label\)\) BETWEEN 1 AND 60\)/)
    expect(sql).toMatch(/CHECK \(size_bytes BETWEEN 1 AND 10485760\)/)
    expect(sql).toContain("path ~ '^listings/[0-9a-f-]{36}/documents/[0-9a-f-]{36}\\.pdf$'")
    expect(sql).toContain("path LIKE 'listings/' || listing_id::text || '/documents/%'")
    expect(sql).toMatch(/UNIQUE \(path\)/)
    expect(LISTING_DOCUMENT_MAX_BYTES).toBe(10485760)
  })

  it('RLS as listing_faqs: two reads, owner writes, updated_at kept', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql.match(/FOR SELECT TO (anon|authenticated)/g)).toHaveLength(2)
    for (const op of ['INSERT', 'UPDATE', 'DELETE']) {
      expect(sql).toMatch(new RegExp(`FOR ${op} TO authenticated`))
    }
    expect(sql).toContain('EXECUTE FUNCTION update_updated_at()')
    expect(sql).toMatch(/ON public\.listing_documents \(listing_id, sort_order\)/)
  })

  it('its own public bucket: PDF only, 10 MB, idempotent, no object policies', () => {
    expect(sql).toContain(
      "VALUES ('listing-documents', 'listing-documents', true, 10485760, ARRAY['application/pdf'])"
    )
    expect(sql).toContain('ON CONFLICT (id) DO NOTHING')
    expect(sql).not.toMatch(/ON storage\.objects/)
  })
})

describe('wiring', () => {
  it('the loader fills documents on Starter+ business pages, fail-soft', () => {
    const src = read('lib/listings/entityPage.ts')
    expect(src).toContain('documentsShowOn(raw)')
    expect(src).toMatch(/\(\{ data, error \}\) => \(error \? \[\] : toOwnerDocuments\(data\)\)/)
    expect(src).toContain('...(documents.length > 0 ? { documents } : {})')
  })

  it('the section is gated at Starter with the plan limit, page and sidebar link', () => {
    expect(read('lib/entity-page/sections.ts')).toContain(
      "gate: { feature: 'documents', limit: 'documents' }"
    )
    expect(read('app/dashboard/pages/[entityId]/documents/page.tsx')).toContain('DocumentsManager')
    expect(read('lib/account/shellNav.ts')).toContain('/documents`')
  })

  it('every offerings heading carries the row', () => {
    for (const rel of [
      'components/entity-page/EntityOfferingsSection.tsx',
      'components/entity-page/templates/TemplateServices.tsx',
      'components/entity-page/templates/TemplateCapabilities.tsx',
    ]) {
      expect(read(rel), rel).toContain('documentsActions(entity.documents')
    }
  })

  it('the upload form takes PDFs only', () => {
    expect(read('components/dashboard/DocumentsManager.tsx')).toContain(
      'accept={LISTING_DOCUMENT_MIME}'
    )
  })
})
