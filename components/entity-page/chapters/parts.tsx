import type { CSSProperties, ReactNode } from 'react'
import type {
  ChapterData,
  DealView,
  EventRow,
  FindRow,
  GlidePhoto,
  LiveView,
  PersonView,
  Photo,
  ReviewView,
  StatusView,
} from './model'
import { initials, pad } from './model'
import { TrustMark } from '@/components/brand/TrustMark'
import { ContactLink } from '@/components/entity-page/ContactLink'
import { DistanceFromYou } from '@/components/entity-page/DistanceFromYou'
import { EntityLocationMap } from '@/components/entity-page/EntityLocationMap'
import { OwnerRespondForm } from '@/components/entity-page/OwnerRespondForm'
import { ReportCorrectionForm } from '@/components/entity-page/ReportCorrectionForm'
import { ReviewFormDisclosure } from '@/components/entity-page/ReviewFormDisclosure'

/**
 * Server-rendered pieces of the chapters layout (ticket 204), ported one for
 * one from the renderers in Creative's approved prototype v7 so the ported
 * stylesheet (chapters.css) applies unchanged. Interactive bits (disclosures,
 * the review carousel, the photo viewer, Copy Code, the toast) are plain
 * buttons with data attributes; ChaptersBehaviour wires them on the client.
 * `data-off` marks an action the sample page holds ("Links are off").
 *
 * On a live listing (ticket 231, `data.live` set) the same pieces render real
 * links and the site's existing action components instead. Actions that wait
 * for pass 2 (booking, shop, jobs, events, related) are left out, not held.
 */

/** New-tab attributes for links that leave the site. */
export const ext = (href: string) =>
  /^https?:\/\//i.test(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {}

/** Custom properties in inline styles. */
export const vars = (v: Record<string, string | number>) => v as CSSProperties

// Plain <img>: the stylesheet sets ratio, crop and the scroll drift on the
// element itself, and every sample photo is a local, already-sized file.
export function Img(props: {
  src: string
  alt: string
  className?: string
  width?: number
  height?: number
  priority?: boolean
}) {
  const { src, alt, className, width, height, priority } = props
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading={priority ? undefined : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
    />
  )
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

const STAR_PATH = 'M10 1.8l2.5 5.2 5.7.8-4.1 4 1 5.7L10 14.8l-5.1 2.7 1-5.7-4.1-4 5.7-.8z'

export function Stars({ rating, decorative }: { rating: number; decorative?: boolean }) {
  const n = Math.round(rating)
  const a11y = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img', 'aria-label': `${rating} out of 5` }
  return (
    <span className="stars" {...a11y}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" aria-hidden="true">
          <path className={i < n ? 'f' : 'e'} d={STAR_PATH} />
        </svg>
      ))}
    </span>
  )
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  'aria-hidden': true,
} as const

export const Arr = () => (
  <svg viewBox="0 0 20 20" {...stroke}>
    <path d="M4 10h12M11 5l5 5-5 5" />
  </svg>
)
export const Arl = () => (
  <svg viewBox="0 0 20 20" {...stroke}>
    <path d="M16 10H4M9 5l-5 5 5 5" />
  </svg>
)
export const Out = () => (
  <svg viewBox="0 0 20 20" {...stroke}>
    <path d="M7 4h9v9M16 4L5 15" />
  </svg>
)
export const Chev = () => (
  <svg viewBox="0 0 14 14" {...stroke}>
    <path d="M3 5l4 4 4-4" />
  </svg>
)
export const Play = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path fill="currentColor" d="M3 1.5v13l11-6.5z" />
  </svg>
)
export const Check = () => (
  <svg viewBox="0 0 20 20" {...stroke} strokeWidth={2}>
    <path d="M3 10.5l4.5 4.5L17 5.5" />
  </svg>
)

// ─── Small pieces ──────────────────────────────────────────────────────────────

export function Fig({
  photo,
  className = '',
  style,
  as: Tag = 'figure',
}: {
  photo: Photo
  className?: string
  style?: CSSProperties
  /** 'div' when the photo already sits in a figure with its own caption. */
  as?: 'figure' | 'div'
}) {
  return (
    <Tag className={`figure ${className}`.trim()} style={style}>
      <Img src={photo.src} alt={photo.alt} />
    </Tag>
  )
}

/** A person's photo, or their initials when there is none. */
export function Avatar({ person }: { person: PersonView }) {
  if (person.photo)
    return (
      <span className="avatar">
        <Img src={person.photo.src} alt={person.photo.alt} />
      </span>
    )
  return (
    <span className="avatar" aria-hidden="true">
      {initials(person.name)}
    </span>
  )
}

export function ChapterHeading({ data, id }: { data: ChapterData; id: string }) {
  const i = data.chapters.findIndex((c) => c.id === id)
  const c = data.chapters[i]
  if (!c) return null
  return (
    <h2 className="ch-h" id={`h-${id}`}>
      <span className="num">{pad(i + 1)}</span>
      <span>{c.title}</span>
    </h2>
  )
}

/** Rows beyond the first screenful sit in a hidden block; the button reveals them. */
export function Disc({
  id,
  label,
  children,
  className = '',
  buttonClassName = '',
}: {
  id: string
  label: ReactNode
  children: ReactNode
  className?: string
  buttonClassName?: string
}) {
  return (
    <>
      <div id={id} className={`disc ${className}`.trim()} hidden>
        {children}
      </div>
      <button
        className={`more-btn ${buttonClassName}`.trim()}
        type="button"
        aria-expanded="false"
        aria-controls={id}
      >
        <span>{label}</span>
        <span className="pm" aria-hidden="true" />
      </button>
    </>
  )
}

export function Status({ status, subClass = 'meta' }: { status: StatusView; subClass?: string }) {
  return (
    <>
      <span className={`status${status.open ? '' : ' closed'}`}>
        <i aria-hidden="true" />
        {status.text}
      </span>{' '}
      <span className={subClass}>{status.sub}</span>
    </>
  )
}

export function Glance({ items }: { items: string[] }) {
  return (
    <ul className="glance" aria-label="At a glance">
      {items.map((g) => (
        <li key={g}>{g}</li>
      ))}
    </ul>
  )
}

export function Facts({ data }: { data: ChapterData }) {
  return (
    <p className="facts">
      <span>
        <Stars rating={data.rating} decorative /> {data.rating.toFixed(1)}
        <span className="vh"> out of 5</span>{' '}
        <span className="meta">({data.reviewCount} Reviews)</span>
      </span>
      {data.status && (
        <span>
          <Status status={data.status} />
        </span>
      )}
      {data.facts.map((f) => (
        <span key={f}>{f}</span>
      ))}
      {/* Round means trust, square means a label (Creative DR-004): a trust
          tier gets the round mark, Black-Owned keeps the square marker. */}
      {data.badges.map((b) =>
        b.tier !== null ? (
          <span key={b.label} className="badge tier">
            <TrustMark tier={b.tier} />
            {b.label}
          </span>
        ) : (
          <span key={b.label} className="badge">
            {b.label}
          </span>
        )
      )}
    </p>
  )
}

export function Interlude({ photo }: { photo: Photo }) {
  return (
    <figure className="il drift">
      <Img src={photo.src} alt={photo.alt} />
    </figure>
  )
}

// ─── Visit ─────────────────────────────────────────────────────────────────────

export function HoursTable({ data }: { data: ChapterData }) {
  return (
    <table className="hours">
      <caption className="vh">Opening Hours</caption>
      <tbody>
        {data.hours.map((h) => (
          <tr key={h.day} className={h.today ? 'today' : undefined}>
            <td>{h.day}</td>
            <td>{h.hours}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function OverrideList({ data }: { data: ChapterData }) {
  if (!data.overrides.length)
    return (
      <>
        <h3 className="h4">Holiday Hours</h3>
        <p className="meta">No changes in the next 30 days.</p>
      </>
    )
  return (
    <>
      <h3 className="h4 over-h">Holiday Hours</h3>
      <ul className="over">
        {data.overrides.map((o) => (
          <li key={o.key}>
            <span>{o.label}</span>
            <span>{o.hours}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

export function VisitPanelInner({ data }: { data: ChapterData }) {
  return (
    <>
      {data.status && (
        <p className="v-status">
          <Status status={data.status} subClass="sub" />
        </p>
      )}
      <address className="v-addr">
        {data.address.map((line, i) => (
          <span key={line}>
            {i > 0 && <br />}
            {line}
          </span>
        ))}
      </address>
      {data.phone && <p className="v-phone">{data.phone}</p>}
      {data.live ? (
        <VisitActions live={data.live} />
      ) : (
        <div className="btn-row" style={{ marginTop: 28 }}>
          <button className="btn btn-fill" type="button" data-off>
            Get Directions <Arr />
          </button>
          <button className="btn btn-line" type="button" data-off>
            Message
          </button>
        </div>
      )}
      {data.hours.length > 0 ? (
        <div className="v-cols">
          <div>
            <h3 className="h4">Opening Hours</h3>
            <HoursTable data={data} />
          </div>
          <div>
            <OverrideList data={data} />
          </div>
        </div>
      ) : (
        // No weekly hours set (ticket 233): no empty table and no "No changes"
        // line. Dated special hours still show if the owner added any.
        data.overrides.length > 0 && (
          <div className="v-cols" data-hours="overrides-only">
            <div>
              <OverrideList data={data} />
            </div>
          </div>
        )
      )}
    </>
  )
}

function VisitActions({ live }: { live: LiveView }) {
  return (
    <>
      {live.lat != null && live.lng != null && (
        <div className="v-dist">
          <DistanceFromYou lat={live.lat} lng={live.lng} />
        </div>
      )}
      {(live.directionsHref || live.message) && (
        <div className="btn-row" style={{ marginTop: 28 }}>
          {live.directionsHref && (
            <ContactLink
              className="btn btn-fill"
              href={live.directionsHref}
              listingId={live.listingId}
              source="at_a_glance"
              {...ext(live.directionsHref)}
            >
              Get Directions <Arr />
            </ContactLink>
          )}
          {live.message && (
            <a className="btn btn-line" href={live.message.href}>
              {live.message.label}
            </a>
          )}
        </div>
      )}
    </>
  )
}

/** The live map on a real listing. No pins, no map. */
export function LiveMap({ live }: { live: LiveView }) {
  if (!live.pins.length) return null
  return (
    <figure className="map map-live">
      <EntityLocationMap pins={live.pins} directionsHref={live.directionsHref} />
    </figure>
  )
}

type MapColours = { land: string; block: string; road: string; park: string; minor: string }

/** A drawn map preview, so the sample never loads a live map or a real place. */
export function MapFig({ colours, address }: { colours: MapColours; address: string }) {
  const xs = [0, 110, 240, 360, 470, 600, 720]
  const ys = [0, 90, 200, 300, 410]
  const blocks: ReactNode[] = []
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++)
      blocks.push(
        <rect
          key={`${i}-${j}`}
          x={xs[i]! + 14}
          y={ys[j]! + 14}
          width={xs[i + 1]! - xs[i]! - 28}
          height={ys[j + 1]! - ys[j]! - 28}
          rx="3"
          fill={colours.block}
        />
      )
  return (
    <figure className="map">
      <svg
        viewBox="0 0 720 500"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={`Map preview of the blocks around ${address}`}
      >
        <rect width="720" height="500" fill={colours.land} />
        {blocks}
        <rect x="374" y="214" width="82" height="182" rx="3" fill={colours.park} />
        <path
          d="M-10 455 C 160 430, 300 470, 470 440 S 700 420, 740 445"
          stroke={colours.park}
          strokeWidth="22"
          fill="none"
          opacity=".8"
        />
        <g stroke={colours.minor} strokeWidth="6" fill="none">
          <path d="M0 145 H720 M0 355 H720 M175 0 V500 M535 0 V500 M300 0 V500 M660 0 V500" />
        </g>
        <g stroke={colours.road} strokeWidth="14" fill="none">
          <path d="M0 250 H720" />
          <path d="M420 0 V500" />
          <path d="M-20 40 L 740 120" />
        </g>
        <circle className="pin-pulse" cx="420" cy="250" r="16" fill="#8f6600" />
        <circle cx="420" cy="250" r="16" fill="#8f6600" />
        <circle cx="420" cy="250" r="6" fill="#fff" />
      </svg>
      <figcaption>Map preview. The real page loads the live map.</figcaption>
    </figure>
  )
}

export function FindHead({ title, lede }: { title: string; lede: string }) {
  return (
    <div className="find-head">
      <h3 className="find-t">{title}</h3>
      <p className="find-lede">{lede}</p>
    </div>
  )
}

export function FindList({
  title,
  items,
  action,
  live = false,
}: {
  title: string
  items: FindRow[]
  action: string
  /** Live pages link rows that have somewhere to go and drop the rest's button. */
  live?: boolean
}) {
  if (!items.length) return null
  return (
    <div className="find-g">
      <h3 className="h4">{title}</h3>
      <ul>
        {items.map((x) => (
          <li key={x.id} className="go">
            <div>
              <strong>{x.name}</strong>
              <span>{x.where}</span>
            </div>
            {live ? (
              x.href && (
                <a className="find-go" href={x.href} {...ext(x.href)}>
                  {action}
                  <span className="vh">: {x.name}</span>
                  <Arr />
                </a>
              )
            ) : (
              <button className="find-go" type="button" data-off>
                {action}
                <span className="vh">: {x.name}</span>
                <Arr />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function EventsList({ events }: { events: EventRow[] }) {
  if (!events.length) return null
  return (
    <div className="find-g">
      <h3 className="h4">Upcoming Events</h3>
      <ul>
        {events.map((e) => (
          <li key={e.id} className="ev go">
            <span className="dt" aria-hidden="true">
              {e.day}
              <small>{e.month}</small>
            </span>
            <div>
              <strong>{e.title}</strong>
              <span>
                {e.when} · {e.where}
              </span>
            </div>
            <button className="find-go" type="button" data-off>
              Details<span className="vh">: {e.title}</span>
              <Arr />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Offers and booking ────────────────────────────────────────────────────────

export function DealCard({
  deal,
  className,
  index,
}: {
  deal: DealView
  className: string
  index: number
}) {
  return (
    <article className={`${className} cpn rv`} style={vars({ '--d': `${index * 90}ms` })}>
      <h4 className="cpn-t">{deal.title}</h4>
      <p className="cpn-d">{deal.desc}</p>
      <div className="cpn-foot">
        <div className="cpn-c">
          {deal.code ? (
            <>
              <span className="code">{deal.code}</span>
              <button className="cpn-copy" type="button" data-copy={deal.code} data-deal={deal.id}>
                Copy Code
              </button>
            </>
          ) : (
            <span className="cpn-nc">No Code Needed</span>
          )}
        </div>
        {deal.terms && <p className="cpn-terms">{deal.terms}</p>}
      </div>
    </article>
  )
}

export function OffersBlock({
  deals,
  className,
  lede,
  solo = false,
}: {
  deals: DealView[]
  className: string
  lede: string
  /** The offers are the whole chapter, so its heading already says Offers. */
  solo?: boolean
}) {
  if (!deals.length) return null
  return (
    <div className={solo ? 'offers offers-solo' : 'offers'}>
      <div className="offers-hd">
        {!solo && <h3 className="h3">Offers</h3>}
        <p className="offers-n">{deals.length} Current Offers</p>
        <p className="offers-lede">{lede}</p>
      </div>
      <div className="offers-list">
        {deals.map((x, i) => (
          <DealCard key={x.id} deal={x} className={className} index={i} />
        ))}
      </div>
    </div>
  )
}

export function BookPanel({
  className,
  title,
  lede,
  facts,
  children,
}: {
  className: string
  title: string
  lede: string
  facts: string[]
  children: ReactNode
}) {
  return (
    <div className={`${className} bk rv`}>
      <div className="bk-tx">
        <h3 className="bk-h">{title}</h3>
        <p className="bk-l">{lede}</p>
        {facts.length > 0 && (
          <ul className="bk-f">
            {facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="bk-act">{children}</div>
    </div>
  )
}

// ─── Happening now, highlights ─────────────────────────────────────────────────

export function HappeningStrip({ data }: { data: ChapterData }) {
  if (!data.happening.length) return null
  return (
    <div className="hn-strip" role="region" aria-labelledby="h-hn">
      <div className="wrap">
        <div className="hs-head">
          <h3 className="hs-h" id="h-hn">
            <i aria-hidden="true" />
            Happening Now
          </h3>
          <p className="hs-c">
            {data.happening.length} Update{data.happening.length === 1 ? '' : 's'}
          </p>
        </div>
        <ul className="hs-list">
          {data.happening.map((p, i) => (
            <li key={p.id} className="hs-i rv" style={vars({ '--d': `${i * 100}ms` })}>
              {p.image ? (
                <Fig photo={p.image} />
              ) : (
                <div className="hs-t hs-now" aria-hidden="true">
                  Now
                </div>
              )}
              <div className="hs-tx">
                <h4>{p.title}</h4>
                <p>{p.body}</p>
                {p.button && (
                  <button className="tlink" type="button" data-off>
                    {p.button}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─── Reviews ───────────────────────────────────────────────────────────────────

function ReviewCard({
  r,
  index,
  total,
  respondAs,
}: {
  r: ReviewView
  index: number
  total: number
  /** The listing id, when the viewer owns it and may answer a review. */
  respondAs?: string | null
}) {
  const n = r.photos.length
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${total}`}
      className={`rev${n ? ' has-ph' : ''}`}
      style={vars({ '--d': `${index * 90}ms` })}
    >
      <div className="hd">
        <Stars rating={r.rating} />
        <span className="hd-r">
          {n > 0 && <span className="ph-tag">With Photos</span>}
          <span>{r.ago}</span>
        </span>
      </div>
      <h3>{r.title}</h3>
      <p>{r.body}</p>
      {n > 0 && (
        <ul
          className="rev-ph"
          data-set={JSON.stringify(r.photos)}
          data-who={r.who}
          aria-label={`Photos from ${r.who}`}
        >
          {r.photos.slice(0, 3).map((q, j) => (
            <li key={q.src}>
              <button
                type="button"
                data-ph={j}
                aria-label={`Photo ${j + 1} of ${n} from ${r.who}${j === 2 && n > 3 ? `, plus ${n - 3} more` : ''}`}
              >
                <Img src={q.src} alt="" />
                {j === 2 && n > 3 && (
                  <span className="ph-more" aria-hidden="true">
                    +{n - 3}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="who">
        <strong>{r.who}</strong>
        {r.verified ? ' · Verified Visit' : ''}
      </p>
      {r.response && (
        <div className="resp">
          <strong>Response From the Owner</strong>
          {r.response}
        </div>
      )}
      {respondAs && !r.response && (
        <div className="resp-form">
          <OwnerRespondForm reviewId={r.id} listingId={respondAs} />
        </div>
      )}
    </div>
  )
}

function ReviewCarousel({
  reviews,
  respondAs,
}: {
  reviews: ReviewView[]
  respondAs?: string | null
}) {
  const n = reviews.length
  return (
    <div className="rc rv" role="region" aria-roledescription="carousel" aria-labelledby="h-rc">
      <div className="rc-bar">
        <p className="rc-n" id="h-rc" aria-live="off">
          Reviews <span className="rc-pos">1</span> of {n}
        </p>
        <div className="rc-ctl">
          <button type="button" className="tlink rc-play" data-rc="p">
            Pause Reviews
          </button>
          <span className="glide-ctl">
            <button type="button" data-rc="-1" aria-label="Previous review">
              <Arl />
            </button>
            <button type="button" data-rc="1" aria-label="Next review">
              <Arr />
            </button>
          </span>
        </div>
      </div>
      <div className="rc-prog" aria-hidden="true">
        <span />
      </div>
      <div className="rc-view">
        {/* Slides are divs, not list items: role="group" is not allowed inside a list. */}
        <div className="revs rc-track">
          {reviews.map((r, i) => (
            <ReviewCard key={r.id} r={r} index={i} total={n} respondAs={respondAs} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ReviewActions({ data }: { data: ChapterData }) {
  const live = data.live
  if (!live)
    return (
      <div className="btn-row rev-act">
        <button className="btn btn-fill" type="button" data-off>
          Read All {data.reviewCount} Reviews
        </button>
        <button className="tlink" type="button" data-off>
          Write a Review
        </button>
      </div>
    )
  // The page shows the latest ten; there is no all-reviews page yet, so no Read All.
  if (live.review === 'sign_in')
    return (
      <div className="btn-row rev-act">
        <a className="tlink" href={live.signInHref}>
          Sign In to Write a Review
        </a>
      </div>
    )
  if (live.review === 'write')
    return (
      <div className="rev-act rev-form">
        <ReviewFormDisclosure
          key={live.listingId}
          listingId={live.listingId}
          listingName={live.listingName}
          criteria={live.reviewCriteria}
          hasReviews={live.hasReviews}
        />
      </div>
    )
  return null
}

export function ReviewsBand({ data }: { data: ChapterData }) {
  const hasReviews = data.reviews.length > 0
  const respondAs = data.live?.isOwner ? data.live.listingId : null
  return (
    <section className="band s-ember" id="reviews" data-ch="reviews" aria-labelledby="h-reviews">
      <div className="wrap">
        <ChapterHeading data={data} id="reviews" />
        {!hasReviews && <p className="lede">No reviews yet.</p>}
        {hasReviews && (
          <div className="rev-top">
            <div className="rv">
              <div className="score">
                <span className="big" aria-hidden="true" data-count={data.rating} data-dec="1">
                  {data.rating.toFixed(1)}
                </span>
                <div className="of">
                  <span className="vh">{data.rating.toFixed(1)} out of 5, </span>
                  <Stars rating={data.rating} decorative />
                  <p className="meta" style={{ marginTop: 6 }}>
                    {data.reviewCount} Reviews
                  </p>
                </div>
              </div>
              {data.criteria.length > 0 && (
                <ul className="crit rv" aria-label="Ratings by category">
                  {data.criteria.map((c) => (
                    <li key={c.name}>
                      <span>{c.name}</span>
                      <span className="bar" aria-hidden="true">
                        <span style={vars({ '--v': c.average / 5 })} />
                      </span>
                      <span className="v">{c.average.toFixed(1)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {data.pull && (
              <figure className="rv" style={vars({ margin: 0, '--d': '120ms' })}>
                <blockquote className="pull">“{data.pull.quote}”</blockquote>
                <figcaption className="pull-by">{data.pull.who}, from a review below</figcaption>
              </figure>
            )}
          </div>
        )}
        {hasReviews && <ReviewCarousel reviews={data.reviews} respondAs={respondAs} />}
        <ReviewActions data={data} />
        {data.credentials.length > 0 && (
          <ul className="creds">
            {data.credentials.map((c) => (
              <li key={c.id} className="rv">
                <span className="k">{c.kind}</span>
                <span className="t">
                  {c.title}
                  <span className="by">{c.issuer}</span>
                </span>
                <span className="y">{c.year}</span>
              </li>
            ))}
          </ul>
        )}
        {data.trust && (
          <p className="trust">
            <Check />
            {data.trust.line}
          </p>
        )}
      </div>
    </section>
  )
}

// ─── More ──────────────────────────────────────────────────────────────────────

function Faq({ q, a, open }: { q: string; a: string; open: boolean }) {
  return (
    <details open={open}>
      <summary>
        {q}
        <span className="pm" aria-hidden="true" />
      </summary>
      <p className="a">{a}</p>
    </details>
  )
}

function ProfileFooter({ data }: { data: ChapterData }) {
  return (
    <div className="pfoot" role="region" aria-labelledby="h-pf">
      <div className="wrap">
        <div className="pf-top">
          <div className="pf-id">
            {data.logo && (
              <span className="pf-logo">
                <Img src={data.logo.src} alt="" width={40} height={40} />
              </span>
            )}
            <div>
              <h3 className="pf-name" id="h-pf">
                {data.name}
              </h3>
              <p className="pf-cat">{data.category}</p>
            </div>
          </div>
          {data.live ? (
            data.live.cta && (
              <ContactLink
                className="btn btn-fill"
                href={data.live.cta.href}
                listingId={data.live.listingId}
                source="at_a_glance"
                {...ext(data.live.cta.href)}
              >
                {data.live.cta.label}
              </ContactLink>
            )
          ) : (
            <button className="btn btn-fill" type="button" data-off>
              {data.cta}
            </button>
          )}
        </div>
        <div className="pf-cols">
          <div className="pf-col">
            <h4 className="pf-h">Visit</h4>
            <address className="pf-addr">
              {data.address.map((line, i) => (
                <span key={line}>
                  {i > 0 && <br />}
                  {line}
                </span>
              ))}
            </address>
            {data.phone && <p className="pf-tel">{data.phone}</p>}
            {data.live ? (
              data.live.directionsHref && (
                <ContactLink
                  className="ml"
                  href={data.live.directionsHref}
                  listingId={data.live.listingId}
                  source="at_a_glance"
                  {...ext(data.live.directionsHref)}
                >
                  Get Directions
                  <Arr />
                </ContactLink>
              )
            ) : (
              <button className="ml" type="button" data-off>
                Get Directions
                <Arr />
              </button>
            )}
          </div>
          {data.links.length > 0 && (
            <nav className="pf-col" aria-labelledby="h-links">
              <h4 className="pf-h" id="h-links">
                Links
              </h4>
              <ul className="pf-list">
                {data.links.map((l) => (
                  <li key={l.label}>
                    {l.href ? (
                      <a className="ml" href={l.href} {...ext(l.href)}>
                        {l.label}
                        <Out />
                      </a>
                    ) : (
                      <button className="ml" type="button" data-off>
                        {l.label}
                        <Out />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <nav className="pf-col pf-otp" aria-labelledby="h-otp">
            <h4 className="pf-h" id="h-otp">
              On This Page
            </h4>
            <ul className="pf-list">
              {data.chapters.map((c) => (
                <li key={c.id}>
                  <a className="ml" href={`#${c.id}`} data-example-allow-links>
                    {c.nav}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="pf-base">
          {data.trust && (
            <p className="pf-v">
              <Check />
              {data.trust.short}
            </p>
          )}
          {data.live && (
            <p className="pf-acts">
              {data.live.claimHref && (
                <a className="ml" href={data.live.claimHref}>
                  Own This Business? Claim It
                </a>
              )}
              <ReportCorrectionForm listingId={data.live.listingId} triggerClassName="ml" />
            </p>
          )}
          <a className="ml" href="#top" data-example-allow-links>
            Back to Top
          </a>
        </div>
      </div>
    </div>
  )
}

export function MoreBand({ data, surface }: { data: ChapterData; surface: string }) {
  const strip = surface === 's-stone' ? 's-white' : 's-stone'
  const nj = data.jobs.length
  const showAll = data.faq.length - 4 < 3
  const hasAttrs = data.attributes.length > 0
  const hasFaq = data.faq.length > 0
  const lede = [
    'The details',
    hasFaq ? 'answers' : null,
    nj > 0 ? 'open roles' : null,
    data.links.length ? 'our links' : null,
  ].filter(Boolean) as string[]
  const ledeText =
    (lede.length > 1 ? `${lede.slice(0, -1).join(', ')} and ${lede.at(-1)}` : lede[0]!) +
    (data.related.length
      ? `, and more places like this${data.place ? ` in ${data.place}` : ''}.`
      : '.')
  return (
    <section
      className={`band ${surface} more-band`}
      id="more"
      data-ch="more"
      aria-labelledby="h-more"
    >
      <div className="wrap">
        <ChapterHeading data={data} id="more" />
        <p className="more-lede">
          {data.live
            ? ledeText
            : `The details, answers and open roles, our links, and more places like this in ${data.place ?? 'Atlanta'}.`}
        </p>
        {(hasAttrs || hasFaq) && (
          <div className="more-t1">
            {hasAttrs && (
              <div>
                <h3 className="more-h">Good to Know</h3>
                <div className="attr-grid">
                  {data.attributes.map((a, i) => (
                    <div key={a.group} className="attr rv" style={vars({ '--d': `${i * 60}ms` })}>
                      <h4>{a.group}</h4>
                      <ul>
                        {a.values.map((v) => (
                          <li key={v}>{v}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {hasFaq && (
              <div>
                <h3 className="more-h">Questions and Answers</h3>
                <div className="faq">
                  {(showAll ? data.faq : data.faq.slice(0, 4)).map((f, i) => (
                    <Faq key={f.id} q={f.q} a={f.a} open={i === 0} />
                  ))}
                </div>
                {!showAll && (
                  <Disc
                    id="more-faq"
                    label={`Show All ${data.faq.length} Questions`}
                    className="faq"
                  >
                    {data.faq.slice(4).map((f) => (
                      <Faq key={f.id} q={f.q} a={f.a} open={false} />
                    ))}
                  </Disc>
                )}
              </div>
            )}
          </div>
        )}
        {nj > 0 && (
          <div className="more-t2">
            <div className="hire rv">
              <p className="hire-k">We Are Hiring</p>
              <h3 className="hire-h">
                {nj} Open Role{nj > 1 ? 's' : ''}
              </h3>
              <div className="hire-list">
                {data.jobs.map((j) => (
                  <div key={j.id} className="job">
                    <p className="h4">{j.title}</p>
                    <p className="job-m">
                      {j.type}
                      {j.pay ? ` · ${j.pay}` : ''}
                    </p>
                    <p className="job-d">{j.desc}</p>
                    <button className="tlink" type="button" data-off>
                      View Role
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <ProfileFooter data={data} />
      {data.related.length > 0 && (
        <div className={`more-rel ${strip}`}>
          <div className="wrap">
            <h3 className="more-h">More Like This{data.place ? ` in ${data.place}` : ''}</h3>
            <ul className="related">
              {data.related.map((r) => (
                <li key={r.id} className="rel rv">
                  <span className="avatar" aria-hidden="true">
                    {initials(r.name)}
                  </span>
                  <div className="rel-tx">
                    <strong>{r.name}</strong>
                    <p>{r.tagline}</p>
                    <p className="rel-r">
                      <Stars rating={r.rating} />{' '}
                      <span>
                        {r.rating.toFixed(1)} ({r.reviews} Reviews)
                      </span>
                    </p>
                    <button className="tlink" type="button" data-off>
                      View Listing<span className="vh">: {r.name}</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}

// ─── Gallery glide ─────────────────────────────────────────────────────────────

export function Glide({
  data,
  id,
  items,
  surface,
  lead,
  after,
}: {
  data: ChapterData
  id: string
  items: GlidePhoto[]
  surface: string
  lead?: ReactNode
  after?: ReactNode
}) {
  return (
    <section className={`band ${surface} glide`} id={id} data-ch={id} aria-labelledby={`h-${id}`}>
      <div className="glide-pin">
        <div className="glide-sticky">
          <div className="wrap glide-head">
            <ChapterHeading data={data} id={id} />
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              {lead}
              <div className="glide-ctl">
                <button type="button" data-g="-1" aria-label="Previous photos">
                  <Arl />
                </button>
                <button type="button" data-g="1" aria-label="Next photos">
                  <Arr />
                </button>
              </div>
            </div>
          </div>
          <ul
            className="glide-track"
            tabIndex={0}
            aria-label={`${items.length} photos, scroll sideways`}
          >
            {items.map((g, i) => (
              <li key={g.src} className="glide-item">
                <figure style={{ margin: 0 }}>
                  <Fig as="div" photo={g} style={vars({ '--ar': g.ar })} />
                  {/* The caption repeats the alt text, so screen readers get the
                      alt once (on the photo) and only the album from here. */}
                  <figcaption
                    className="cap"
                    style={{ maxWidth: g.ar === '2/3' || g.ar === '3/4' ? '32ch' : '48ch' }}
                  >
                    <span aria-hidden="true">
                      <b>{pad(i + 1)}</b> {g.alt}
                      {g.album ? ' · ' : ''}
                    </span>
                    {g.album}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {after && <div className="wrap">{after}</div>}
    </section>
  )
}

/** "1 Video", "3 Videos" (ticket 233: one video used to read "1 Videos"). */
export function videoCountLabel(n: number): string {
  return `${n} ${n === 1 ? 'Video' : 'Videos'}`
}

export function Videos({
  videos,
  titled = true,
}: {
  videos: ChapterData['videos']
  /** False when the chapter heading already says "Videos". */
  titled?: boolean
}) {
  if (!videos.length) return null
  return (
    <>
      <div className="vids-head">
        {titled && <h3 className="h3">{videos.length === 1 ? 'Video' : 'Videos'}</h3>}
        <p className="meta">{videoCountLabel(videos.length)}</p>
      </div>
      <div className="vids">
        {videos.map((v) => {
          const inner = (
            <>
              <span className="vid-po">
                <span className="vid-src" aria-hidden="true">
                  {v.source}
                </span>
                <span className="pl">
                  <Play />
                </span>
              </span>
              <span className="vid-tx">
                <strong>
                  <span className="vh">Play </span>
                  {v.title}
                </strong>
                <span>{[v.source, v.note].filter(Boolean).join(' · ')}</span>
              </span>
            </>
          )
          return v.href ? (
            <a key={v.id} className="vid" href={v.href} {...ext(v.href)}>
              {inner}
            </a>
          ) : (
            <button key={v.id} className="vid" type="button" data-off>
              {inner}
            </button>
          )
        })}
      </div>
    </>
  )
}
