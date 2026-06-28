# F8 — How to obtain your mailing address + DMCA agent

> **Disclaimer:** This output is informational and does not constitute legal advice. Requirements vary by jurisdiction, business type, and product specifics. Consult a licensed attorney for guidance applicable to your situation before relying on any of the following.

**Status of the three legal details:**

| Detail | Value | Where it goes | Status |
|---|---|---|---|
| Legal entity name | **The BLACQList, LLC** | Privacy §11 + Terms §14 | ✅ Wired in (commit `e192df2`) |
| Mailing address | a P.O. box | Privacy §11 + Terms §14 | ⏳ You obtain |
| DMCA designated agent | (likely the LLC itself) | Terms §8 | ⏳ You register |

**Key insight:** the P.O. box unblocks *both* remaining items — it becomes your public mailing address **and** your DMCA agent's address. Get the P.O. box first; everything else follows.

---

## 1. Mailing address (a P.O. box)

You need a public postal address for the legal pages. You do **not** want to use your home address (it becomes public in the Terms/Privacy pages and the DMCA directory). Two clean options:

**Option A — USPS P.O. Box** (simplest, cheapest)
- Apply at **usps.com → "PO Boxes"** (or in person at a post office). ~$20–$80 per 6 months depending on box size and location.
- You get an address like `PO Box 1234, Atlanta, GA 30303`.
- Caveat: a literal "PO Box" address is fine for Terms/Privacy and the DMCA directory, but some banks/registrations prefer a street address (see Option B).

**Option B — Virtual mailbox / commercial mail-receiving agency** (street-address format)
- Services like a virtual business address give you a real street address (e.g., `123 Main St, Ste 100, Atlanta, GA 30303`) and scan/forward your mail.
- Costs more (~$10–$30/mo) but reads as a business street address and works everywhere a PO Box might not.

**Recommendation:** a USPS P.O. Box is enough for the legal pages and the DMCA filing. Upgrade to a virtual street address only if you also want it for banking/LLC registration.

→ Once you have it, send me the exact address and I'll drop it into Privacy §11 + Terms §14.

---

## 2. DMCA designated agent

Because The BLACQList hosts user-submitted content (listings, reviews, photos), registering a **DMCA designated agent** with the U.S. Copyright Office is what preserves your "safe harbor" protection from liability for that user content. It's a short online filing — not a lawyer-required step for most small companies.

**The simplest path: register the LLC as its own agent (you are the contact).**

1. Go to the **U.S. Copyright Office DMCA Designated Agent Directory** (dmca.copyright.gov).
2. Create an account for **The BLACQList, LLC**.
3. Designate an agent — this can be **the LLC itself**, with you as the contact person. Provide:
   - Service provider name: **The BLACQList, LLC**
   - Agent name: e.g., "DMCA Agent, The BLACQList, LLC" (or your name)
   - Physical mail address: **your new P.O. box**
   - Email + phone: your existing `notice@theblacqlist.com` works for email
4. Pay the filing fee (~$6). **Renew every 3 years** (the directory will remind you).

**Alternative:** a third-party DMCA-agent service will act as your agent for an annual fee — useful if you'd rather not list your own contact details, but unnecessary for most.

→ Once registered, send me: the agent name + the registration confirmation, and I'll finalize Terms §8 (it currently has a placeholder; the notice email `notice@theblacqlist.com` is already in place).

---

## What I do when you return these

1. Fill the mailing address into Privacy §11 + Terms §14.
2. Fill the DMCA agent name + registration into Terms §8.
3. Bump "Last updated" on all three legal pages to the fill date.
4. Flip ticket `102-dmca-designated-agent.md` + the compliance review (Findings 4/5) + the board card to ✅ — clearing the Legal P0's founder-input items.

> Separately, attorney sign-off on the full Privacy/Terms is a recommended (not code) step before public launch — see `privacy-terms-compliance-review.md`.
