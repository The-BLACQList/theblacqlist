# Ticket 127: Bring in what you already have (site import)

**Phase:** V1.5 · **Priority:** P1 · **Status:** Blocked on approval
**Depends on:** 126
**Gates:** Dependency approval (an HTML parser, and moving `sharp` to dependencies). Privacy and Legal review of the photo-rights line `[Needs professional review]`. Behind `FEATURE_SITE_IMPORT`.
**Decision record:** [add-business-workshop-2026-10.md](../design/add-business-workshop-2026-10.md)

---

## Why

The founder wants owners to type less. Owners give a website or link-in-bio link first, and we fill the draft from what they already published. Today no server code fetches an owner-supplied URL (the security audit passed SSRF only because of that, `docs/blacqlist/launch/security-audit-report.md:136`), no HTML parser is installed, and `sharp` is only a devDependency. This ticket adds a safe fetcher, a reader and a photo import. No AI.

Copy says "bring in what you already have", never "scrape". The import is owner-started and covers only their own site.

## How it works

Step 0 of the ticket 126 flow. One box for a website or link-in-bio link, or "Skip, I'll type it". If the sign-in email is on a business domain (not gmail, icloud and so on), the box starts filled with that domain.

- "Bringing in your info..." shows a checklist: name, about text, phone, email, address, hours, socials, photos.
- Later screens arrive pre-filled with a small "From your site" tag. The owner confirms or edits.
- When the site and the owner disagree (say, two phone numbers), a small "Which is right?" card appears.
- **Photo picker:** a grid of found images, logo and cover suggested. The owner taps up to the plan limit ("1 of 1 photo on Free", the rest "More with Starter"). One line first: "I own these photos or have permission to use them."
- Socials on a Free page show as "Saved, appears on Starter".
- Owner note: "We read your public page once, when you ask. Nothing is copied that you don't pick."
- Each failure gets one plain line and a way forward: site blocked, not found, nothing useful, too slow.

**Safe fetcher, `lib/import/safe-fetch.ts` (new):**

- https and http only, ports 80 and 443.
- Resolve DNS and block private, loopback, link-local and metadata IPs. Re-check after every redirect, at most 3.
- 8 second timeout, 2 MB cap on HTML.
- No cookies. Identifying User-Agent like `lib/listings/geocode.ts:8`.
- Honors robots.txt. If blocked, tell the owner to type it in.
- New `RateLimitBucket` in `lib/security/rate-limit.ts`: about 5 imports per owner per hour, plus a per-IP cap.

**Reader, `lib/import/read-site.ts`** (pure function, unit-tested on saved HTML). Sources, in order of trust:

1. JSON-LD `LocalBusiness` or `Organization`: name, description, telephone, email, address, `openingHoursSpecification` (mapped to the `listing_details_business.hours` jsonb shape), logo, image, `sameAs`.
2. Open Graph and meta tags.
3. Page links: `tel:`, `mailto:`, known social hosts (mapped to the six `social_*` columns).
4. `<img>` tags at least 400px wide (attributes or srcset), capped at 24 candidates.
5. Link-in-bio pages (Linktree and similar) go through the same path. Their outbound links become the website and socials.

**Photo import, `lib/media/importRemoteImage.ts`:**

- The core of `app/api/upload/route.ts` (MIME, size and role limits, storage path, `media_attachments` row, cleanup on failure) moves into a shared function. The file route and the import both call it.
- Downloads go through the safe fetcher and `lib/security/file-signature.ts`. `checkPhotoAdd` enforces the plan limit server side.
- Re-encode with `sharp` to strip EXIF, including GPS. Today's file uploads keep EXIF, so they get the same fix.
- Only photos the owner picked are downloaded. Imported photos are copied into Supabase storage, never linked (`next/image` only allows Supabase hosts).

**Saving and the Free gate:**

- `createListing` gains hours and street address (it saves neither today).
- `checkSocialLinks` (`createListing.ts:322`) and the form (`SubmitListingForm.tsx:1000`) change from "reject on Free" to "save, but the page hides them below Starter". Confirm the listing page render already gates socials by plan, and add the gate if not.
- Pricing copy stays ("Social links on Starter").

**Admin view:** the review queue shows "Imported from <site>" so a reviewer can spot someone importing another business's site.

## Acceptance criteria

- Given `FEATURE_SITE_IMPORT` is off, then step 0 does not appear and nothing fetches a URL.
- Given a JSON-LD salon site, when the owner imports it, then name, about, phone, email, address, hours, socials and photo candidates are found and pre-filled with "From your site" tags.
- Given a thin site with only a title and a phone number, then those two fill and the rest is blank, with no error.
- Given a Linktree page, then its outbound links become the website and socials.
- Given a URL that points to localhost, `10.x`, `169.254.169.254` or IPv6 loopback, then the fetch is refused.
- Given a redirect to a private IP, or a DNS name that resolves to a private IP, then the fetch is refused.
- Given a page over 2 MB or a response slower than 8 seconds, then the owner sees the "too slow" or "nothing useful" line and can type instead.
- Given robots.txt blocks the fetch, then the owner is told to type it in.
- Given a sixth import in an hour, then the owner sees a plain wait message.
- Given the site and the owner's typing disagree, then one "Which is right?" card appears.
- Given a Free owner, then the photo counter reads "1 of 1 photo on Free", server side `checkPhotoAdd` refuses extras, and logo and cover do not count.
- Given an image with wrong magic bytes, then it is rejected. Given a JPEG with GPS EXIF, then the stored file has none.
- Given socials found on a Free page, then they are saved, hidden on the public page, and shown after upgrade to Starter.
- Given hours and street address, then they are saved by `createListing`.
- Given an imported listing in the review queue, then it shows "Imported from <site>".

## Gates

- **Dependency approval (ask before installing):** one small HTML parser (`node-html-parser` or `linkedom`), and moving `sharp` from devDependencies to dependencies.
- **Privacy and Legal** review the photo-rights line and any policy wording `[Needs professional review]`.
- Update the security audit's A10 line.
- No migration.

## QA notes

- SSRF tests: localhost, 10.x, 169.254.169.254, IPv6 loopback, redirect to a private IP, DNS name that resolves private, the size cap, the timeout. All must refuse.
- Reader tests on saved fixtures (Squarespace or Wix style JSON-LD, a bare HTML site, Linktree).
- Image import tests: wrong magic bytes, plan limit, EXIF removed.
- No live third-party sites in CI. Only fixtures and a local test server.
- The Preview reads STAGING, so say up front what it cannot show.
