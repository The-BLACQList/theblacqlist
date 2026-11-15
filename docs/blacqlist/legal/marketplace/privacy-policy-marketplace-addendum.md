# Privacy Policy: Shop Addendum

> **Disclaimer:** This output is informational and does not constitute legal advice. Requirements vary by jurisdiction, business type, and product specifics. Consult a licensed attorney for guidance applicable to your situation before relying on any of the following.

**Status:** Draft. [Needs professional review]. Not live.
**Last updated:** 2026-11-13
**Audience:** counsel, the founder, and whoever edits `app/(public)/privacy/PrivacyPolicy.tsx` when Shop checkout is ready.
**Depends on:** the live Privacy Policy (`app/(public)/privacy/PrivacyPolicy.tsx`, sections 1 to 11), `seller-agreement.md` (section 20), `buyer-terms.md`, `inform-act-compliance.md`, `product-photo-policy.md`, `digital-products-policy.md`. Jurisdiction scope as pinned in `privacy-terms-compliance-review.md`: US-focused, CCPA/CPRA for California, GDPR not in scope.

---

## 1. What is new

Shop checkout adds personal data the policy does not cover today:

| Data | From whom | Why |
|---|---|---|
| Name, shipping address, email, phone if given, order contents | Shoppers, including guests. Stripe Checkout collects the email for guests | To fill orders, send receipts, run buyer protection, collect tax |
| Card details | Shoppers, entered into Stripe Checkout | Stripe processes payment. We never see or store full card numbers |
| Order history, refunds, buyer cases, messages and photos sent in a case | Shoppers and sellers | Buyer protection, disputes, fraud prevention |
| Download records: time, count | Shoppers | Enforcing the 5-download limit and refund rules |
| Seller identity, business details, tax ID, bank details | Sellers, entered into Stripe Connect | Stripe KYC and payouts. Stripe holds bank details. We see limited details, such as the last 4 digits |
| INFORM data: ID or business record, tax ID, contact details, yearly certifications | High-volume sellers | Required by 15 U.S.C. 45f |
| Public seller details: full name, address or state, contact | Sellers at $20,000 or more a year | Required by 15 U.S.C. 45f |
| Photo metadata: C2PA, IPTC, EXIF | Sellers' uploads | Checking for AI-made product photos |
| Reports | Shoppers and visitors | Reporting suspicious items |

## 2. Proposed new section

Proposed as a new subsection in Section 3, with the anchor `#shop`, after "Reading your receipt". Wording follows the Shop copy rules: no em dashes, no parentheses, no "verified".

> ### Buying and selling in Shop
>
> **When you buy.** When you check out in Shop, signed in or as a guest, we collect your name, shipping address, email, what you bought and what you paid. Stripe collects your card details. We never see or store your full card number. If you check out as a guest, Stripe collects your email so we can send your receipt and order updates.
>
> **What the seller gets.** For each order, we give the seller your name, shipping address, email and what you ordered from them. The seller may use it to ship your order, give you customer service, handle returns and buyer protection cases, and meet its tax and legal duties. Sellers may not use it to market to you unless you separately say yes to hearing from them. If a seller misuses your information, tell us at privacy@theblacqlist.com.
>
> **What we use it for.** We use your order information to take payment as the seller's payment collection agent, work out and pay sales tax, send order and shipping updates, deliver digital downloads, run buyer protection, prevent fraud, and keep records the law requires.
>
> **Digital downloads.** We record when you download a file and how many times, to apply the download limit and our refund rules.
>
> **When you sell.** Stripe collects your identity, business and bank details when you set up selling. Stripe holds your bank details. We see the details we need to run payouts, such as your business name and the last digits of your account. If you become a high-volume seller under the INFORM Consumers Act, we collect and check your contact details, tax ID and bank information, ask you to confirm them each year, and, if you sell $20,000 or more a year in Shop, show your name, address and contact details to shoppers as the law requires. We use INFORM information for that purpose and no other, unless the law requires.
>
> **Product photos.** When you upload a product photo, we read information stored in the file to check whether it was made or changed by AI. We remove location data from photos before they are shown.
>
> **How long we keep it.** We keep order, payment and tax records for 7 years after the order, because tax and accounting law requires it. If you delete your account, we keep those records but remove them from your account view, and we delete the rest of your personal information as described in Section 7.

`[Assumption]` 7 years for order and tax records. CPA to confirm the right period.

## 3. Changes to existing sections

| Live section | What it says now | Proposed change |
|---|---|---|
| §1 Who We Are | "a directory and discovery platform that centers Black-owned businesses..." | Add: "and Shop, a marketplace where you can buy from businesses listed with us." |
| §2 Information We Collect | Lists account, listing, receipts, reviews, communications. Nothing about orders, shipping or sellers | Add bullets for order and shipping details, seller onboarding data, INFORM data, case messages and photos, reports. Link to `#shop`. Separately, Finding 1 of the risk review, "stored in anonymized form", is still open and should be fixed in the same edit |
| §3 How We Use Your Information | No purchase uses. Ends: "We do not ... share your information with third parties for their own marketing purposes." | Add a bullet linking to `#shop`. **Conflict:** if sellers may market to shoppers who opt in, this sentence needs "unless you ask us to". In v1, with no opt-in, it stays true |
| §5 Information Sharing | Service providers, public listing content, legal compliance, business transfers | Add: "**Sellers you buy from:** we share your name, shipping address, email and order details with the seller of each item, so they can fill your order." Add: "**Public seller details:** for high-volume sellers, the details the INFORM Consumers Act requires." Add: "**Tax authorities:** as marketplace facilitator, we report and pay sales tax." `[Needs professional review]` Whether sharing with sellers is a "sale" or "sharing" under CCPA. The exception for disclosures the consumer directs may apply |
| §6 Third-Party Services | Stripe row: "Payment processing, used when paid features become available" | Out of date already, since paid plans are live under Terms §13. Change to "Payment processing for plans and Shop purchases, seller payouts through Stripe Connect, and sales tax calculation through Stripe Tax". Add a shipping or tracking provider row if one is used `[Assumption: none in v1]`. Check that Resend sends order emails |
| §7 Data Retention | "Your profile and personal information will be deleted within 30 days" of account deletion. "We may retain certain records longer when required by law..." | Add a bullet for order, payment and tax records, 7 years. Add INFORM records, per `inform-act-compliance.md`. Add download records and case records `[Assumption: 3 years]` |
| §8 Your Rights | Access, correction, deletion, portability | Add: deletion does not remove order records we must keep, or copies sellers keep for tax. Add: we will pass your request to the sellers you bought from. `[Needs professional review]` |
| §9 Security | Encryption, RLS, access controls | Add: "Card payments are handled by Stripe. We never see or store your full card number." |
| §10 Changes to This Policy | 14 days' email notice to registered users | Guest shoppers have no account. Show a link to the policy at checkout, so the version in force applies to each order |

## 4. Seller duties that back this up

Seller Agreement section 20: use shopper data only for fulfilment, service and legal duties; no marketing without the shopper's separate opt-in; keep it secure; delete when no longer needed, except tax records; report breaches within 72 hours `[Assumption]`; help with privacy requests within 10 days.

## 5. Review notes

| # | Point | Rating |
|---|---|---|
| PP1 | §6 Stripe row already out of date since paid plans went live | Medium. Fix now, independent of Shop |
| PP2 | CCPA role of sellers: separate business, third party or service provider. Decides whether sharing is a "sale" and what contract terms are needed | High. Consult attorney |
| PP3 | Seller marketing opt-in would contradict §3's last sentence. v1 has no opt-in | Medium. Founder |
| PP4 | Retention periods for orders, downloads, cases, INFORM data | Medium. CPA and counsel |
| PP5 | Photo GPS data must be stripped before publishing | Medium. Build |
| PP6 | Guest shopper notice of policy changes | Low. Consult attorney |
| PP7 | State privacy laws beyond California, such as Virginia, Colorado, Texas, apply by threshold. Shop adds purchase data, which raises the stakes | Medium. Consult attorney |
