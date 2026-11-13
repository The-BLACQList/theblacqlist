import { describe, expect, it } from 'vitest'
import { decodeHtml, hasUsefulFindings, nameChoices, readSite, titleName, titleParts, widthFromUrl } from '@/lib/import/read-site'

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

// A Web.com / FatCow builder page, cut down from a real bakery's site: a title
// that starts with "Home", gallery photos in divs, and settings in window._site.
const CDN = 'https://images.builderservices.io/s/cdn/v1.0/i/m?url=https%3A%2F%2Fstorage.example.com%2F'
const BUILDER = `<!doctype html>
<html><head><title>Home - Sweet Rise Bakery</title></head>
<body>
<header><nav><ul><li>Home page link</li><li>Our cakes menu</li></ul></nav>
  <img class="kv-ee-logo-image" src="${CDN}logo1&amp;methods=resize%2C500%2C5000">
  <h3 class="kv-ee-logo-title">Sweet Rise Bakery</h3>
</header>
<main>
  <h2>Welcome to Sweet Rise</h2>
  <p>Sweet Rise Bakery is a family bakery in SW Atlanta. We make custom cakes, cupcakes and cookies.</p>
  <div role="img" data-src="${CDN}aaa&amp;methods=resize%2C60%2C5000" data-src-normal="${CDN}aaa&amp;methods=resize%2C600%2C5000" data-src-retina="${CDN}aaa&amp;methods=resize%2C900%2C5000"></div>
  <div role="img" data-src="${CDN}bbb&amp;methods=crop%2C0%25%2C3%25%7Cresize%2C60%2C5000" data-src-retina="${CDN}bbb&amp;methods=crop%2C0%25%2C3%25%7Cresize%2C900%2C5000"></div>
  <div class="loading-spinner" data-src="${CDN}spin&amp;methods=resize%2C900%2C5000"></div>
  <div style="background-image: url('https://cdn.example.com/hero.jpg?w=1600')"></div>
</main>
<footer><p>Copyright Sweet Rise Bakery, all rights reserved forever.</p></footer>
<script>window._site={"metadata":{"siteName":"Sweet Rise Bakery"},"globalBinding":{"companyName":"Sweet Rise Bakery","phone":"\u202d(404) 555-0123\u202c","address":{"street":"10 Campbellton Rd SW","zip":"30311","city":"Atlanta","state":"GA","country":"US"},"openingHours":{"mon":[{"description":"Closed"}],"tue":[{"opening":"12:00pm","closing":"06:00pm"}],"sat":[{"opening":"10:00am","closing":"02:00pm"}]}}};</script>
</body></html>`

describe('readSite on a website builder page', () => {
  const f = readSite(BUILDER, 'https://www.sweetrise.com/')

  it('takes the name from the title, not the "Home" in it', () => {
    expect(f.name).toBe('Sweet Rise Bakery')
  })

  it('finds gallery photos in divs at their largest size, and skips spinners', () => {
    const photos = f.photos.filter((p) => p.kind === 'photo')
    expect(photos.map((p) => p.width)).toEqual([900, 900, 1600])
    expect(photos[0]?.url).toContain('aaa')
    expect(photos[0]?.url).toContain('resize%2C900')
    expect(f.photos.some((p) => p.url.includes('spin'))).toBe(false)
    expect(f.suggestedLogo).toContain('logo1')
  })

  it('reads the address, hours and phone from the builder data', () => {
    expect(f.address).toEqual({ street: '10 Campbellton Rd SW', city: 'Atlanta', state: 'GA', zip: '30311' })
    expect(f.hours?.tuesday).toEqual({ open: '12:00', close: '18:00', closed: false })
    expect(f.hours?.saturday).toEqual({ open: '10:00', close: '14:00', closed: false })
    expect(f.hours?.monday.closed).toBe(true)
    expect(f.hours?.sunday.closed).toBe(true)
    expect(f.phones).toEqual(['(404) 555-0123'])
  })

  it('keeps the visible text, without menus or footers, and uses the first paragraph as About', () => {
    expect(f.siteText).toContain('custom cakes, cupcakes and cookies')
    expect(f.siteText).not.toContain('Our cakes menu')
    expect(f.siteText).not.toContain('Copyright')
    expect(f.about).toBe('Sweet Rise Bakery is a family bakery in SW Atlanta. We make custom cakes, cupcakes and cookies.')
  })

  it('a broken _site is ignored', () => {
    const broken = BUILDER.replace('window._site={', 'window._site={oops')
    const g = readSite(broken, 'https://www.sweetrise.com/')
    expect(g.name).toBe('Sweet Rise Bakery')
    expect(g.address).toBeNull()
  })
})

describe('titleName', () => {
  it('drops words that name the page', () => {
    expect(titleName('Home - Cakes & Treats of Atlanta')).toBe('Cakes & Treats of Atlanta')
    expect(titleName('Welcome | Glow Salon')).toBe('Glow Salon')
    expect(titleName('Glow Salon | Natural Hair in Atlanta')).toBe('Glow Salon')
  })

  it('prefers the segment the page names elsewhere', () => {
    expect(titleName('Natural Hair in Atlanta | Glow Salon', ['Glow Salon'])).toBe('Glow Salon')
    expect(titleName('Home - Cakes &amp; Treats', ['cakes & treats'])).toBe('Cakes &amp; Treats')
  })

  it('keeps names that only start with a generic word, and hyphenated names', () => {
    expect(titleName('Main Street Cafe')).toBe('Main Street Cafe')
    expect(titleName('Home Sweet Home Bakery - Decatur')).toBe('Home Sweet Home Bakery')
    expect(titleName('Jean-Paul Bistro')).toBe('Jean-Paul Bistro')
  })

  it('falls back to the title when every part is generic', () => {
    expect(titleName('Home')).toBe('Home')
  })

  it('a generic title is no name at all', () => {
    const f = readSite('<title>Home</title><p>Nothing else to see on this page at all, really.</p>', 'https://x.com/')
    expect(f.name).toBeNull()
  })
})

describe('name choices', () => {
  it('splits titles on every separator sites use', () => {
    expect(titleParts('Glow Salon|Hair Studio|Atlanta GA')).toEqual(['Glow Salon', 'Hair Studio', 'Atlanta GA'])
    expect(titleParts('Glow Salon » Hair')).toEqual(['Glow Salon', 'Hair'])
    expect(titleParts('Glow Salon / Hair ~ Atlanta')).toEqual(['Glow Salon', 'Hair', 'Atlanta'])
    expect(titleParts('Glow Salon :: Hair')).toEqual(['Glow Salon', 'Hair'])
    expect(titleParts('Jean-Paul Bistro')).toEqual(['Jean-Paul Bistro'])
    expect(titleParts('AC/DC Repair')).toEqual(['AC/DC Repair'])
  })

  it('offers each part once, best first, without page words or sentences', () => {
    const long = 'We are the best natural hair salon in all of metro Atlanta and have been since the year 2004'
    expect(
      nameChoices('Glow Salon', ['Home | Glow Salon | Hair Studio', 'glow  salon', 'Hair Studio', long, null])
    ).toEqual(['Glow Salon', 'Hair Studio'])
  })

  it('keeps at most six, and drops the @ on link-in-bio pages', () => {
    expect(nameChoices(null, ['a1 | b2 | c3 | d4 | e5 | f6 | g7'])).toHaveLength(6)
    expect(nameChoices('kingsbarbers', ['@kingsbarbers', '@kings'], true)).toEqual(['kingsbarbers', 'kings'])
  })

  it('a tagline heading no longer wins the name', () => {
    const f = readSite(
      '<title>Glow Salon | Atlanta Hair</title><h1>Atlanta Hair</h1><p>We do natural hair, braids and color in Atlanta.</p>',
      'https://glow.test/'
    )
    expect(f.name).toBe('Glow Salon')
    expect(f.nameOptions).toEqual(['Glow Salon', 'Atlanta Hair'])
  })

  it('a bare | still splits', () => {
    const f = readSite('<title>Glow Salon|Hair Studio|Atlanta GA</title><p>Hair.</p>', 'https://glow.test/')
    expect(f.name).toBe('Glow Salon')
    expect(f.nameOptions).toEqual(['Glow Salon', 'Hair Studio', 'Atlanta GA'])
  })
})

describe('widthFromUrl', () => {
  it('reads the width each image host was asked for', () => {
    expect(widthFromUrl(`${CDN}a&methods=crop%2C0%25%7Cresize%2C900%2C5000`)).toBe(900)
    expect(widthFromUrl('https://static.wixstatic.com/media/a.jpg/v1/fill/w_980,h_600,al_c/a.jpg')).toBe(980)
    expect(widthFromUrl('https://images.squarespace-cdn.com/a/b.jpg?format=1500w')).toBe(1500)
    expect(widthFromUrl('https://img1.wsimg.com/isteam/ip/abc/x.jpg/:/rs=w:1200,h:600')).toBe(1200)
    expect(widthFromUrl('https://cdn.shopify.com/s/files/1/cake_800x.jpg?v=1')).toBe(800)
    expect(widthFromUrl('https://cdn.example.com/a.jpg?w=640')).toBe(640)
    expect(widthFromUrl('https://cdn.example.com/a.jpg?width=720')).toBe(720)
  })

  it('returns null when the URL says nothing', () => {
    expect(widthFromUrl('https://cdn.example.com/a.jpg')).toBeNull()
    expect(widthFromUrl('not a url')).toBeNull()
  })
})
