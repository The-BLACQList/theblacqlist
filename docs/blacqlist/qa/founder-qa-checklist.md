# Founder QA Checklist — the 5 things to click through before launch

_This is the human half of the regression QA (ticket 089). I've already run everything that can be automated (see the bottom). You just walk these 5 short journeys and note anything that looks broken — I'll handle the rest and write the final Go/No-Go._

## How to run it
- **~30–45 min.** Do it on your **phone** first; if you have time, repeat the quick version on a **laptop browser**.
- **Add `?preview=<your token>` to every URL** (the same bypass token you've been using). The first link sets the cookie, then you can browse normally.
- For each step: does it do what the **✅ "should see"** says? Just note **Y / N**. If something's broken or weird, jot a quick line ("step 4 — Save button did nothing").
- You'll need to **sign in with your admin account** for journeys 4 and 5.
- **Send me your Y/Ns + any notes.** I fix anything that fails, fill in the formal report, and write the Go/No-Go.

---

## ① Browse & find a business _(not signed in)_
Start at `https://theblacqlist.com/?preview=<token>`

- [ ] Homepage loads — hero + search bar · **✅ looks right, nothing missing**
- [ ] Search "restaurant" (Atlanta) · **✅ a results page with listing cards**
- [ ] Tap a listing card · **✅ the business page opens with its name/info**
- [ ] Tap **Save** (the heart) · **✅ it bounces you to the sign-in page** (you're not logged in)

## ② Add a business _(not signed in / new account)_
Go to `/add-business?preview=<token>`

- [ ] The 7-step form starts · **✅ Step 1 loads**
- [ ] Fill the steps (business name, category, contact, a photo, a CTA) · **✅ each step advances, nothing lost going back**
- [ ] Submit on Step 7 · **✅ lands on a "submitted / thanks" page** (no error)

## ③ Claim a business
Open any published listing page, look for **"Claim this business"**

- [ ] Claim link is visible on the page · **✅ there**
- [ ] Start the claim → fill the form → attach a file · **✅ all fields work, file attaches**
- [ ] Submit · **✅ a success message** (no error)

## ④ Your dashboard _(sign in with your admin account)_
Sign in, then go to `/dashboard?preview=<token>`

- [ ] Dashboard loads · **✅ you see your listings area**
- [ ] Open the page editor, change a business name, **Save** · **✅ saves, shows a success message**
- [ ] Open **Analytics** · **✅ the analytics page loads (charts/cards)**

## ⑤ Admin _(signed in as admin)_
Go to `/admin?preview=<token>`

- [ ] Admin area loads · **✅ admin layout, not a redirect**
- [ ] Open **Claims** (`/admin/claims`) · **✅ the claims queue loads**
- [ ] Open **Listings** (`/admin/listings`) · **✅ the listings table loads + search works**
- [ ] Open **Analytics** + try the **CSV download** · **✅ page loads, CSV downloads**

---

## Anything broken? Note it here
> _(write any "this didn't work" lines — or "all good")_

-

---

## Already verified by me (the automated half — you don't need to test these)
- ✅ All public pages load on prod (home, discover, search, listing, sign-in, sign-up; 404 page 404s).
- ✅ **Security gates:** signed-out visitors are bounced from `/dashboard`, `/account`, `/admin`, `/account/settings` → sign-in (with return-path preserved).
- ✅ **Database security (RLS):** anon can't read drafts; users can't read each other's private data (re-verified on prod).
- ✅ **Error monitoring** (Sentry), **uptime monitors**, **health checks**, **unit tests** (6/6, incl. the no-PII scrubber).
- ✅ **Accessibility** (097/098 fixes) + **performance** (Lighthouse 90–100, no layout shift) on the 5 key pages.
