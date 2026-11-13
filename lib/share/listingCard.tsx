// =============================================================================
// The "Look what I found on The BLACQList" card, as Satori JSX.
// =============================================================================
// One design in three sizes:
//   og     1200×630   link previews (Facebook, X, Threads, iMessage, WhatsApp)
//   story  1080×1920  Instagram / TikTok / Snapchat stories
//   feed   1080×1350  Instagram feed (4:5)
// Satori only does flexbox, so every element with more than one child sets
// display:flex. Fonts are the committed TTFs in assets/fonts (OFL, see
// docs/blacqlist/design/font-licenses.md).
// =============================================================================

export type CardFormat = 'og' | 'story' | 'feed'

export const CARD_SIZES: Record<CardFormat, { width: number; height: number }> = {
  og: { width: 1200, height: 630 },
  story: { width: 1080, height: 1920 },
  feed: { width: 1080, height: 1350 },
}

export function parseCardFormat(value: string | null): CardFormat {
  return value === 'story' || value === 'feed' ? value : 'og'
}

// Brand tokens, from app/globals.css @theme. Satori can't read CSS variables.
const DEEP_BG = '#08080a'
const GOLD = '#c4a065'
const CREAM = '#f4f4f7'
const INK_SOFT = '#b5b5b7'

export interface ListingCardData {
  name: string
  categoryName: string | null
  cityLabel: string | null
  /** A data: URL for a JPEG or PNG cover, or null for the all-brand card. */
  coverDataUrl: string | null
  /** A data: URL for the gold mark PNG. */
  markDataUrl: string
}

/** Long names step down so they fit on two or three lines. */
function nameSize(format: CardFormat, name: string): number {
  const base = format === 'og' ? 68 : format === 'story' ? 112 : 96
  if (name.length > 40) return Math.round(base * 0.62)
  if (name.length > 24) return Math.round(base * 0.8)
  return base
}

function Lockup({ markDataUrl, scale }: { markDataUrl: string; scale: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 * scale }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img */}
      <img src={markDataUrl} width={64 * scale} height={64 * scale} alt="" />
      <div
        style={{
          fontFamily: 'Jost',
          fontWeight: 500,
          fontSize: 34 * scale,
          letterSpacing: 6 * scale,
          color: CREAM,
        }}
      >
        THE BLACQLIST
      </div>
    </div>
  )
}

function TextBlock({ data, format }: { data: ListingCardData; format: CardFormat }) {
  const scale = format === 'og' ? 0.8 : 1
  const meta = [data.categoryName, data.cityLabel].filter(Boolean).join('  ·  ')
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          fontFamily: 'Inter',
          fontWeight: 600,
          fontSize: 26 * scale,
          letterSpacing: 5 * scale,
          color: GOLD,
          marginBottom: 20 * scale,
        }}
      >
        LOOK WHAT I FOUND ON
      </div>
      <Lockup markDataUrl={data.markDataUrl} scale={scale} />
      <div
        style={{
          width: 120 * scale,
          height: 3,
          background: GOLD,
          marginTop: 44 * scale,
          marginBottom: 36 * scale,
        }}
      />
      <div
        style={{
          fontFamily: 'Jost',
          fontWeight: 300,
          fontSize: nameSize(format, data.name),
          lineHeight: 1.05,
          color: CREAM,
          letterSpacing: 1,
        }}
      >
        {data.name}
      </div>
      {meta && (
        <div
          style={{
            fontFamily: 'Inter',
            fontWeight: 600,
            fontSize: 30 * scale,
            color: INK_SOFT,
            marginTop: 24 * scale,
          }}
        >
          {meta}
        </div>
      )}
    </div>
  )
}

function Footer({ scale }: { scale: number }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: 'Inter',
        fontWeight: 600,
        fontSize: 24 * scale,
        color: INK_SOFT,
        letterSpacing: 2 * scale,
      }}
    >
      <div>Discover Black-owned businesses</div>
      <div style={{ color: GOLD }}>theblacqlist.com</div>
    </div>
  )
}

/** A soft gold glow standing in for a cover photo. */
function BrandField() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        background: `radial-gradient(circle at 70% 25%, rgba(196,160,101,0.28), rgba(8,8,10,0) 55%)`,
      }}
    />
  )
}

export function ListingCard({ data, format }: { data: ListingCardData; format: CardFormat }) {
  const { width, height } = CARD_SIZES[format]

  if (format === 'og') {
    // Landscape: text on the left, photo (or glow) on the right.
    return (
      <div style={{ width, height, display: 'flex', background: DEEP_BG, position: 'relative' }}>
        {data.coverDataUrl ? (
          <div
            style={{ position: 'absolute', top: 0, right: 0, width: 520, height, display: 'flex' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img */}
            <img
              src={data.coverDataUrl}
              width={520}
              height={height}
              style={{ objectFit: 'cover' }}
              alt=""
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `linear-gradient(90deg, ${DEEP_BG} 0%, rgba(8,8,10,0) 45%)`,
              }}
            />
          </div>
        ) : (
          <BrandField />
        )}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: data.coverDataUrl ? 720 : width,
            height,
            padding: '64px 72px',
          }}
        >
          <TextBlock data={data} format={format} />
          <Footer scale={0.8} />
        </div>
      </div>
    )
  }

  // Portrait (story and feed): photo on top fading into black, text below.
  const photoHeight = format === 'story' ? 1340 : 860
  return (
    <div
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        background: DEEP_BG,
        position: 'relative',
      }}
    >
      {data.coverDataUrl ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width,
            height: photoHeight,
            display: 'flex',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img */}
          <img
            src={data.coverDataUrl}
            width={width}
            height={photoHeight}
            style={{ objectFit: 'cover' }}
            alt=""
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `linear-gradient(180deg, rgba(8,8,10,0) 40%, ${DEEP_BG} 100%)`,
            }}
          />
        </div>
      ) : (
        <BrandField />
      )}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          flexGrow: 1,
          padding: format === 'story' ? '0 88px 120px' : '0 80px 80px',
        }}
      >
        <TextBlock data={data} format={format} />
        <div style={{ display: 'flex', height: format === 'story' ? 96 : 64 }} />
        <Footer scale={1} />
      </div>
    </div>
  )
}
