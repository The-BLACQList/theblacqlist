import { describe, expect, it } from 'vitest'
import { decodeHtml, hasUsefulFindings, readSite } from '@/lib/import/read-site'

// Saved pages stand in for owners' sites. No live site is ever fetched in CI.

const SALON = `<!doctype html>
<html><head>
<title>Glow Salon | Natural Hair in Atlanta</title>
<meta property="og:image" content="/img/storefront.jpg">
<meta property="og:image:width" content="1200">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "name": "Glow Salon site", "url": "https://glowsalon.com" },
    {
      "@type": "HairSalon",
      "name": "Glow Salon",
      "description": "Natural hair care &amp; braiding in the West End since 2012.",
      "telephone": "+1 404-555-0182",
      "email": "hello@glowsalon.com",
      "logo": "https://glowsalon.com/img/logo.png",
      "image": ["https://glowsalon.com/img/chair.jpg"],
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "123 Ralph David Abernathy Blvd",
        "addressLocality": "Atlanta",
        "addressRegion": "GA",
        "postalCode": "30310"
      },
      "openingHoursSpecification": [
        { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Tuesday","Wednesday","Thursday","Friday"], "opens": "09:00", "closes": "19:00" },
        { "@type": "OpeningHoursSpecification", "dayOfWeek": "https://schema.org/Saturday", "opens": "08:00:00", "closes": "00:00" },
        { "@type": "OpeningHoursSpecification", "dayOfWeek": "Monday", "opens": "10:00", "closes": "14:00", "validFrom": "2026-12-24", "validThrough": "2026-12-24" }
      ],
      "sameAs": [
        "https://www.instagram.com/glowsalonatl/",
        "https://facebook.com/glowsalonatl"
      ]
    }
  ]
}
</script>
<script type="application/ld+json">{ broken json </script>
</head><body>
<a href="tel:4045550182">Call</a>
<a href="tel:+1-404-555-0199">Text line</a>
<a href="https://www.facebook.com/sharer/sharer.php?u=x">Share</a>
<a href="https://www.tiktok.com/@glowsalonatl?lang=en">TikTok</a>
<img src="/img/logo-small.png" alt="Glow Salon logo" width="120">
<img src="/img/wash.jpg" width="1600" alt="Wash station">
<img src="/img/icon.svg" width="800">
<img src="/img/tiny.jpg" width="80">
<img src="/img/fallback.jpg" srcset="/img/braids-480.jpg 480w, /img/braids-1440.jpg 1440w">
<img src="data:image/png;base64,AAAA" width="900">
</body></html>`

const BARE = `<html><head><title>Mama's Kitchen - Soul Food</title></head>
<body><p>Call us at <a href="tel:(773) 555-0123">773-555-0123</a></p></body></html>`

const LINKTREE = `<html><head>
<title>@kingsbarbershop | Linktree</title>
<meta property="og:description" content="Linktree. Make your link do more.">
</head><body>
<a href="https://linktr.ee/">Linktree</a>
<a href="https://apps.apple.com/app/linktree">Get the app</a>
<a href="https://www.instagram.com/kingsbarbershop">Instagram</a>
<a href="https://www.youtube.com/@kingsbarbershop">YouTube</a>
<a href="https://x.com/kingsbarber">X</a>
<a href="https://kingsbarbershop.com/book">Book a cut</a>
<a href="https://squareup.com/store/kings">Shop</a>
<a href="mailto:kings@kingsbarbershop.com?subject=Hi">Email</a>
</body></html>`

describe('readSite on a JSON-LD salon page', () => {
  const f = readSite(SALON, 'https://www.glowsalon.com/')

  it('reads the business, not the WebSite node', () => {
    expect(f.sourceHost).toBe('glowsalon.com')
    expect(f.isLinkInBio).toBe(false)
    expect(f.name).toBe('Glow Salon')
    expect(f.about).toBe('Natural hair care & braiding in the West End since 2012.')
  })

  it('collects every distinct phone, most trusted first', () => {
    expect(f.phones).toEqual(['(404) 555-0182', '(404) 555-0199'])
    expect(f.emails).toEqual(['hello@glowsalon.com'])
  })

  it('reads the street address', () => {
    expect(f.address).toEqual({
      street: '123 Ralph David Abernathy Blvd',
      city: 'Atlanta',
      state: 'GA',
      zip: '30310',
    })
  })

  it('maps hours to the weekly shape, skipping holiday hours', () => {
    expect(f.hours?.monday.closed).toBe(true)
    expect(f.hours?.tuesday).toEqual({ open: '09:00', close: '19:00', closed: false })
    expect(f.hours?.friday).toEqual({ open: '09:00', close: '19:00', closed: false })
    // A midnight close is stored as 23:59 so the open-now check works.
    expect(f.hours?.saturday).toEqual({ open: '08:00', close: '23:59', closed: false })
    expect(f.hours?.sunday.closed).toBe(true)
  })

  it('keeps profile links and drops share buttons and tracking', () => {
    expect(f.socials).toEqual({
      instagram: 'https://www.instagram.com/glowsalonatl/',
      facebook: 'https://facebook.com/glowsalonatl',
      tiktok: 'https://www.tiktok.com/@glowsalonatl',
    })
    expect(f.website).toBe('https://www.glowsalon.com/')
  })

  it('offers large photos and the logo, never svg, tiny or inline images', () => {
    const urls = f.photos.map((p) => p.url)
    expect(f.suggestedLogo).toBe('https://glowsalon.com/img/logo.png')
    expect(f.suggestedCover).toBe('https://www.glowsalon.com/img/storefront.jpg')
    expect(urls).toContain('https://www.glowsalon.com/img/wash.jpg')
    expect(urls).toContain('https://www.glowsalon.com/img/braids-1440.jpg')
    expect(urls).toContain('https://www.glowsalon.com/img/logo-small.png')
    expect(urls.some((u) => u.endsWith('.svg'))).toBe(false)
    expect(urls.some((u) => u.includes('tiny'))).toBe(false)
    expect(urls.some((u) => u.startsWith('data:'))).toBe(false)
    expect(hasUsefulFindings(f)).toBe(true)
  })
})

describe('readSite on a bare page', () => {
  const f = readSite(BARE, 'https://mamaskitchen.com/')

  it('fills the name from the title and the phone from the link, without error', () => {
    expect(f.name).toBe("Mama's Kitchen")
    expect(f.phones).toEqual(['(773) 555-0123'])
    expect(f.about).toBeNull()
    expect(f.address).toBeNull()
    expect(f.hours).toBeNull()
    expect(f.photos).toEqual([])
    expect(hasUsefulFindings(f)).toBe(true)
  })

  it('says nothing useful came back for a title-only page', () => {
    const empty = readSite('<title>Coming soon</title>', 'https://parked.example/')
    expect(empty.name).toBe('Coming soon')
    expect(hasUsefulFindings(empty)).toBe(false)
  })

  it('never throws on junk', () => {
    expect(() => readSite('<<<>>><script type="application/ld+json">[', 'https://x.test/')).not.toThrow()
  })
})

describe('readSite on a link-in-bio page', () => {
  const f = readSite(LINKTREE, 'https://linktr.ee/kingsbarbershop')

  it('turns outbound links into the website and socials', () => {
    expect(f.isLinkInBio).toBe(true)
    expect(f.name).toBe('kingsbarbershop')
    expect(f.website).toBe('https://kingsbarbershop.com/book')
    expect(f.socials).toEqual({
      instagram: 'https://www.instagram.com/kingsbarbershop',
      youtube: 'https://www.youtube.com/@kingsbarbershop',
      twitter: 'https://x.com/kingsbarber',
    })
    expect(f.emails).toEqual(['kings@kingsbarbershop.com'])
  })

  it("drops the platform's own tagline", () => {
    expect(f.about).toBeNull()
  })
})

// Squarespace's shape: the address as one string, several phones in one
// field, and the wordmark shared as the page image over http.
const SQUARESPACE = `<!doctype html>
<html><head>
<title>Gallery Example</title>
<meta property="og:image" content="http://static1.squarespace.com/static/abc/t/1/website+logo-01.png?format=1500w">
<meta property="og:image:width" content="1500">
<meta property="og:image:height" content="126">
<script type="application/ld+json">{"name":"Gallery Example","@type":"WebSite"}</script>
<script type="application/ld+json">{"legalName":"Gallery Example","address":"436 East 47th Street\\nChicago, IL, 60653\\nUnited States","telephone":"(773) 555-0100, (708) 555-0101","@type":"Organization"}</script>
</head><body>
<img src="https://images.squarespace-cdn.com/content/v1/abc/gallery-wall.jpg" data-image-dimensions="2500x1667" alt="The gallery wall">
</body></html>`

describe('readSite on a Squarespace page', () => {
  const f = readSite(SQUARESPACE, 'https://www.galleryexample.com/')

  it('splits a one-string address into street, city, state and zip', () => {
    expect(f.address).toEqual({ street: '436 East 47th Street', city: 'Chicago', state: 'IL', zip: '60653' })
  })

  it('splits several phones listed in one field', () => {
    expect(f.phones).toEqual(['(773) 555-0100', '(708) 555-0101'])
  })

  it('treats a shared wordmark as the logo, not the cover, and asks for it over https', () => {
    expect(f.suggestedLogo).toBe('https://static1.squarespace.com/static/abc/t/1/website+logo-01.png?format=1500w')
    expect(f.suggestedCover).toBe('https://images.squarespace-cdn.com/content/v1/abc/gallery-wall.jpg')
  })

  it('keeps an address it cannot split as the street', () => {
    const page = SQUARESPACE.replace('436 East 47th Street\\nChicago, IL, 60653\\nUnited States', 'Unit 4, The Old Mill')
    expect(readSite(page, 'https://www.galleryexample.com/').address).toEqual({
      street: 'Unit 4, The Old Mill',
      city: null,
      state: null,
      zip: null,
    })
  })
})

describe('readSite hours in the short text form', () => {
  it('reads "Mo-Fr 09:00-17:00" and "Sa,Su 10:00-14:00"', () => {
    const html = `<script type="application/ld+json">{"@type":"Restaurant","name":"X","openingHours":["Mo-Fr 09:00-17:00","Sa,Su 10:00-14:00"]}</script>`
    const f = readSite(html, 'https://x.test/')
    expect(f.hours?.monday).toEqual({ open: '09:00', close: '17:00', closed: false })
    expect(f.hours?.friday).toEqual({ open: '09:00', close: '17:00', closed: false })
    expect(f.hours?.saturday).toEqual({ open: '10:00', close: '14:00', closed: false })
    expect(f.hours?.sunday).toEqual({ open: '10:00', close: '14:00', closed: false })
  })

  it('wraps a range across the weekend', () => {
    const html = `<script type="application/ld+json">{"@type":"BarOrPub","name":"Y","openingHours":"Fr-Mo 18:00-24:00"}</script>`
    const f = readSite(html, 'https://y.test/')
    expect(f.hours?.friday).toEqual({ open: '18:00', close: '23:59', closed: false })
    expect(f.hours?.monday.closed).toBe(false)
    expect(f.hours?.tuesday.closed).toBe(true)
  })
})

describe('decodeHtml', () => {
  it('honors a declared charset', () => {
    const body = Buffer.concat([
      Buffer.from('<meta charset="windows-1252"><p>Caf'),
      Buffer.from([0xe9]),
      Buffer.from('</p>'),
    ])
    expect(decodeHtml(body)).toContain('Café')
  })

  it('falls back to utf-8 for an unknown label', () => {
    expect(decodeHtml(Buffer.from('<meta charset="nonsense"><p>ok</p>'))).toContain('ok')
  })
})
