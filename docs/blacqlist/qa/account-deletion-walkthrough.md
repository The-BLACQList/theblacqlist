# Account-Deletion Walk-Through — the last launch-gate item

_The human half of the account-deletion QA (prod-qa-closeout item 1). ~10–15 min. The code was already reviewed and passes (`docs/blacqlist/qa/prod-qa-closeout.md` §1 has the cascade/FK detail) — this proves it end-to-end on the live database: that deleting an account actually removes the person's data, keeps their business listing (just unclaimed), and can't be undone._

## What you need
- Your **bypass token** — add `?preview=<token>` to the first URL to set the cookie, then browse normally.
- A **throwaway email** you can receive (or just confirm the user in Supabase).
- **Prod Supabase SQL editor** access (project `ytlrnczevdnsfdzjbeqg`).
- ~10–15 min. Phone is fine for the clicking; the SQL needs the Supabase dashboard.

> Do this one **last** in any QA session — it consumes the throwaway account.

---

## Step A — Make a throwaway account
1. Open `https://theblacqlist.com/?preview=<token>` (sets the bypass cookie).
2. Go to `/sign-up` and create a throwaway account, e.g. `qa-delete-jun30@<your-inbox>`.
3. Confirm it: click the email link, **or** Supabase → Authentication → Users → ⋯ on that user → confirm.

## Step B — Generate some data as that user
Signed in as the throwaway user:
- **Save a business** — tap the heart on any listing.
- **Submit a business** — `/add-business`, complete the 7 steps and submit (this creates an *owned* listing — the one we'll confirm survives).
- _(Optional)_ leave a **review** on a listing, if you want to confirm reviews get removed too.

## Step C — Capture the BASELINE (before you delete)
You can't read any of this after deletion, so grab it now.

1. **User UUID:** Supabase → Authentication → Users → click the throwaway user → copy the **User UID**.
2. **Owned listing id:** in the SQL editor, run (replace `:uid`):
   ```sql
   select id, slug, status from listings where submitted_by = ':uid';
   ```
   Copy the `id` of the listing you submitted in Step B → that's your `:listing_id`.
3. **Prove the data exists now** — run the same verification queries you'll re-run after deleting. Replace `:uid`; **expect some NON-zero counts** here (that's the point — it proves there's real data to remove):
   ```sql
   -- BASELINE (before delete): expect non-zero for what you created in Step B
   select 'profiles' as t, count(*) from profiles where id = ':uid'
   union all select 'saves',   count(*) from saves   where user_id = ':uid'
   union all select 'reviews', count(*) from reviews where reviewer_user_id = ':uid'
   union all select 'listings.submitted_by', count(*) from listings where submitted_by = ':uid';
   ```
   _(e.g. profiles 1, saves ≥1, listings.submitted_by 1 — confirms the account really has data.)_

## Step D — Delete the account
1. Go to **`/account/settings`**.
2. Click **"Delete my account…"**.
3. Type **`DELETE`** in the confirmation box.
4. Click **"Permanently delete account"**.
5. ✅ You should land on **`/sign-in?deleted=1`** (a "your account and data have been deleted" message).
6. Try to **sign back in** with that email → it must **fail** (the account is gone).

## Step E — Verify the deletion (after)
Run these in the prod SQL editor, replacing `:uid` and `:listing_id`. (Same block as `prod-qa-closeout.md` §1b.)

```sql
-- (A) PII rows — CASCADE + the explicit reviews delete. Every count MUST be 0:
select 'auth.users'      as t, count(*) from auth.users      where id = ':uid'
union all select 'profiles',        count(*) from profiles        where id = ':uid'
union all select 'user_roles',      count(*) from user_roles      where user_id = ':uid'
union all select 'saves',           count(*) from saves           where user_id = ':uid'
union all select 'receipt_uploads', count(*) from receipt_uploads where user_id = ':uid'
union all select 'subscriptions',   count(*) from subscriptions   where user_id = ':uid'
union all select 'reviews',         count(*) from reviews         where reviewer_user_id = ':uid';
-- → every count MUST be 0 (rows deleted).

-- (B) No dangling references — SET NULL columns must all be nulled, so rows STILL
--     pointing at :uid MUST be 0:
select 'analytics_events.user_id'         as ref, count(*) from analytics_events  where user_id = ':uid'
union all select 'search_events.user_id',         count(*) from search_events     where user_id = ':uid'
union all select 'media_attachments.uploaded_by', count(*) from media_attachments where uploaded_by = ':uid'
union all select 'claims.claimant_user_id',       count(*) from claims            where claimant_user_id = ':uid'
union all select 'listings.owner_user_id',        count(*) from listings          where owner_user_id = ':uid'
union all select 'listings.submitted_by',         count(*) from listings          where submitted_by = ':uid'
union all select 'listings.updated_by',           count(*) from listings          where updated_by = ':uid';
-- → every count MUST be 0 (references nulled). (spend_events has NO user_id by
--    design — anonymized community data — so there's nothing to check there.)

-- (C) Owned listing PRESERVED but unclaimed (row still exists, authorship nulled):
select id, status, owner_user_id, submitted_by, updated_by
from listings where id = ':listing_id';
-- → row returns; owner_user_id / submitted_by / updated_by all IS NULL.
```

## Pass criteria
| Check | Expected |
|---|---|
| Land on `/sign-in?deleted=1` after deleting | ✅ |
| Can't sign back in with that account | ✅ |
| (A) every count | **0** (PII rows gone) |
| (B) every count | **0** (references nulled — no dangling pointers) |
| (C) owned listing row | **still exists**, with `owner_user_id` / `submitted_by` / `updated_by` = **NULL** |
| _(Optional)_ Supabase → Storage | the user's receipt/avatar files gone (or, if a storage hiccup left them, no row references them) |

## When you're done
**Paste me the BASELINE (Step C) + the post-deletion (Step E) SQL output** and I'll review it against the pass criteria and sign off. That closes the last launch-gate item.

> **What "good" looks like:** Step C shows non-zero (data existed) → Step E shows all 0 + the listing preserved-but-unclaimed (data removed, business kept). That's the whole proof: a user's personal data is permanently deleted, while their business stays in the directory as an unclaimed listing — exactly what Privacy Policy §7 promises.
