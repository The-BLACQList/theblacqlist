import type { ChapterData, GlidePhoto } from './model'
import { pad } from './model'
import type { CreativePreset } from './presets'
import {
  Arr,
  Avatar,
  BookPanel,
  ChapterHeading,
  DealCard,
  EventsList,
  Facts,
  Fig,
  FindHead,
  FindList,
  Glance,
  Glide,
  HappeningStrip,
  Img,
  Interlude,
  MapFig,
  MoreBand,
  ReviewsBand,
  VisitPanelInner,
  vars,
} from './parts'

/**
 * The Creative chapters (prototype v7): gallery-led, with bold imagery. A
 * split hero with the studio photo, the welcome and team, selected work as a
 * glide, commissions, the print shop, the studio, reviews and the rest.
 */

/**
 * Selected Work: the work albums only, without the photos the page already
 * shows elsewhere (the welcome photo and the interludes), so no photo repeats.
 */
function workItems(data: ChapterData, preset: CreativePreset): GlidePhoto[] {
  const shown = new Set([preset.welcomePhoto.src, ...preset.interludes.map((p) => p.src)])
  return data.gallery.filter((g) => preset.workAlbums.includes(g.album) && !shown.has(g.src))
}

/** "7 Pieces · Identity, Murals, Print", from the pieces themselves. */
function workLead(items: GlidePhoto[]): string {
  const albums = [...new Set(items.map((g) => g.album).filter(Boolean))]
  const n = items.length
  return `${n} Piece${n === 1 ? '' : 's'}${albums.length ? ` · ${albums.join(', ')}` : ''}`
}

export function CreativeChapters({ data, preset }: { data: ChapterData; preset: CreativePreset }) {
  const [il0, il1, il2] = preset.interludes
  const people = [...(data.founder ? [data.founder] : []), ...data.team]
  const work = workItems(data, preset)
  return (
    <>
      {/* Photo first (founder, 2026-11-18, ticket 206), in the markup too, so
          screen readers meet the hero in the order it is seen: the photo's
          description, then the name. The figure holds nothing focusable. */}
      <header className="c-hero" id="top" data-hero>
        <figure className="c-a drift" style={vars({ '--k': '6%' })}>
          {data.cover && (
            <Img className="hero-img" src={data.cover.src} alt={preset.coverAlt} priority />
          )}
        </figure>
        {/* The photo's alt text already says this; the caption is for sighted readers. */}
        <p className="c-cap" aria-hidden="true">
          {preset.coverAlt}
        </p>
        <div className="c-title">
          <div className="c-meta">
            {data.logo && <Img src={data.logo.src} alt="" width={48} height={48} priority />}
            <span className="label" style={{ color: 'var(--charcoal)' }}>
              {data.category}
            </span>
          </div>
          <h1 className="c-h1">{data.name}</h1>
          <p className="c-tag lede">{data.tagline}</p>
          <Facts data={data} />
          <div className="btn-row">
            <button className="btn btn-fill" type="button" data-off>
              {data.cta} <Arr />
            </button>
            {work.length > 0 && (
              <a className="btn btn-line" href="#work" data-example-allow-links>
                See the Work
              </a>
            )}
          </div>
        </div>
      </header>

      <section
        className="band s-off c-big"
        id="welcome"
        data-ch="welcome"
        aria-labelledby="h-welcome"
      >
        <div className="wrap">
          <ChapterHeading data={data} id="welcome" />
          <Glance items={data.glance} />
          <div className="c-welcome">
            <div className="prose">
              {data.story.map((para, i) => (
                <p key={i} className={i === 0 ? 'lede rv' : 'rv'}>
                  {para}
                </p>
              ))}
            </div>
            <Fig photo={preset.welcomePhoto} className="drift rv" />
            {people.length > 0 && (
              <div className="c-team-w">
                <h3 className="h3 ct-h">Meet the Team</h3>
                <ul className="c-team">
                  {people.map((t, i) => (
                    <li
                      key={t.id}
                      className={`rv ${t.photo ? 'has-ph' : 'has-av'}`}
                      style={vars({ '--d': `${i * 90}ms` })}
                    >
                      {t.photo ? (
                        <figure className="ct-ph">
                          <Img src={t.photo.src} alt={t.photo.alt} />
                        </figure>
                      ) : (
                        <Avatar person={t} />
                      )}
                      <div className="ct-tx">
                        <strong>{t.name}</strong>
                        <span className="r">{t.role}</span>
                        <p>{t.bio}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <HappeningStrip data={data} />
      </section>
      <Interlude photo={il0} />

      {work.length > 0 && (
        <Glide
          data={data}
          id="work"
          items={work}
          surface="s-ground c-big"
          lead={<p className="meta">{workLead(work)}</p>}
        />
      )}

      <section
        className="band s-white c-big"
        id="commissions"
        data-ch="commissions"
        aria-labelledby="h-commissions"
      >
        <div className="wrap">
          <ChapterHeading data={data} id="commissions" />
          <div className="c-com">
            <div>
              {data.menu.map((g) => (
                <div key={g.name} className="c-svc-g rv">
                  <h3 className="h3">
                    {g.name}
                    <span className="meta" style={{ fontSize: 15, fontWeight: 400 }}>
                      {g.items.length} Service{g.items.length === 1 ? '' : 's'}
                    </span>
                  </h3>
                  {g.items.map((i) => (
                    <div key={i.id} className="c-svc-i">
                      <strong>{i.name}</strong>
                      <span className="pr">{i.price}</span>
                      <p>{i.desc}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <aside className="c-aside" aria-label="Start a Commission">
              {data.booking && (
                <BookPanel
                  className="c-ask"
                  title={preset.booking.title}
                  lede={data.booking}
                  facts={preset.booking.facts}
                >
                  <button className="btn btn-fill" type="button" data-off>
                    {data.cta} <Arr />
                  </button>
                  <button className="tlink" type="button" data-off>
                    Commission Guide (PDF)
                  </button>
                </BookPanel>
              )}
              {data.deals.length > 0 && (
                <div className="aside-offers">
                  <p className="aside-h">
                    Offers <span>{data.deals.length} Current</span>
                  </p>
                  {data.deals.map((x, i) => (
                    <DealCard key={x.id} deal={x} className="c-deal" index={i} />
                  ))}
                </div>
              )}
            </aside>
          </div>
          {data.steps.length > 0 && (
            <div className="c-steps">
              <h3 className="h3" style={{ marginBottom: 28 }}>
                How a Commission Works
              </h3>
              <ol className="steps">
                {data.steps.map((s, i) => (
                  <li key={s.id} className="rv" style={vars({ '--d': `${i * 140}ms` })}>
                    <span className="sn" aria-hidden="true">
                      {pad(i + 1)}
                    </span>
                    <h4 className="h4" style={{ fontSize: 20 }}>
                      {s.title}
                    </h4>
                    <p>{s.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>
      <Interlude photo={il1} />

      {data.shop && (
        <section className="band s-white c-big" id="shop" data-ch="shop" aria-labelledby="h-shop">
          <div className="wrap">
            <div className="shop-head">
              <ChapterHeading data={data} id="shop" />
            </div>
            <ul className="c-shop">
              {data.shop.items.map((p, i) => (
                <li key={p.id} className="prod rv" style={vars({ '--d': `${i * 80}ms` })}>
                  <Fig photo={p} />
                  <div className="meta-row">
                    <h3>{p.name}</h3>
                    <p className="pr">{p.price}</p>
                  </div>
                </li>
              ))}
              <li className="c-shop-all">
                <button type="button" data-off>
                  <span>
                    Shop All {data.shop.total} {preset.shopNoun}
                  </span>
                  <Arr />
                </button>
              </li>
            </ul>
          </div>
        </section>
      )}

      <section className="s-warm" id="visit" data-ch="visit" aria-labelledby="h-visit">
        <div className="c-visit">
          <MapFig colours={preset.map} address={data.address[0] ?? data.name} />
          <div className="c-card c-big">
            <ChapterHeading data={data} id="visit" />
            <VisitPanelInner data={data} />
          </div>
        </div>
        <div className="find-band">
          <div className="wrap">
            <FindHead title={preset.findTitle} lede={preset.findLede} />
            <div className="find">
              <FindList title="Gallery and Pop-Up" items={data.locations} action="Directions" />
              <FindList title="Stocked At" items={data.findUs} action="Find a Store" />
              <EventsList events={data.events} />
              {preset.openStudio.length > 0 && (
                <div className="find-g">
                  <h3 className="h4">Open Studio</h3>
                  <ul>
                    {preset.openStudio.map((g) => (
                      <li key={g.title}>
                        <strong>{g.title}</strong>
                        <span>{g.note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <ReviewsBand data={data} />
      <Interlude photo={il2} />
      <MoreBand data={data} surface="s-white" />
    </>
  )
}
