# Ticket 120: Fix the Twisted Soul Cookhouse website

**Phase:** V1 · **Priority:** P1 · **Status:** Ready
**Depends on:** none (no migration)
**Gates:** GATE-DATA (staging, then prod write) and GATE-DEPLOY

---

## Why

The founder reported on 2026-10-05 that Twisted Soul Cookhouse & Pours links to the wrong website. The seed used `https://twistedsoulcookhouseandpours.com`. The correct address is `https://www.twistedsoulatl.com/`.

The seeder writes with `ignoreDuplicates`, so fixing the seed files alone never reaches a row that already exists. The live row has to be corrected too.

## Acceptance criteria

- `scripts/data/listings-atlanta.json` and `supabase/seeds/001_listings.sql` hold the new URL for both `website_url` and `cta_url`.
- `scripts/reconcile-listing-corrections.ts` declares both corrections, with the reason.
- The script skips any listing that is not `unclaimed`. An owner's data wins over our seed.
- A dry run on staging shows "would change" for both fields. `--apply --yes` writes them, and a second dry run shows "already".
- The same sequence on prod, after the founder approves GATE-DATA.
- After the prod write, the live listing page links "Website" and "Book" to twistedsoulatl.com. The page is ISR, so allow for the revalidate window or trigger a revalidation.

## How to run

```
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/reconcile-listing-corrections.ts
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/reconcile-listing-corrections.ts --apply --yes
```

Check the printed project ref before passing `--yes`. Staging is `fmbohsloskqbmlwbzpjm`. Prod is `ytlrnczevdnsfdzjbeqg`.

## Note

The script also still declares the Corner Grille state fix from 2026-08-14. The dry run shows whether it already landed. If it did, it reports "already" and writes nothing.

## Out of scope

Changing the CTA type. It stays "Book".
