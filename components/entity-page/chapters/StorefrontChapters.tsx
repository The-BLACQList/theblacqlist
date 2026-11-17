import type { ChapterData, MenuGroup, PersonView } from './model'
import { initials, pad } from './model'
import type { StorefrontPreset } from './presets'
import {
  Arr,
  BookPanel,
  ChapterHeading,
  Disc,
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
  OffersBlock,
  ReviewsBand,
  Videos,
  VisitPanelInner,
  vars,
} from './parts'

/** The Storefront chapters (prototype v7): warm, photo-led, Visit straight after Welcome. */

function MenuGroupBlock({ group }: { group: MenuGroup }) {
  return (
    <div className="mgrp">
      <h3>{group.name}</h3>
      <div className="mgrid">
        {group.items.map((i) => (
          <div key={i.id} className="mi">
            <div className="row">
              <span>{i.name}</span>
              <span>{i.price}</span>
            </div>
            <p>{i.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function Avatar({ person }: { person: PersonView }) {
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

/** "12 Photos · Interior, Drinks, Food", from the gallery itself so it never drifts. */
function galleryLead(data: ChapterData): string {
  const albums = [...new Set(data.gallery.map((g) => g.album).filter(Boolean))]
  const n = data.gallery.length
  return `${n} Photo${n === 1 ? '' : 's'}${albums.length ? ` · ${albums.join(', ')}` : ''}`
}

export function StorefrontChapters({
  data,
  preset,
}: {
  data: ChapterData
  preset: StorefrontPreset
}) {
  const moreMenu = data.menu.slice(2)
  const moreItems = moreMenu.reduce((n, g) => n + g.items.length, 0)
  const [il0, il1, il2] = preset.interludes
  return (
    <>
      <header className="s-hero" id="top" data-hero>
        <div className="s-hero-photo">
          {data.cover && (
            <Img className="hero-img" src={data.cover.src} alt={preset.coverAlt} priority />
          )}
        </div>
        <div className="wrap s-hero-foot">
          <div className="s-plate">
            <div className="s-id">
              {data.logo && <Img src={data.logo.src} alt="" width={52} height={52} priority />}
              <span className="label" style={{ color: 'var(--charcoal)' }}>
                {data.category}
              </span>
            </div>
            <h1 className="s-h1">{data.name}</h1>
            <p className="s-tag lede">{data.tagline}</p>
            <Facts data={data} />
            <div className="btn-row">
              <button
                className="btn btn-fill"
                type="button"
                data-off
                style={vars({ '--btn': 'var(--amber)', '--btn-fg': '#fff' })}
              >
                {data.cta} <Arr />
              </button>
              <a className="btn btn-line" href="#visit" data-example-allow-links>
                Hours and Directions
              </a>
              <button className="tlink" type="button" data-off>
                Save
              </button>
            </div>
          </div>
        </div>
      </header>

      <section
        className="band s-warm"
        id="welcome"
        data-ch="welcome"
        aria-labelledby="h-welcome"
        style={{ paddingTop: 'clamp(24px,3vw,40px)' }}
      >
        <div className="wrap">
          <div className="s-split">
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
            </div>
            <div className="s-duo">
              <Fig photo={preset.duo[0]} className="drift rv" />
              <Fig photo={preset.duo[1]} className="drift rv" style={vars({ '--d': '150ms' })} />
            </div>
          </div>
        </div>
        <HappeningStrip data={data} />
        {data.highlights.length > 0 && (
          <div className="hl-band">
            <div className="wrap">
              <h3 className="h3 hl-h">What Makes Us Different</h3>
              <ul className="hl">
                {data.highlights.map((h, i) => (
                  <li key={h.id} className="rv" style={vars({ '--d': `${i * 80}ms` })}>
                    <span className="hl-n" aria-hidden="true">
                      {pad(i + 1)}
                    </span>
                    <h4 className="h4" style={{ fontSize: 19 }}>
                      {h.title}
                    </h4>
                    <p>{h.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <div className="wrap">
          <div className="people">
            {data.founder && (
              <div>
                <h3 className="h3" style={{ marginBottom: 20 }}>
                  Meet the Owner
                </h3>
                <div className="founder rv">
                  <Avatar person={data.founder} />
                  <div>
                    <p className="founder nm" style={{ display: 'block' }}>
                      {data.founder.name}
                    </p>
                    <p className="meta">{data.founder.role}</p>
                    <p className="bio">{data.founder.bio}</p>
                  </div>
                </div>
              </div>
            )}
            {data.team.length > 0 && (
              <div>
                <h3 className="h3" style={{ marginBottom: 20 }}>
                  The Team
                </h3>
                <ul className="team">
                  {data.team.map((t, i) => (
                    <li key={t.id} className="rv" style={vars({ '--d': `${i * 80}ms` })}>
                      <Avatar person={t} />
                      <div>
                        <strong>{t.name}</strong>
                        <p className="meta" style={{ fontSize: 15 }}>
                          {t.role}
                        </p>
                        <p>{t.bio}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>
      <Interlude photo={il0} />

      <section id="visit" data-ch="visit" aria-labelledby="h-visit">
        <div className="s-visit s-ink">
          <div className="panel">
            <ChapterHeading data={data} id="visit" />
            <VisitPanelInner data={data} />
          </div>
          <MapFig colours={preset.map} address={data.address[0] ?? data.name} />
        </div>
        <div className="s-stone find-band">
          <div className="wrap">
            <FindHead title="Where Else to Find Us" lede={preset.findLede} />
            <div className="find">
              <FindList title="Other Locations" items={data.locations} action="Directions" />
              <FindList title="Find Us At" items={data.findUs} action="Find a Store" />
              <FindList title="Order On" items={data.orderOn} action="Order" />
              <EventsList events={data.events} />
            </div>
          </div>
        </div>
      </section>

      <section className="band s-white" id="menu" data-ch="menu" aria-labelledby="h-menu">
        <div className="wrap">
          <div className="s-menu">
            <div>
              <ChapterHeading data={data} id="menu" />
              {data.menu.slice(0, 2).map((g) => (
                <MenuGroupBlock key={g.name} group={g} />
              ))}
              {moreMenu.length > 0 && (
                <Disc
                  id="more-menu"
                  buttonClassName="more-bar"
                  label={
                    <>
                      <span className="mb-l">Show the Full Menu</span>
                      <span className="mb-n">
                        {moreItems} More Items · {moreMenu.map((g) => g.name).join(', ')}
                      </span>
                    </>
                  }
                >
                  {moreMenu.map((g) => (
                    <MenuGroupBlock key={g.name} group={g} />
                  ))}
                </Disc>
              )}
            </div>
            <Fig photo={preset.menuPhoto} className="stick drift" />
          </div>
          <OffersBlock deals={data.deals} className="deal" lede={preset.offersLede} />
          {data.booking && (
            <BookPanel
              className="book"
              title={preset.booking.title}
              lede={data.booking}
              facts={preset.booking.facts}
            >
              <button className="btn btn-fill" type="button" data-off>
                {preset.booking.action}
              </button>
            </BookPanel>
          )}
        </div>
      </section>
      <Interlude photo={il1} />

      {data.shop && (
        <section className="band s-stone" id="shop" data-ch="shop" aria-labelledby="h-shop">
          <div className="wrap">
            <div className="shop-head">
              <ChapterHeading data={data} id="shop" />
              <button className="btn btn-line" type="button" data-off>
                Shop All {data.shop.total} Items <Arr />
              </button>
            </div>
            <ul className="s-shop">
              {data.shop.items.map((p, i) => (
                <li key={p.id} className="prod rv" style={vars({ '--d': `${(i % 3) * 90}ms` })}>
                  <Fig photo={p} />
                  <h3>{p.name}</h3>
                  <p className="pr">{p.price}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <Glide
        data={data}
        id="gallery"
        items={data.gallery}
        surface="s-white"
        lead={<p className="meta">{galleryLead(data)}</p>}
        after={<Videos videos={data.videos} />}
      />

      <ReviewsBand data={data} />
      <Interlude photo={il2} />
      <MoreBand data={data} surface="s-stone" />
    </>
  )
}
