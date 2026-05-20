# Support Playbook — The BLACQList

**Last updated:** 2026-05-18  
**Audience:** Anyone handling user-reported issues — not just engineers. Written in plain language.  
**How to use:** Match the user's reported symptom to an issue below. Follow the diagnostic steps in order. If the issue doesn't match any entry, escalate to engineering.

---

## How to Escalate

| Severity | When to escalate | How |
|---|---|---|
| Needs a code fix | Resolution requires changing application code | File a GitHub issue with steps to reproduce |
| Needs a data fix | The user's data is incorrect and needs to be corrected in the database | Contact engineering — do not edit the database yourself |
| User is very distressed or the issue has been open > 24h | — | Flag to engineering lead directly |

---

## Issue 1 — "Claim approved but I still can't access my dashboard"

**Symptom:** User says their claim was approved by an admin but when they log in, they don't see the Owner Dashboard or their listing.

**Diagnostic steps:**
1. Ask the user: are you signed in with the same email address you used to submit the claim?
2. In Supabase Studio (prod) → Table Editor → `user_roles`: search for the user's `user_id` (found in `auth.users`)
   - Expected: a row with `role = 'owner'` for this user
   - If missing: the approval action did not create the role row — this is a bug. Escalate to engineering.
3. Ask the user to sign out completely and sign back in (session may not have the updated role claim)
4. If the `user_roles` row exists and sign-out/sign-in doesn't help: escalate to engineering (middleware may not be refreshing the session)

**Resolution:** Usually resolved by the user signing out and back in. If the `user_roles` row is missing, engineering needs to insert it.

---

## Issue 2 — "My listing isn't showing in search or discover"

**Symptom:** A business owner says their listing doesn't appear when they search for it or browse in the city where it's listed.

**Diagnostic steps:**
1. In Supabase Studio → `listings`: find the listing by name or owner email
2. Check `status` column: must be `'published'`. If `'pending'` or `'rejected'`, the listing has not been approved by admin.
3. Check `deleted_at`: must be NULL. If set, the listing is soft-deleted.
4. Check `entity_type`: must be `'business'` for standard discover/search.
5. Check `city_id`: must be set and reference a valid city with `is_active = true`.
6. If all the above are correct but the listing still doesn't appear: check `search_vector` in the `listing_details_business` table — it should be populated. If NULL, the search vector trigger may not have run. Ask engineering to manually run `UPDATE listing_details_business SET search_vector = ...` for this listing.

**Resolution:** If `status = 'pending'`, the listing needs admin approval. If all fields look correct, escalate to engineering for search index investigation.

---

## Issue 3 — "I uploaded my documents but my claim is still showing as pending"

**Symptom:** An owner says they submitted their claim with a document, but in their account it still shows "Pending review."

**Diagnostic steps:**
1. In Supabase Studio → `claims`: find the claim by the user's `user_id` or the `listing_id`
2. Check `status`: `'pending'` is correct — it means admin has not reviewed it yet. Explain this to the user (it's not a bug).
3. Check `verification_doc_path`: if this is NULL, the document upload failed silently. Ask the user to resubmit.
4. Check the admin claims queue at `/admin/claims` — is the claim visible there? If yes, it just needs an admin to review it.
5. If the claim is not in the admin queue at all: escalate to engineering.

**Resolution:** Most of the time, this is user expectation management — claims require manual admin review. If the doc path is missing, ask the user to reupload.

---

## Issue 4 — "My verification document upload keeps failing"

**Symptom:** When an owner tries to upload a document as part of a claim, they get an error or the upload appears to stall.

**Diagnostic steps:**
1. Ask the user: what file type and size? Accepted: JPEG, PNG, PDF under 10MB.
2. Ask: what browser and device? Some mobile browsers have issues with file picker + upload combination.
3. In Supabase Dashboard → Storage → `verification-docs` bucket: check if any recent uploads appear.
4. Check Supabase Storage RLS: the bucket policy should allow authenticated users to INSERT their own files. If the policy was recently changed, it may be blocking uploads. Escalate to engineering if you suspect a policy issue.

**Resolution:** Redirect to a supported file type/size. If the issue persists across files and browsers, escalate to engineering for Storage policy review.

---

## Issue 5 — "I can't sign in to my account"

**Symptom:** User says their email/password combination is rejected, or they get stuck in a redirect loop.

**Diagnostic steps:**
1. Ask: are they using "Sign in with Google" or email/password? Different flows, different failure modes.
2. For email/password: ask them to use "Forgot password" to reset. Most sign-in failures are forgotten passwords.
3. For Google: ask them to try a private/incognito browser window. Google OAuth sometimes has session cookie conflicts.
4. In Supabase Dashboard → Authentication → Users: find the user by email.
   - Check `email_confirmed_at`: if NULL, they never confirmed their email. Ask them to check for the confirmation email.
   - Check `banned_until`: if set, the account has been suspended.
5. If the account looks healthy in Supabase but they still can't sign in: ask them to clear cookies for `theblacqlist.com` and try again.

**Resolution:** Password reset resolves most cases. If the account is unconfirmed, resend the confirmation email (Supabase Dashboard → Auth → Users → ··· → Send confirmation email). If banned, review the account and decide whether to unban.

---

## Issue 6 — "My gallery images aren't showing on my page"

**Symptom:** An owner says images they uploaded via the dashboard aren't appearing on their public listing page.

**Diagnostic steps:**
1. In Supabase Studio → `media_attachments`: find rows where `listing_id` matches the listing.
   - If no rows: the upload didn't create a record. Ask the owner to try reuploading.
   - If rows exist: check `file_path` is non-empty.
2. In Supabase Dashboard → Storage → `listing-media`: check if the files are actually stored at that path.
3. Check the bucket is set to public. If not, image URLs will 403.
4. The listing page uses ISR with a 1-hour cache. If images were very recently uploaded, the page may still be serving a cached version without the new images. Ask the owner to wait up to 1 hour, or ask engineering to trigger manual revalidation via `revalidatePath()` for that listing.

**Resolution:** If files exist in Storage and the bucket is public, it's likely a cache issue — wait for ISR to expire or trigger revalidation. If files are missing from Storage, ask the owner to reupload.

---

## Issue 7 — "I updated my hours but my page still shows the old hours"

**Symptom:** An owner edited their opening hours in the dashboard and saved, but the public page still shows the old information.

**Diagnostic steps:**
1. Verify the save actually worked: in Supabase Studio → `listing_hours`, check if the rows reflect the new hours.
2. If the data is correct in the database, the page is showing cached content. The entity page has a 1-hour ISR revalidation interval (`revalidate = 3600`).
3. The fix is to trigger revalidation. Engineering can call `revalidatePath('/[citySlug]/business/[listingSlug]')` or use the admin `revalidatePath` action if one exists.

**Resolution:** Explain the 1-hour cache to the user. Ask engineering to trigger a manual revalidation if it's urgent.

---

## Issue 8 — "My analytics data shows 0 views even though I know people are visiting"

**Symptom:** An owner looks at their analytics dashboard and sees 0 page views.

**Diagnostic steps:**
1. Check when the owner was last on the analytics page. Analytics aggregate nightly via pg_cron at 03:00 UTC — data from today won't appear until tomorrow morning.
2. In Supabase Studio → `analytics_events`: search for rows where `entity_id` matches the listing and `event_name = 'page_view'`. If there are rows, the events are being recorded — they just haven't been aggregated yet.
3. If `analytics_events` has no rows for this listing at all: check if the page view tracking is working. View the listing page and then recheck `analytics_events`.
4. In Supabase Studio → `entity_analytics_daily`: check if any rows exist for this listing. If not, either no events have been aggregated yet or the aggregation job isn't running. Check the `cron_job_run_details` table (or Supabase pg_cron logs) to confirm the job is scheduled.
5. If no events are being recorded at all (across all listings): escalate to engineering — the analytics event ingestion endpoint may be failing.

**Resolution:** Usually a timing issue. Data aggregates nightly — tell owners to check tomorrow. If the pg_cron job isn't running, escalate to engineering.

---

## Issue 9 — "The page editor won't save my changes"

**Symptom:** An owner edits their listing details in the dashboard and clicks Save, but either gets an error or the changes don't persist.

**Diagnostic steps:**
1. Ask the owner: what exactly happens when they click Save? Error message? Page refreshes with no message? Spinner that never resolves?
2. Ask them to open the browser console (F12 → Console) and check for red errors. A TypeScript/React error often surfaces here.
3. Check if the form has validation requirements — some fields (like description) may have minimum length requirements. An unhelpful validation error message may be the cause.
4. Try reproducing in a different browser. Safari sometimes behaves differently with form submissions.
5. In Supabase Dashboard → Logs → API logs: look for 4xx or 5xx responses to requests from the owner's IP or user ID around the time of the failure.

**Resolution:** If validation is blocking, guide the owner through the field requirements. If there's a server error, escalate to engineering with the specific field being edited and the error message from the browser console.

---

## Issue 10 — "I submitted a review but it's not showing on the listing page"

**Symptom:** A user says they wrote a review and submitted it, but it doesn't appear on the business page.

**Diagnostic steps:**
1. Explain: reviews are moderated before they appear. All submitted reviews require admin approval before they're visible on the public page.
2. In Supabase Studio → `reviews`: find the review by `reviewer_user_id` or `listing_id`. Check `status`:
   - `'intake'` = submitted, awaiting admin review (normal)
   - `'published'` = approved, should be visible
   - `'rejected'` = rejected by admin
3. If `status = 'published'` but not showing: check the listing page's review section. The page may be cached. Also check that the `listing_id` on the review matches the correct listing.
4. If `status = 'intake'` and it has been > 48 hours: flag to the admin team to review the moderation queue.

**Resolution:** If the review is in `'intake'` status, it just needs admin moderation. If in `'published'` status and still not showing, escalate to engineering for a cache/query investigation.

---

## General Escalation Template

When filing a bug report to engineering, include:

```
User email: [email]
User ID: [from Supabase auth.users if available]
Listing/claim/review ID: [relevant ID]
Reported issue: [What the user says is happening]
Steps to reproduce: [Exact steps]
What was found in DB: [What you checked and what you found]
Browser/device: [If relevant]
Time of issue: [Approx timestamp UTC]
```
