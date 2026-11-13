# 201: A custom subdomain per business — `name.theblacqlist.com`

**Status:** Stub — founder 2026-11-13. Not on the sample page; needs a decision before it is built. Larger than the others; its own security and SEO review.
**Follows:** 184
**Area:** routing (`proxy.ts`), DNS and Vercel domains, SEO

**Problem.** The literal "feels like a website": a Premium business wants an address of its own to print on a card.

**Proposed shape.** A wildcard subdomain on the platform domain, host-based rewrite in `proxy.ts` to the listing route, canonical URL kept on the path form (or flipped, decided in the review), cookies scoped to the apex, later custom domains through the Vercel Domains API. Needs its own look at auth cookies, the coming-soon gate and `robots`/sitemap behaviour per host.

**Depends on.** 184. **Gate.** security review; GATE-DEPLOY for the DNS change.
