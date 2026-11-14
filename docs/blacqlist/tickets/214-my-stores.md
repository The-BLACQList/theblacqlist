# Ticket 214: My stores, a one-time sheet and a header chip

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 213
**Gates:** a migration (GATE-DATA) for signed-in picks. A Privacy agent pass, and a line in the privacy policy, before it ships: picked stores say roughly where someone lives. Behind `FEATURE_MARKETPLACE_OPEN`.
**Decision record:** S4 B (founder, 2026-11-08), a one-time sheet then a header chip. Q9 C, no cap on stores. Q5 A, sign-in only to save a list, so store picks work signed out.

## Why

The shopper's own stores come first on every product page and in every list result. We ask once, at the moment it matters, then stay out of the way.

## Scope

In:
- **The sheet,** as drawn on S4-B:
  - "Pick your stores";
  - the body: "Choose the stores you already shop at. We'll check them first for Black-owned brands.";
  - a ZIP field with `inputMode="numeric"`;
  - "Stores near {zip}": active physical stores from 213 within 25 miles, nearest first, each with its distance;
  - checkboxes, then **Save my stores** with the count, and "Not now".
  It opens before the first list results, and from the header chip. If the shopper taps "Not now", it isn't asked again on that device.
- **The header chip** on Shop pages:
  - "Pick your stores" when none are picked;
  - "{n} stores" or the store name once picked.
  Tapping it reopens the sheet.
- **Storage:**
  - signed out, the picks stay on the device, in localStorage with try/catch;
  - signed in, a migration adds `shopper_stores` (`profile_id`, `store_id`, `created_at`, both together as the primary key, CASCADE on profile delete), with RLS so a shopper can only see their own picks;
  - on sign-in, device picks are merged into the account.
- **Account.** A "My stores" section on `/account`, where the shopper can remove stores or open the sheet.
- **Account deletion.** Delete the shopper's rows. The CASCADE covers this. Check it against the deletion-trigger gotcha: the delete must not need a trigger.

Out:
- A cap. There is none (Q9 C).
- Store suggestions based on location access. The ZIP is enough for v1.

## Checks

- No ZIP is ever stored, signed in or out. Only store ids are kept.
- Signed out: pick two stores, reload, and both are still picked. Sign in, and both show on `/account`.
- Twenty picks save fine.
- Deleting the account removes the shopper's `shopper_stores` rows, and the deletion E2E still passes.
- The sheet traps focus, Escape closes it, and focus goes back to the chip. Tap targets are at least 44px at 375px.
