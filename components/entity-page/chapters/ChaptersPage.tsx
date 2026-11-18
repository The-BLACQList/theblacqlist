import type { ReactNode } from 'react'
import './chapters.css'
import { ChaptersBehaviour } from './ChaptersBehaviour'
import type { ChapterData } from './model'
import { pad } from './model'
import { Arl, Arr, Chev, Img, ext } from './parts'
import { ContactLink } from '@/components/entity-page/ContactLink'

/**
 * The chapters page frame (ticket 204): the sticky chapter nav (a list on
 * desktop, a dropdown on phones), the type's chapters, the phone quick bar,
 * and the toast and photo viewer the behaviour script drives. Server
 * rendered; ChaptersBehaviour adds motion and the interactive bits.
 */
export function ChaptersPage({
  data,
  type,
  children,
}: {
  data: ChapterData
  type: 'storefront' | 'professional' | 'creative'
  children: ReactNode
}) {
  const first = data.chapters[0]
  const live = data.live
  const hasVisit = data.chapters.some((c) => c.id === 'visit')
  const items = data.chapters.map((c, i) => (
    <li key={c.id}>
      <a href={`#${c.id}`} data-nav={c.id} data-example-allow-links>
        <span className="n">{pad(i + 1)}</span>
        {c.nav}
      </a>
    </li>
  ))
  return (
    <div className={`lp t-${type}`} id="lp-root" data-listing={live?.listingId}>
      <nav className="cnav" aria-label="Chapters">
        <div className="wrap">
          <a className="cnav-id" href="#top" data-example-allow-links>
            {data.logo && <Img src={data.logo.src} alt="" priority />}
            <span>{data.name}</span>
          </a>
          <ol>{items}</ol>
          {live ? (
            live.cta && (
              <ContactLink
                className="btn btn-fill"
                href={live.cta.href}
                listingId={live.listingId}
                source="hero"
                {...ext(live.cta.href)}
              >
                {live.cta.label}
              </ContactLink>
            )
          ) : (
            <button className="btn btn-fill" type="button" data-off>
              {data.cta}
            </button>
          )}
        </div>
        <div className="prog">
          <span />
        </div>
      </nav>
      <nav className="mnav" aria-label="Chapters">
        <button className="mnav-btn" type="button" aria-expanded="false" aria-controls="mlist">
          <span className="n">01</span>
          <span className="t">{first?.nav}</span>
          <span className="of">of {pad(data.chapters.length)}</span>
          <Chev />
        </button>
        <div className="prog">
          <span />
        </div>
        <ol className="mnav-list" id="mlist" hidden>
          {items}
        </ol>
      </nav>
      <main>{children}</main>
      {live ? (
        (hasVisit || live.cta) && (
          <div className="quick" role="region" aria-label="Quick actions" data-quick-bar="shown">
            {hasVisit && (
              <a className="btn btn-line" href="#visit">
                Hours and Directions
              </a>
            )}
            {live.cta && (
              <ContactLink
                className="btn btn-fill"
                href={live.cta.href}
                listingId={live.listingId}
                source="action_bar"
                {...ext(live.cta.href)}
              >
                {live.cta.label}
              </ContactLink>
            )}
          </div>
        )
      ) : (
        <div className="quick" role="region" aria-label="Quick actions" data-quick-bar="shown">
          <a className="btn btn-line" href="#visit" data-example-allow-links>
            Hours and Directions
          </a>
          <button className="btn btn-fill" type="button" data-off>
            {data.cta.replace('Book a Discovery Call', 'Book a Call')}
          </button>
        </div>
      )}
      <div className="toast" role="status" aria-live="polite" data-toast />
      <dialog className="lb" aria-labelledby="lbCap" data-lb>
        <figure className="lb-in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img data-lb-img src={undefined} alt="" />
          <figcaption className="lb-bar">
            <span>
              <strong id="lbCap" data-lb-cap />
              <span className="lb-alt" data-lb-alt />
            </span>
            <span className="lb-ctl">
              <button type="button" data-lbm="-1" aria-label="Previous photo">
                <Arl />
              </button>
              <span className="lb-n" data-lb-n />
              <button type="button" data-lbm="1" aria-label="Next photo">
                <Arr />
              </button>
              <button type="button" className="lb-x" data-lbm="x">
                Close
              </button>
            </span>
          </figcaption>
        </figure>
      </dialog>
      <ChaptersBehaviour rootId="lp-root" />
    </div>
  )
}
