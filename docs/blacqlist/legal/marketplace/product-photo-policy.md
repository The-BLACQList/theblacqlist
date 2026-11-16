# Product Photo Policy

> **Disclaimer:** This output is informational and does not constitute legal advice. Requirements vary by jurisdiction, business type, and product specifics. Consult a licensed attorney for guidance applicable to your situation before relying on any of the following.

**Status:** Draft. [Needs professional review]. Not live.
**Last updated:** 2026-11-13
**Audience:** sellers once approved, the founder as reviewer, and whoever builds the photo upload and report flows. Counsel for the review notes.
**Depends on:** `seller-agreement.md` (sections 10.3, 17, 21), `digital-products-policy.md` (AI imagery for digital products), Terms §4 and §6.

---

## The rule

Physical products may only be shown with real photos of the actual item, uploaded by you. No AI-generated or AI-altered product images.

"The actual item" means the product as the shopper will receive it: the same model, design, colour and materials. `[Assumption]` It does not have to be the exact unit that ships, but if units vary, such as handmade or vintage pieces, the photo must show the range honestly or the exact piece.

Each variant that looks different, such as a different colour, needs its own photo, or the listing must say plainly that the photo shows a different variant.

Digital products follow `digital-products-policy.md` instead.

## What is allowed and what is not

| Allowed | Not allowed |
|---|---|
| Your own photo of the product | AI-generated images of the product |
| Cropping and straightening | AI mockups, such as a design placed on a generated shirt or model |
| Lighting, exposure and colour correction that keeps true colour | Generated scenes or backgrounds around the product |
| Cleaning up or removing the background, as long as the product itself is not changed | AI changes to the product, such as removing flaws, changing shape, adding parts or changing colour |
| Removing dust or lint from the background | Stock photos or manufacturer images of a different item |
| Adding a plain border or your logo in a corner | Photos of a sample that is better than what ships |
| A photo of the product in use, taken by you | Someone else's photo used without permission |

If you are not sure, ask before you upload: does the shopper see what they will get? If not, don't use it.

## What you confirm for each photo

When you upload a product photo, you tick a box for that photo. Suggested text, following the Shop copy rules:

> "This is a real photo of this product. It is not AI-generated or AI-altered, and any edits are limited to crop, light, colour and background cleanup."

We record the confirmation, the time and the account that made it.

## How we check

1. **Metadata check at upload.** We read each file for signs it was made or changed by AI:
   - C2PA content credentials that show a generative AI action;
   - the IPTC DigitalSourceType field, for values such as `trainedAlgorithmicMedia` and `compositeWithTrainedAlgorithmicMedia`;
   - EXIF and XMP software tags that name a known image generator.

   A file that shows these signs is held for review, not posted. `[Assumption]` Some phone and editing tools add AI markers for allowed edits, such as background removal. A human decides those cases.

2. **Founder review.** The founder reviews each seller's first 3 products before they show in Shop.

3. **Spot checks.** After that, we spot-check products, more often for sellers with reports.

4. **Shopper reports.** Each product page has "Report this photo". A shopper can say why. We review each report.

**What the check does and does not do.** Metadata can be removed, and a clean file is not proof that a photo is real. The check is one signal. Your confirmation and our reviews are the others. We must never tell shoppers that photos are "verified" or "confirmed" real. `[Needs professional review]` Any shopper-facing wording about photos should say what we require, not what we guarantee. Suggested line: "Sellers show real photos of physical products."

## Enforcement ladder

| Step | What happens |
|---|---|
| Held at upload | The photo is held for review. Nothing else happens. If it breaks the rule, it is removed with a note telling you why. No strike for a held photo you did not publish |
| First upheld breach on a live product | The product is hidden until you replace the photo. One strike |
| Second upheld breach | The product is hidden. One strike. Your next 3 products go back to founder review |
| Third upheld breach within 6 months (founder, 2026-11-16) | Third strike. Selling is suspended (Seller Agreement 21.1) |
| Clear deception | Using images of a different item to sell something else, or a pattern of AI images, can lead to immediate suspension (Seller Agreement 21.2) and refunds to affected shoppers |

**Strikes.** A strike counts when we uphold a report or our own finding. Strikes from all Shop policies add up together. Strikes drop off 6 months after they were given (founder, 2026-11-16).

**Appeals.** Reply to the notice within 14 days `[Assumption]` with an original photo file or other proof. If we reverse a decision, the strike is removed.

**Refunds.** A shopper who received something that does not match the photos can open a "not as described" case under `returns-refunds-buyer-protection.md`.

## Rights in photos

You must own the photos or have permission to use them (Seller Agreement 17.1). Photos of people need their consent. You give us the licence in Seller Agreement 17.2 to show them.

## Review notes

| # | Point | Rating |
|---|---|---|
| PH1 | The rule is stricter than the law requires. The risk it reduces is FTC Act §5 deception and "not as described" disputes. Counsel to confirm the wording, and that no shopper-facing copy implies a guarantee | Medium |
| PH2 | Reading C2PA, IPTC and EXIF metadata is processing of data in seller files. Photo metadata can include GPS location. Strip location data before photos are published, and mention it in the privacy addendum | Medium |
| PH3 | Whether a physical product whose printed design is AI-generated art, such as a print or T-shirt, needs a disclosure like digital products. Not covered by the founder's decisions | Founder, counsel |
| PH4 | Assumed numbers: appeal window. Strike window and expiry decided 2026-11-16: 6 months | Founder decision (appeal window) |
