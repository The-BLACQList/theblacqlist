import type { ChapterData } from './model'
import { pad } from './model'
import type { ProfessionalPreset } from './presets'
import {
  Arr,
  Avatar,
  BookPanel,
  ChapterHeading,
  EventsList,
  Facts,
  Fig,
  FindHead,
  FindList,
  Glance,
  HappeningStrip,
  Img,
  Interlude,
  MapFig,
  MoreBand,
  OffersBlock,
  ReviewsBand,
  VisitPanelInner,
  vars,
} from './parts'

/**
 * The Professional chapters (prototype v7): composed and trust-led. A split
 * hero with the firm's numbers, then services and prices, how an engagement
 * runs, the office, the shop, reviews and the rest.
 */

/** The hero's numbers strip. F10: the rating lives in the facts row above it. */
function Numbers({ data, preset }: { data: ChapterData; preset: ProfessionalPreset }) {
  const [first, ...rest] = preset.nums
  const cell = (n: ProfessionalPreset['nums'][number]) => {
    const shown = `${n.value}${n.suffix ?? ''}`
    return (
      <div key={n.label}>
        {/* The count-up rewrites this number as it runs, so screen readers get
            the final figure from the label instead. */}
        <b aria-hidden="true" data-count={n.value} data-suf={n.suffix}>
          {shown}
        </b>
        <span>
          <span className="vh">{shown} </span>
          {n.label}
        </span>
      </div>
    )
  }
  return (
    <div className="p-nums" role="group" aria-label="The Firm in Numbers">
      {first && cell(first)}
      {data.founded && (
        <div>
          <b>{data.founded}</b>
          <span>{preset.foundedLabel}</span>
        </div>
      )}
      {rest.map(cell)}
    </div>
  )
}

export function ProfessionalChapters({
  data,
  preset,
}: {
  data: ChapterData
  preset: ProfessionalPreset
}) {
  const [il0, il1, il2] = preset.interludes
  const people = [...(data.founder ? [data.founder] : []), ...data.team]
  return (
    <>
      <header className="p-hero" id="top" data-hero>
        <div className="p-hero-text">
          <div className="p-id">
            {data.logo && <Img src={data.logo.src} alt="" width={48} height={48} priority />}
            <span className="label" style={{ color: 'var(--charcoal)' }}>
              {data.category}
            </span>
          </div>
          <h1 className="p-h1">{data.name}</h1>
          <p className="p-tag lede">{data.tagline}</p>
          <Facts data={data} />
          <div className="btn-row">
            <button className="btn btn-fill" type="button" data-off>
              {data.cta} <Arr />
            </button>
            <a className="btn btn-line" href="#services" data-example-allow-links>
              See Services and Prices
            </a>
          </div>
          <Numbers data={data} preset={preset} />
        </div>
        <figure className="p-hero-photo drift">
          {data.cover && (
            <Img className="hero-img" src={data.cover.src} alt={preset.coverAlt} priority />
          )}
        </figure>
      </header>

      <section className="band s-white" id="welcome" data-ch="welcome" aria-labelledby="h-welcome">
        <div className="wrap">
          <div className="p-split">
            <div>
              <ChapterHeading data={data} id="welcome" />
              <Glance items={data.glance} />
              <div className="prose">
                {data.story.map((para, i) => (
                  <p key={i} className={i === 0 ? 'lede rv' : 'rv'}>
                    {para}
                  </p>
                ))}
              </div>
              {people.length > 0 && (
                <ul className="p-team" aria-label="The Team">
                  {people.map((t, i) => (
                    <li key={t.id} className="rv" style={vars({ '--d': `${i * 80}ms` })}>
                      <Avatar person={t} />
                      <div>
                        <strong>{t.name}</strong>
                        <p className="r">{t.role}</p>
                        <p>{t.bio}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Fig photo={preset.welcomePhoto} className="stick drift" />
          </div>
        </div>
        <HappeningStrip data={data} />
        {data.why.length > 0 && (
          <div className="hl-band why-band" role="region" aria-labelledby="h-why">
            <div className="wrap">
              <div className="why-head">
                <h3 className="h3 hl-h" id="h-why">
                  Why People Come
                </h3>
                <p className="why-lede">What clients come to us for, in their own words.</p>
              </div>
              <ul className="hl why">
                {data.why.map((w, i) => (
                  <li key={w.id} className="rv" style={vars({ '--d': `${i * 80}ms` })}>
                    <span className="hl-n" aria-hidden="true">
                      {pad(i + 1)}
                    </span>
                    <h4 className="h4" style={{ fontSize: 19 }}>
                      {w.title}
                    </h4>
                    <p>{w.text}</p>
                    <figure className="why-q">
                      <blockquote>“{w.quote}”</blockquote>
                      <figcaption>{w.who}, Client Review</figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
      <Interlude photo={il0} />

      <section className="band s-off" id="services" data-ch="services" aria-labelledby="h-services">
        <div className="wrap">
          <ChapterHeading data={data} id="services" />
          <div className="svc">
            {data.menu.map((g, gi) => (
              <div key={g.name} className="svc-g rv" style={vars({ '--d': `${gi * 120}ms` })}>
                <h3 className="h3">{g.name}</h3>
                {g.items.map((i) => (
                  <div key={i.id} className="svc-i">
                    <div className="row">
                      <strong>{i.name}</strong>
                      <span className="pr">{i.price}</span>
                    </div>
                    <p>{i.desc}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <OffersBlock deals={data.deals} className="p-deal" lede={preset.offersLede} />
          {data.booking && (
            <BookPanel
              className="p-book"
              title={preset.booking.title}
              lede={data.booking}
              facts={preset.booking.facts}
            >
              <button className="btn btn-fill" type="button" data-off>
                {data.cta}
              </button>
            </BookPanel>
          )}
        </div>
      </section>

      {data.steps.length > 0 && (
        <section className="band s-cool" id="how" data-ch="how" aria-labelledby="h-how">
          <div className="wrap">
            <ChapterHeading data={data} id="how" />
            <ol className="steps">
              {data.steps.map((s, i) => (
                <li key={s.id} className="rv" style={vars({ '--d': `${i * 140}ms` })}>
                  <span className="sn" aria-hidden="true">
                    {pad(i + 1)}
                  </span>
                  <h3 className="h4" style={{ fontSize: 20 }}>
                    {s.title}
                  </h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
      <Interlude photo={il1} />

      <section id="visit" data-ch="visit" aria-labelledby="h-visit">
        <div className="p-visit s-ground">
          <div className="panel">
            <ChapterHeading data={data} id="visit" />
            <VisitPanelInner data={data} />
          </div>
          <div className="right">
            <MapFig colours={preset.map} address={data.address[0] ?? data.name} />
          </div>
        </div>
        <div className="s-off find-band">
          <div className="wrap">
            <FindHead title={preset.findTitle} lede={preset.findLede} />
            <div className="find">
              <FindList title="Other Offices" items={data.locations} action="Directions" />
              <FindList title="Find Us At" items={data.findUs} action="Find a Store" />
              <EventsList events={data.events} />
              {preset.gettingHere.length > 0 && (
                <div className="find-g">
                  <h3 className="h4">Getting Here</h3>
                  <ul>
                    {preset.gettingHere.map((g) => (
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

      {data.shop && (
        <section className="band s-white" id="shop" data-ch="shop" aria-labelledby="h-shop">
          <div className="wrap">
            <div className="shop-head">
              <ChapterHeading data={data} id="shop" />
              <button className="btn btn-line" type="button" data-off>
                Shop All {data.shop.total} Items <Arr />
              </button>
            </div>
            <ul className="p-shop">
              {data.shop.items.map((p, i) => (
                <li key={p.id} className="rv" style={vars({ '--d': `${i * 90}ms` })}>
                  <Fig photo={p} />
                  <p className="k">{p.kind}</p>
                  <h3>{p.name}</h3>
                  <p className="pr">{p.price}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <ReviewsBand data={data} />
      <Interlude photo={il2} />
      <MoreBand data={data} surface="s-off" />
    </>
  )
}
