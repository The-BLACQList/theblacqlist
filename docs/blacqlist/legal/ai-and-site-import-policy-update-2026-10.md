# Privacy Policy and Terms Update: AI Drafts and Site Import (Draft for Review)

> **Disclaimer:** This output is informational and does not constitute legal advice. Requirements vary by jurisdiction, business type, and product specifics. Consult a licensed attorney for guidance applicable to your situation before relying on any of the following.

_Drafted: 2026-10-15 · Updated: 2026-10-16 · Reviewers: Legal + Privacy agents · Status: **POSTED 2026-10-16 on founder approval; counsel review to follow.** The founder approved the text on their own word and merged it (ticket 139); any change counsel asks for goes in as a follow-up. The new text sits behind a "Takes effect" date, and the notice email goes only when the founder runs it, by the end of Mon Oct 19._

### Founder decisions (2026-10-16)

| Decision | Choice |
|---|---|
| Review | Build now, post and send only after counsel signs off |
| Dates | Posted and emailed **Mon Oct 19, 2026**, takes effect **Mon Nov 2, 2026** (14 days). If the email slips, both dates move day for day (`lib/legal/policyUpdate.ts`) |
| F7 (address and owner name) | **Remove them before sending.** Built in PR #239. The "What we never send" line became "What we never add" plus a line that the filter can miss things, because #239 keeps a first name that is part of the business name and does not catch addresses without a street word |
| F13 ("Black-owned only" wording) | Fixed, folded into the update |
| F14 (Vercel Analytics row) | Added, folded into the update |
| Safety-plan exception (§6) | Approved, added to `docs/blacqlist/ai/ai-safety-and-approval-plan.md` |
| Who gets the email | Registered accounts with a confirmed email only. Waitlist subscribers are not emailed |
| Ticket number | The page change is ticket **139** (138 was taken by Edit content) |
_Covers: ticket 127 (site import), ticket 128 (AI drafts on /add-business), and the existing dashboard AI suggestions (`lib/ai/*`)._
_Folder: this file lives in `docs/blacqlist/legal/`, next to the earlier reviews (`privacy-terms-compliance-review.md`, `attorney-redline-2026-07-01.md`). Jurisdiction scope is the one pinned on 2026-06-20 in `privacy-terms-compliance-review.md`: US-focused (Georgia, Texas, Illinois markets), CCPA/CPRA for California visitors, GDPR not an MVP blocker._

Every piece of proposed legal text in this document is marked **[Needs professional review]**. Proposed user-facing copy avoids em dashes (founder voice rule) and says "bring in", never "scrape" (`docs/blacqlist/brand/brand-positioning.md:112`).

---

## 1. Disclaimer

> **Disclaimer:** This output is informational and does not constitute legal advice. Requirements vary by jurisdiction, business type, and product specifics. Consult a licensed attorney for guidance applicable to your situation before relying on any of the following.

---

## 2. Summary of findings

| # | Finding | Risk | Owner of fix | Blocks |
|---|---|---|---|---|
| F1 | Anthropic is not named anywhere in the Privacy Policy. Section 5 promises Section 6 is "the full list" of service providers. Sending owner text to Anthropic without disclosure makes that promise false. | **High** | Frontend (page edit), Docs | Any real Anthropic call (dashboard AI and ticket 128) |
| F2 | Cloudflare Turnstile is live (since 2026-10-01) on sign-up, sign-in, forgot password, claims, reviews, corrections and the launch waitlist, but is named in neither the Privacy Policy nor the Cookie Policy. Confirmed by grep: zero matches for `turnstile` or `cloudflare` under `app/(public)/`. | **Medium** | Frontend, Docs | Nothing new; it is an existing gap |
| F3 | Site import is a new way we collect information (from a web page the owner gives us). Privacy §2, §3 and §7 do not describe it. | **Medium** | Frontend, Docs | `FEATURE_SITE_IMPORT` in production |
| F4 | Terms do not say owners are responsible for AI drafts they use, or for content brought in from a site. Terms do not warn that AI drafts can be wrong. | **Medium** | Frontend, Docs | `FEATURE_AI_ONBOARDING` in production |
| F5 | No photo-rights confirmation exists for imported photos. Copyright exposure is reduced by our registered DMCA agent (Terms §8), but a clear owner confirmation supports good faith and the repeat-infringer process. | **Medium** | Frontend (import UI) | `FEATURE_SITE_IMPORT` |
| F6 | Today's file uploads keep EXIF data, including GPS (ticket 127, "Today's file uploads keep EXIF"). Any policy line that says "we remove location data" is only true once the `sharp` re-encode ships for both the upload route and the import. | **Medium** | Backend | Publishing any "location removed" line |
| F7 | The brief says street address and owner name are never sent to the model, but `sanitizeForPrompt` (`lib/ai/sanitize.ts:47`, `:51`) only removes email and phone patterns. Free text an owner types or imports ("Hi, I'm Keisha, visit us at 123 Peachtree St") would be sent as written. | **Medium** | Backend | Wording of the "never sent" line in F1 |
| F8 | "Nothing is copied that you don't pick" is only true if: imported text is held until the owner saves, the AI only reads imported text the owner kept, and unused drafts are not stored. Ticket 128 says unused onboarding drafts are not stored; ticket 127 does not say where pre-filled text lives before save. | **Medium** | Backend, Frontend, QA | Publishing the owner note |
| F9 | `ai-safety-and-approval-plan.md` has no allowance for text that is not yet a listing field (pre-draft owner text), imported third-party page text, or category proposals. Ticket 128 lists this exception as a gate. | **Medium** | Docs (founder approves) | Ticket 128 |
| F10 | Both Privacy §10 and Terms §13 promise registered users **email notice at least 14 days before material changes take effect**. Turning the features on before the effective date, or skipping the email, breaks our own written promise. | **High** | Release, Docs | Turning on any feature that depends on the new text |
| F11 | Anthropic's current data retention and training terms for API customers are not verified in this repo. The policy must not state a retention number until someone checks the terms that apply to our account. | **Medium** | Founder + counsel | Final F1 wording |
| F12 | Link-in-bio platforms (Linktree and similar) have their own terms about automated access. A single owner-started fetch that honors robots.txt is low risk, but the platform terms are unverified. | **Low** | Founder + counsel | Nothing (verify before launch) |
| F13 | Privacy §1 (`privacy/page.tsx:44-45`) and Terms §2 (`terms/page.tsx:65`) still say "Black-owned businesses" only, out of step with the Black-Owned / Ally labels in Terms §4. Out of scope here, but a 14-day notice cycle is a cheap time to fix it. | **Low** | Counsel, Frontend | Nothing |
| F14 | Vercel Analytics and Speed Insights are described in the Cookie Policy but not in the Privacy §6 table (Vercel row says only "Hosting and CDN"). | **Low** | Frontend | Nothing |

**Not applicable on current facts (Low, verify):** Colorado AI Act (SB 24-205, effective date delayed to 2026-06-30 by a 2025 special-session bill) covers "high-risk" systems making consequential decisions; drafting a tagline is not one. California SB 942 (AI Transparency Act, 2024) applies to providers with over 1,000,000 monthly users. Utah's AI disclosure law (SB 149, 2024, narrowed by SB 226, 2025) is about generative AI talking with consumers in regulated contexts. _Note: verify each against its current version; these laws have been amended or delayed repeatedly and this information may be outdated._

**Related federal rule (Low, already handled by design):** the FTC rule banning fake reviews and testimonials, including AI-generated ones (16 CFR Part 465, announced 2024-08-14, effective 2024-10-21). The safety plan already forbids fabricated testimonials (`ai-safety-and-approval-plan.md:188`); the proposed Terms line in §4.2 below makes it an owner obligation too. _Verify the current rule text._

---

## 3. Privacy Policy: proposed changes

All quotes are from `app/(public)/privacy/page.tsx` on `main` at `7a261ed`. The page is a single TSX file with no imported content files. Proposed text is written as plain prose for the Frontend agent to port into the existing JSX patterns (`<h3 className="font-subhead ...">`, `<ul className="list-disc ...">`).

### 3.1 Header: add an effective date (F10)

**Current** (`privacy/page.tsx:18`):

> `<PageHeader title="Privacy Policy" subtitle="Last updated: June 30, 2026" />`

**Proposed** [Needs professional review]:

> Last updated: [posting date, for example October 19, 2026] · Takes effect: [effective date, for example November 2, 2026]

Until the effective date, keep the current policy live and show a short banner at the top: "We're updating this policy on [effective date]. See what's changing." linking to the new version. (Same for Terms.)

### 3.2 Section 2, Information We Collect: add a new source (F3)

**Current** (`privacy/page.tsx:61-68`):

> **Information you provide directly**
> - Account registration information (name, email address, password)
> - Business listing information (business name, description, address, photos, hours, contact details) when you create or claim a listing
> - Receipt and spend data when you submit receipts through the community spend feature
> - Reviews and community content you submit
> - Communications you send to us through email or support channels

**Proposed addition**, a new sub-heading after that list [Needs professional review]:

> **Information from a website you give us**
>
> If you own a business and give us a link to your business website or link-in-bio page, we read that public page when you ask. We look for things you've already published there, like your business name, description, phone number, email, address, hours, social links, and photos. See "Bringing in your website" in Section 3.

### 3.3 Section 3, How We Use Your Information: add two uses (F1, F3)

**Current** (`privacy/page.tsx:83-93`), first two bullets:

> - Create and maintain your account and business listings
> - Process and verify business claim submissions

**Proposed addition**, two bullets after "Create and maintain your account and business listings" [Needs professional review]:

> - Fill in your business page draft from a public web page you point us to, when you ask
> - Offer optional AI writing help to business owners (see "AI writing help" below)

**Current** (`privacy/page.tsx:94-97`):

> We do not use your information for behavioral advertising, sell your data to data brokers, or share your information with third parties for their own marketing purposes.

Keep as is. Then add two new sub-sections at the end of Section 3 (give them `id="bringing-in-your-website"` and `id="ai-writing-help"` so the existing section numbers and the Contents list do not change).

**Proposed new sub-section A** [Needs professional review]:

> **Bringing in your website (business owners only)**
>
> When you add a business, you can give us a link to your business website or link-in-bio page instead of typing everything.
>
> We read the public page you give us once, when you ask. Nothing is copied that you don't pick.
>
> - We read the page the way a visitor's browser would. We follow the site's robots.txt rules, we don't log in, and we don't use cookies.
> - What we find shows up in your draft so you can check it, change it, or remove it. Only what you save becomes part of your page.
> - Photos are copied to our storage only if you pick them. Before we save a photo, we remove its location data (like GPS) and other hidden details stored in the file.
> - We note which website a page was set up from, so our team can spot a page set up from someone else's site.
> - We don't keep a copy of the web page itself.

_Accuracy conditions for sub-section A (do not publish until each is true):_ the photo line depends on F6 (EXIF strip shipped); "Nothing is copied that you don't pick" depends on F8; "once, when you ask" is true per request (the fetcher also reads `robots.txt` and then only the photos the owner picks, and an owner may retry up to about 5 times an hour). If counsel thinks "once" overstates it, use: "We read the public page you give us only when you ask. We don't keep checking it."

**Proposed new sub-section B** [Needs professional review]:

> **AI writing help (business owners only)**
>
> If you use our writing help when you set up or manage a business page, we send some of your business information to Anthropic, the company that makes the Claude AI model, so it can suggest drafts. Drafts can include a tagline, an About section, a search title and description, and a category for your business.
>
> **What we send:** your business name, your city, category names, and the words you type or bring in from your website to describe your business. We cut that text to 500 characters and remove anything that looks like an email address or phone number first. For a page that's already live, the writing help can also use your current tagline and About text, and simple totals like how many people viewed your page in the last 30 days. It never gets anything about who those people are.
>
> **What we never add:** we don't attach your account name, your email address, your phone number, your street address, your password or login details, or your receipts to what we send. [Reworded 2026-10-16 to match PR #239, see note on F7 below.]
>
> **You decide what's used.** Nothing an AI writes goes on your page until you choose to use it. You can edit a draft, ask for another, or skip it. AI drafts can be wrong, so read them before you use them.
>
> **What Anthropic does with it:** Anthropic handles this information for us as a service provider, under a contract that limits what it can do with it. [VERIFY BEFORE PUBLISHING: state Anthropic's current commercial terms for our account, for example whether API inputs and outputs are used for model training and how long they are kept. Do not insert a number from memory. See F11.] You can read Anthropic's privacy policy at anthropic.com/legal/privacy.
>
> **What we keep:** a record that a draft was requested (which tool, when, and how much text, by count only). We don't keep the text we send. Drafts you don't use during page setup aren't saved. Suggestions on your owner dashboard are saved to your account so you can review them, stop working after 7 days, and are deleted if the listing is deleted.
>
> **It's optional.** You can set up and run your page without it.

_Note on F7 (resolved 2026-10-16: redaction built in PR #239, wording above adjusted to its limits):_ the "never send" line is only fully true if address and owner-name redaction is added for free text (see F7 handoff). If that is not built before launch, replace the last sentence of "What we send" and the "What we never send" paragraph with: "We remove email addresses and phone numbers from that text. We don't add your account name, contact details, or street address to what we send. If the words you write or bring in mention a street address or a person's name, they're sent as written, so leave out anything you don't want shared." [Needs professional review]

### 3.4 Section 6, Third-Party Services: add two rows (F1, F2) and widen one (F14)

**Current** (`privacy/page.tsx:157-160`):

> We use the following third-party services to operate the platform. Each processes data according to their own privacy policies, which we link below.

**Current table rows** (`privacy/page.tsx:172-246`): Supabase (Database and authentication), Vercel (Hosting and CDN), Resend (Transactional email delivery), Sentry (Error monitoring), Stripe (Payment processing, used when paid features become available).

**Proposed new rows** [Needs professional review]:

| Service | Purpose | Privacy Policy |
|---|---|---|
| Anthropic | Optional AI writing help for business owners (drafts you choose whether to use) | anthropic.com/legal/privacy |
| Cloudflare Turnstile | Checks that a person, not a bot, is using our sign-up, sign-in, password reset, claim, review, correction, and waitlist forms | cloudflare.com/privacypolicy (and the Turnstile privacy addendum, cloudflare.com/turnstile-privacy-policy) |

_Verify both URLs resolve before publishing._

**Proposed change to the Vercel row** (F14, optional) [Needs professional review]:

> Vercel | Hosting, CDN, and privacy-friendly page analytics (Vercel Analytics and Speed Insights)

**Proposed paragraph after the table** (F2) [Needs professional review]:

> On some forms, Cloudflare Turnstile checks that you're a person and not a bot. To do this, Cloudflare's script runs in your browser and Cloudflare receives technical information like your IP address and details about your browser and device. We only get back a pass or fail answer.

_Code check behind this paragraph:_ the widget loads `https://challenges.cloudflare.com/turnstile/v0/api.js` in the browser (`components/security/TurnstileWidget.tsx:125`). Our server calls `siteverify` without passing the visitor IP (no caller passes `remoteIp`; `lib/actions/{subscribers,claims,corrections,reviews}/*`). Auth forms are verified by Supabase Auth through the project CAPTCHA setting (`docs/blacqlist/architecture/security-and-privacy-plan.md:582-586`).

### 3.5 Section 7, Data Retention: add two bullets (F3, F1)

**Current** (`privacy/page.tsx:255-263`) ends with:

> - We may retain certain records longer when required by law, for fraud prevention, or for legitimate business purposes such as resolving disputes

**Proposed addition**, two bullets before that last one [Needs professional review]:

> - When you bring in your website, we don't keep a copy of the page. We keep only what you save to your page, plus a note of which website it came from.
> - For AI writing help, we keep a record that a draft was requested, without the text. If you delete your account, your name is removed from those records.

_Basis for the second bullet:_ `ai-safety-and-approval-plan.md:213-217` (on user deletion, `created_by` in `ai_generation_requests` is set to NULL; prompt text is never stored).

### 3.6 Cookie Policy: add Turnstile (F2)

Not requested in the brief, but the Turnstile gap exists on both pages. `app/(public)/cookies/page.tsx` lists Supabase auth cookies, Vercel Analytics and Sentry under "Cookies We Use" and does not mention Turnstile.

**Proposed addition** under "Cookies We Use", after the Sentry block [Needs professional review]:

> **Bot protection (Cloudflare Turnstile)**
>
> On some forms, Cloudflare Turnstile runs a quick check in your browser to tell people from bots. [VERIFY: whether Turnstile sets any cookie or local storage item on our domains, and name it here if it does.] Cloudflare uses what it collects only to run this check, as described in its Turnstile privacy addendum.

---

## 4. Terms of Service: proposed changes

All quotes are from `app/(public)/terms/page.tsx` on `main` at `7a261ed`. Section 4 already carries a JSX comment that it needs counsel review (`terms/page.tsx:103-107`); these additions fall under that same review.

### 4.1 Section 4, owner promises: cover imported content and photos (F4, F5)

**Current** (`terms/page.tsx:122-134`):

> Business owners who create or claim listings represent and warrant that:
> - They have authority to represent the business (as an owner, partner, or authorized agent)
> - All information submitted is accurate, complete, and not misleading
> - The ownership label they select is accurate: ...
> - Any images, logos, or content submitted do not violate third-party intellectual property rights
> - The business is operating lawfully and in compliance with applicable laws

**Proposed replacement for the images bullet, plus one new bullet** [Needs professional review]:

> - Any images, logos, or content submitted, including photos picked from a website and AI drafts they choose to use, are theirs or used with permission, and do not violate anyone's intellectual property, privacy, or publicity rights
> - Any website or link-in-bio page they ask us to read belongs to their business, or they are authorized to use it for the business

### 4.2 Section 4, new paragraphs: help setting up your page (F4)

Add after the warranty list, before "We reserve the right to remove, modify, or decline any listing..." (`terms/page.tsx:135`).

**Proposed** [Needs professional review]:

> **Bringing in your website.** You can ask us to read a public web page to fill in your draft. Only give us a link to your own business's site, or a page you're authorized to use for it. When you ask, you're directing us to make that one request for you. We may decline any page, and we may review or remove any listing set up this way.
>
> **AI writing help.** We may offer AI drafts for your page. AI drafts are suggestions. They can be wrong, out of date, or a poor fit, and our team doesn't check them before you see them. Read every draft before you use it.
>
> When you use a draft, with or without edits, it becomes your listing content. You're responsible for it, and the promises above about accuracy apply to it the same as anything you write yourself.
>
> Don't use AI help to write anything false or misleading, such as made-up reviews, testimonials, awards, licenses, prices, or health or legal claims.
>
> We don't promise that AI drafts or search titles will improve how your page ranks in search engines or on The BLACQList. AI help may have limits, may change, and may be paused or turned off at any time.

### 4.3 Section 8, Intellectual Property: name imported photos and used drafts (F4, F5)

**Current** (`terms/page.tsx:213-217`):

> Business listing content uploaded by business owners (business name, description, photos, logos) remains the property of those business owners, subject to the license granted in Section 5.

**Proposed replacement** [Needs professional review]:

> Business listing content uploaded or brought in by business owners (business name, description, photos, logos, and photos picked from the owner's website) remains the property of those business owners, subject to the license granted in Section 5. As between you and us, AI drafts you choose to use on your page are treated as your listing content.

_Counsel note:_ whether AI-generated text is copyrightable at all is unsettled. The US Copyright Office's _Copyright and Artificial Intelligence, Part 2: Copyrightability_ (January 2025) says purely AI-generated material is not protected, while human selection and editing can be. The "as between you and us" wording avoids promising ownership that may not exist. _Verify against current guidance._

### 4.4 Section 9, Disclaimers: add AI and import results (F4)

**Current** (`terms/page.tsx:253-258`):

> We do not warrant that:
> - Listing information is accurate, complete, or current
> - The Platform will be uninterrupted, error-free, or secure
> - Any goods or services offered by listed businesses meet any particular standard of quality

**Proposed addition**, one bullet [Needs professional review]:

> - AI drafts, or information brought in from a website, are accurate, complete, or right for your page

### 4.5 No change needed

- Section 5 already licenses "photos" as User Content (`terms/page.tsx:151-156`); imported photos the owner picks fall inside it.
- Section 7 "Scrape, crawl, or systematically extract data without our prior written permission" (`terms/page.tsx:192`) governs what users do to our platform and does not conflict with an owner-started read of the owner's own site. Keep the "bring in" wording so there's no apparent double standard.

---

## 5. Photo-rights line for the import UI

**Proposed checkbox line** [Needs professional review]:

> ☐ I own these photos or have permission to use them on The BLACQList.

**Proposed helper text under it** (small, one line) [Needs professional review]:

> Only pick photos you took, paid for, or were given permission to use. A photographer's photos may need their OK.

**Alternative for counsel to consider** (adds people shown in photos, which covers publicity rights) [Needs professional review]:

> ☐ I own these photos or have permission to use them here, including from anyone shown in them.

**UX rules for the line:**

- Unchecked by default. The "Bring in photos" button stays disabled until it is checked. Never pre-checked.
- Link "permission" or a small "Why we ask" to Terms §4.
- Show it once per import, above the photo grid, not per photo.
- Open question: whether to record the confirmation (who, when, which listing). Ticket 127 says "No migration", so recording it would need either an existing metadata column or its own GATE-DATA. See open question Q5.

---

## 6. Safety-plan exception text (drop-in for `ai-safety-and-approval-plan.md`)

Proposed new section, to be inserted after "Privacy Guardrails → Prompt Assembly Rules" in `docs/blacqlist/ai/ai-safety-and-approval-plan.md`. **Applied 2026-10-16** (founder approved), with guardrail 1 updated for PR #239. [Needs professional review]

```markdown
### Exception: owner onboarding drafts (tickets 127 and 128)

**Added:** [date approved] · **Approved by:** [founder] · **Applies to:** the /add-business AI drafts (ticket 128), behind `FEATURE_AI_ONBOARDING`.

The allowlist above names listing columns. During /add-business there may be no listing row yet, and the owner's words come from the form or from an imported page, not from `listing_details_business.description`. This exception allows three more inputs, only for the onboarding draft agent, only with the guardrails below.

**Additionally allowed in prompts (onboarding draft agent only):**

| Input | Source | Rule |
|---|---|---|
| (a) Owner-typed onboarding text | What the signed-in owner types to describe the business | Through `sanitizeForPrompt`, capped at 500 characters |
| (b) Imported public "about" text | JSON-LD `description` or meta description from the page the owner asked us to read (ticket 127) | Only text the owner kept in the draft (not text they deleted). Through `sanitizeForPrompt`. Counts toward the same 500-character cap as (a), combined |
| (c) Category names | Candidate category names from the rules matcher, and category names the model proposes | Names only. No ids from other tables beyond the candidate category ids |
| Business name, city name | The draft form | Same as `listings.name` and `cities.name` above |

**Still never allowed** (unchanged, and now also applied to (a) and (b)): owner name or `profiles.display_name`, email, phone, street address and zip, `social_*` handles, user ids, claim documents, receipts, review text, session tokens. Contact fields found by the import are pre-filled into the form only and never passed to the prompt builder.

**Guardrails:**

1. **Sanitize both kinds of free text.** (a) and (b) go through `sanitizeForPrompt` (strip HTML, redact email and phone, truncate). [Open: add street-address and owner-name redaction, see policy update F7.]
2. **Treat imported text as data, not instructions.** It comes from a third-party page the owner does not fully control. Place it inside a clearly delimited block in the template, and tell the model to ignore instructions found inside it.
3. **Constrain the output.** zod plus `validateOutput`: category must be an id from the candidate list or a proposed new name with a parent group; tagline ≤ 120 chars; about 100 to 300 chars; search title ≤ 60; search description 40 to 160. Anything else is rejected and the rules-matching fallback shows. Output containing an email or phone pattern is refused, not cleaned.
4. **Owner approval, inline.** Nothing saves until the owner taps "Use this". This replaces the two-step Approve then Apply flow for onboarding only, because the owner is editing their own unsaved draft. No `ai_suggestions` row is written; unused drafts are not stored.
5. **Audit row first.** An `ai_generation_requests` row is written before every call (`listing_id` may be null before a draft exists). Prompt and response text are never logged; `closeFailed('provider_error')` stores a fixed code.
6. **Ownership.** The caller must be the signed-in owner of the draft, or the signed-in user before a draft exists. No anonymous calls.
7. **Caps that fail closed.** About 5 drafts per page, about 20 per owner per day, a monthly spend ceiling, and a kill switch. Do not reuse the general limiter, which fails open.
8. **Placeholder test.** A unit test asserts every placeholder in the onboarding template gets a value (privacy audit finding A).
9. **Gates still apply.** This exception does not override Core Principle 3. No real provider call until GATE-SPEND and the six V2-Provider gates clear, and not before the updated Privacy Policy and Terms take effect.
10. **Policy match.** The public Privacy Policy "AI writing help" section must describe these inputs. If an input is added here, the policy is updated first.
```

---

## 7. Notice timeline

### 7.1 The clause (both documents)

**Privacy Policy §10, Changes to This Policy** (`app/(public)/privacy/page.tsx:325-334`):

> "We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or for other operational reasons. We will notify registered users of material changes by email at least 14 days before they take effect. The "Last updated" date at the top of this page reflects when the most recent revision was made."
> "Your continued use of the platform after changes take effect constitutes acceptance of the updated Privacy Policy."

**Terms of Service §13, Changes to Terms** (`app/(public)/terms/page.tsx:327-334`):

> "We may update these Terms at any time. We will notify registered users of material changes by email at least 14 days before they take effect. The "Last updated" date at the top of this page reflects the most recent revision."
> "Continued use of the Platform after changes take effect constitutes your acceptance of the updated Terms. If you do not agree to the updated Terms, you must stop using the Platform."

**Required channel:** **email** to **registered users**, sent at least 14 days before the effective date. The page's "Last updated" date also changes. Waitlist subscribers (`launch_subscribers`) are not registered users, so the clause does not require emailing them; counsel may still advise it.

### 7.2 Date math

| Step | Example date |
|---|---|
| New text posted (marked "Takes effect [date]") | **Friday 2026-10-16** (done) |
| Notice email sent to all registered users | **by the end of Monday 2026-10-19** |
| 14 days later, the earliest effective date | **Monday 2026-11-02** |
| Recommended effective date (one buffer day for late sends and time zones) | **Tuesday 2026-11-03** |

If the email goes out on Oct 20 instead, the earliest effective date moves to Nov 3. The clock starts when the email is sent, not when the page is posted.

### 7.3 What this means for launch

- Keep `FEATURE_SITE_IMPORT`, `FEATURE_AI_ONBOARDING`, and the real Anthropic provider for dashboard AI **off in production until the effective date**, unless counsel says an in-flow disclosure plus the owner's opt-in is enough before then (Q1).
- Treat the update as **material**. Adding a new processor that receives owner text and a new collection source is the kind of change the clause is written for.
- The Turnstile disclosure describes something already running. Counsel may allow it to be posted right away as a correction instead of waiting out the 14 days (Q1).
- Send the email through Resend as a service notice, not a marketing email. Plain subject, for example "We're updating our Privacy Policy and Terms on November 3". _Verify with counsel that it qualifies as a transactional or relationship message under CAN-SPAM._

---

## 8. Open questions

### For the founder

| # | Question |
|---|---|
| Q1 | Do the AI and import features wait for the effective date (recommended), or should counsel be asked whether in-flow disclosure plus opt-in lets them start sooner? And may the Turnstile line go live now as a correction? |
| Q2 | Which Anthropic account and terms will we use (direct API under Anthropic's Commercial Terms, or through a cloud marketplace)? The policy wording depends on it. Will we ask for zero data retention? |
| Q3 | F7: build street-address and owner-name redaction for free text before launch, or publish the "sent as written, so leave those out" wording? |
| Q4 | Fold the "Black-owned businesses" wording fix (F13) and the Vercel Analytics row (F14) into this same notice cycle? |
| Q5 | Record the photo-rights confirmation (who, when, which listing)? If yes, where, given ticket 127 says no migration? |
| Q6 | Who gets the notice email: all registered users only, or also waitlist subscribers? |

### For professional review

| # | Question |
|---|---|
| R1 | Is this update material under our own clause, and is 14 days' email notice enough? Can new sign-ups accept the new text at sign-up before the effective date while existing users stay on the old text? |
| R2 | Anthropic's current commercial data terms: retention period, use for training, data processing addendum, and whether it meets the CCPA service-provider contract requirements (Cal. Civ. Code §1798.100(d) and CCPA regulations §7051, as amended through 2023 by CPRA). Verify current versions. |
| R3 | Every block of proposed text in §3 to §6 of this document. |
| R4 | The photo-rights line: which version, and whether to include people shown in the photos. |
| R5 | AI draft ownership wording in Terms §8 given unsettled copyrightability of AI output (USCO Part 2 report, January 2025). |
| R6 | Link-in-bio platform terms (Linktree and similar) for a single owner-started read that honors robots.txt. |
| R7 | Whether "We read the public page you give us once, when you ask" is accurate enough, given robots.txt and picked photos are separate requests and owners can retry. |
| R8 | Whether the Turnstile disclosure needs anything beyond the proposed paragraph (for example, a link to Cloudflare's Turnstile addendum in the Cookie Policy). |

---

## 9. Implementation handoffs

Per `.claude/rules/compliance.md`, every finding that needs code names its agent. Ticket numbers 127 and 128 exist; 138 is proposed here and **not created**.

**F1, F2, F3, F14 (policy page text)**
→ **Frontend**: after counsel signs off, port §3 of this doc into `app/(public)/privacy/page.tsx` and the Turnstile block into `app/(public)/cookies/page.tsx`; add the "Takes effect" header line and the upcoming-changes banner.
→ Ticket: `docs/blacqlist/tickets/138-policy-pages-ai-import-update.md` (proposed)

**F4 (Terms text)**
→ **Frontend**: port §4 of this doc into `app/(public)/terms/page.tsx`, same ticket and same effective date.
→ Ticket: `docs/blacqlist/tickets/138-policy-pages-ai-import-update.md` (proposed)

**F5 (photo-rights line)**
→ **Frontend**: required, unchecked checkbox above the import photo grid; "Bring in photos" disabled until checked; link to Terms §4.
→ Ticket: `docs/blacqlist/tickets/127-add-business-site-import.md`

**F6 (EXIF and GPS)**
→ **Backend**: ship the `sharp` re-encode for both `app/api/upload/route.ts` and `lib/media/importRemoteImage.ts` before any policy line says location data is removed.
→ Ticket: `docs/blacqlist/tickets/127-add-business-site-import.md`

**F7 (address and name in free text)**
→ **Backend**: add street-address redaction to `sanitizeForPrompt`, and redact the signed-in owner's own `display_name` from (a) and (b) before prompt assembly; or confirm the founder chose the "sent as written" wording.
→ Ticket: `docs/blacqlist/tickets/128-add-business-ai-drafts.md`

**F8 ("Nothing is copied that you don't pick")**
→ **Backend**: keep import results out of the database until the owner saves; pass only kept about text to the prompt builder; store no unused onboarding drafts; never download unpicked photos.
→ **QA**: test that an import followed by abandoning the flow leaves no stored text, no media rows, and no files in storage.
→ Ticket: `docs/blacqlist/tickets/127-add-business-site-import.md` and `128-add-business-ai-drafts.md`

**F9 (safety-plan exception)**
→ **Docs**: after founder approval, insert §6 of this doc into `docs/blacqlist/ai/ai-safety-and-approval-plan.md`.
→ Ticket: `docs/blacqlist/tickets/128-add-business-ai-drafts.md`

**F10 (notice)**
→ **Release**: add "updated Privacy Policy and Terms in effect" as a go-live gate for `FEATURE_SITE_IMPORT`, `FEATURE_AI_ONBOARDING`, and the real Anthropic provider; schedule the Resend notice email and the effective date.
→ Ticket: `docs/blacqlist/tickets/138-policy-pages-ai-import-update.md` (proposed)

F11, F12 and F13 need no code beyond the page edits above; they are verification and counsel items.
