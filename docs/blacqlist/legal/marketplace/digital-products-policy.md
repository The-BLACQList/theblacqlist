# Digital Products Policy

> **Disclaimer:** This output is informational and does not constitute legal advice. Requirements vary by jurisdiction, business type, and product specifics. Consult a licensed attorney for guidance applicable to your situation before relying on any of the following.

**Status:** Draft. [Needs professional review]. Not live.
**Last updated:** 2026-11-13
**Audience:** shoppers and sellers once approved. Counsel for the refund consent and the AI disclosure rule. Whoever builds digital delivery and checkout.
**Depends on:** `seller-agreement.md` (sections 14, 17), `buyer-terms.md` (Part 1 §6), `returns-refunds-buyer-protection.md`, `product-photo-policy.md`, `ip-and-counterfeit-takedown.md`, `fees-and-payouts.md` (digital transfer timing).

---

## 1. What counts as a digital product

A file the shopper downloads: for example an e-book, planner, printable, template, pattern, music, photo, font, preset or course workbook. `[Assumption]` Streaming access, memberships, live classes and anything that recurs are not digital products in v1. Nothing in Shop recurs in v1.

## 2. Delivery

- The seller uploads the file. We keep it in private storage. It is never public.
- After payment, the shopper gets an order page with a Download button. Guest shoppers reach it from the link in their order email.
- Each Download tap makes a fresh link that lasts 15 minutes.
- Each purchase allows 5 downloads. A download counts when the file starts to be served. `[Assumption]`
- If a shopper runs out of downloads because of a fault, such as a broken file or a failed download, support can reset the count.
- Files may be up to `{size limit}` and must be in a common format named on the listing. `[Assumption]`

## 3. Licence

Unless the product page states a different licence, the shopper gets a personal, non-transferable, non-exclusive licence to download and use the file for their own non-commercial use. The shopper may not resell, share, upload or give away the file, or use it in products they sell.

A seller may offer a wider licence, such as commercial use or a set number of users. It must be written on the product page before purchase, and it binds the seller.

Suggested product page line, following the Shop copy rules: "Personal use licence. Not for resale or sharing."

The seller keeps ownership of the file. Buying it does not transfer any copyright.

## 4. Seller promises

The seller promises that:

- it owns the file or has the right to sell it under the stated licence;
- the file does not infringe anyone's rights, and does not contain malware;
- any third-party parts, such as fonts, stock images, music or code, are licensed for resale in this way;
- if any part was made with an AI tool, the tool's terms allow the seller to sell it;
- the file matches the listing: format, page count, size and contents.

## 5. Refunds

### The rule

Digital items cannot be refunded once downloaded, except when the file is defective or not as described.

- **Not yet downloaded:** the shopper can ask for a refund within 3 days of purchase. `[Assumption]` This matches the 3-day transfer timing, so no recovery from the seller is needed.
- **Defective:** the file will not open, is corrupt, or is missing content. The seller can fix it with a replacement file first.
- **Not as described:** the file is materially different from the listing. A case can be opened within 30 days of purchase.
- Cases follow `returns-refunds-buyer-protection.md`, including the seller's 3 business days to respond.

### Checkout consent

At checkout, when the cart holds any digital item, the shopper must tick this box before paying. The box is not pre-ticked. Exact wording:

> ☐ I understand that digital items in my order can't be refunded once I download them, unless a file is defective or not as described.

The Pay button stays disabled until it is ticked. We record the tick, the time and the order. `[Needs professional review]` Confirm the wording, whether a checkbox on our page before Stripe Checkout is enough, and whether Stripe Checkout's own custom text should repeat it. Check state consumer law on refund policy disclosure.

The checkbox avoids em dashes, parentheses, and the banned words "verified", "confirmed", "all", "every", "only" and "100%".

## 6. AI content disclosure rule

`[Needs professional review]` This rule is the drafter's proposal for the founder's decision that digital products may use AI imagery but must say so when the product itself is AI-generated. No general US law requires it today `[Assumption]`. The legal basis is avoiding deception under FTC Act §5 and state consumer protection law. Counsel to confirm and to check any state AI disclosure laws in force at launch.

### 6.1 Listing images

Listing images for digital products may use AI imagery, such as a generated desk scene around a planner mockup. But any image that shows what is inside the file, such as a page preview, must show the real content.

### 6.2 When the product must carry a disclosure

A seller must turn on "Made with AI" for a digital product when an AI tool created the main content the shopper is paying for. Examples:

- art, illustrations or photos generated by AI, sold as prints or downloads;
- an e-book, guide or workbook mostly written by AI;
- music or audio generated by AI;
- patterns, templates or designs whose main visual content was generated by AI.

No disclosure is needed when AI was used only as a helper: spelling and grammar checks, small edits, resizing, background cleanup, or ideas the seller then made by hand.

`[Assumption]` "Main content" means most of the creative content, judged by what the shopper is paying for. The seller decides in good faith, and we may require the label if reports show it is needed.

### 6.3 What the shopper sees

On the product page, next to the price, and on the order page. Suggested copy:

> **Made with AI.** The seller says this product was created with AI tools.

### 6.4 Enforcement

A missing disclosure that we uphold after a report is a strike under Seller Agreement section 21, and the shopper can open a "not as described" case.

### 6.5 Copyright note for sellers

Content made by AI without enough human creative input may not be protected by US copyright. That means others may be free to copy it, and the seller's licence may give the shopper less than it seems. `[Needs professional review]` Counsel to confirm the Copyright Office's current position and how the licence in section 3 should be worded for AI-made files, for example "to the extent the seller holds rights in it".

## 7. Other points

- **Tax.** Whether digital products are taxable varies by state. Stripe Tax applies the product tax code the seller picks. CPA to confirm.
- **INFORM Act.** The Act covers "consumer products", which likely means physical goods. `[Needs professional review]` Whether digital sales count toward the high-volume thresholds.
- **Prohibited content.** The prohibited list applies to digital files too, including adult content and 3D-printed gun files.

## 8. Review notes

| # | Point | Rating |
|---|---|---|
| D1 | Refund consent wording and placement | High. Consult attorney |
| D2 | AI disclosure rule: legal basis, threshold and wording | Medium. Consult attorney |
| D3 | Licence wording for AI-made content | Medium. Consult attorney |
| D4 | Digital goods taxability by state | CPA |
| D5 | Assumed: 3-day pre-download refund, when a download counts, file size limit | Founder decision |
