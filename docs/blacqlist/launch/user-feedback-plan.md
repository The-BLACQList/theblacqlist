# User Feedback Plan: The BLACQList

**Updated:** 2026-11-19 (replaces the 2026-05-11 team version)
**Status:** Active from launch day
**Owner:** Chalece (founder). One person holds every role in this plan.
**References:** `support-playbook.md`, `on-call.md`, `rollback-plan.md`, `post-launch-plan.md`

This plan is written for one operator. There are no named roles, no Slack and no tester channel. Every piece of feedback ends up in one inbox, gets one reply clock, and is swept once a week.

---

## 1. One Inbox

**support@theblacqlist.com** is the only place feedback is answered from.

| Channel                 | How it reaches support@                                                                                                                                                                        | When to check                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Email                   | People write to support@ directly. The Contact page lists it under Questions and Feedback.                                                                                                     | Daily                                                         |
| Report a Problem form   | Signed-in users only. Each report is saved to the queue at `/admin/feedback` and emailed to support@. Replying to that email answers the reporter.                                             | Daily (arrives as email)                                      |
| Replies to site emails  | Every site email is sent from noreply@ with Reply-To set to support@ (claims, receipts, billing, verification). Booking requests are the exception: the business's reply goes to the customer. | Daily (arrives as email)                                      |
| Business invite replies | The unlisted-business invite sets Reply-To to support@, so replies, including STOP, land here.                                                                                                 | Daily (arrives as email)                                      |
| Social mentions         | Not automatic. Check @theblacqlist mentions by hand and move anything that needs an answer to email.                                                                                           | Daily for the first 30 days (Ops recommendation), then weekly |

**On social:** do not troubleshoot in public. Reply with "Thanks for letting us know. Could you email the details to support@theblacqlist.com so we can look into it?" and handle it from the inbox.

Other addresses on the Contact page (business@, press@, privacy@) are separate and keep their own reply times (Section 3).

---

## 2. Categories

Tag each item with one category when you first read it. There is no owner column: the owner is always you.

| Category            | What it means                                                                   | Where it goes                                                                 |
| ------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Urgent Problem**  | Site down, cannot sign in, a payment problem, or data shown to the wrong person | Same day. Use `rollback-plan.md` or `incident-response-runbook.md` if needed. |
| **Bug**             | Something is broken but people can still use the site                           | A ticket, fixed in the next batch                                             |
| **Confusing**       | Not broken, but people get lost (labels, steps, empty states)                   | Weekly sweep, ticket if the fix is clear                                      |
| **Listing Fix**     | Wrong hours, address, phone or name on a listing                                | Fix in `/admin/listings`, or ask the business                                 |
| **Claim**           | Trouble submitting a claim, or a question about one                             | `/admin/claims`                                                               |
| **Feature Request** | Something the site does not do yet                                              | Feature list, reviewed monthly                                                |
| **Accessibility**   | Screen reader, keyboard, contrast or label problems                             | Treated as a Bug, or as Urgent if someone is locked out                       |
| **Praise**          | Kind words                                                                      | Saved for the monthly summary                                                 |
| **Unclear**         | Not enough detail to tell                                                       | Reply asking for more (template in Section 4)                                 |

---

## 3. Reply Clocks

Two clocks, measured from when the message arrives.

| What                                                                                                | First reply            |
| --------------------------------------------------------------------------------------------------- | ---------------------- |
| **Urgent:** site down, sign-in, payment or data problems                                            | Same day               |
| **Everything else:** bugs, confusing steps, listing fixes, claim questions, feature requests, press | Within 2 business days |

A first reply is a real person saying "got it" and what happens next. It does not have to be the fix.

**What the public sees.** The Contact page promises:

| Row                    | Promise                  |
| ---------------------- | ------------------------ |
| Questions and Feedback | Within 2 Business Days   |
| Business Claims        | Within 3–5 Business Days |
| Press Requests         | Within 2 Business Days   |
| Privacy Requests       | Within 30 Days           |

"Same day" for urgent problems is an internal target, not a public promise.

**Claims.** The public promise is a decision within **3–5 business days** (D-014). It matches the claim form, the claim page and the Claim Submitted email. Internally, aim to review each claim within 48 hours during business hours (`support-playbook.md`, `on-call.md`); this is the target launch gate M5 checks. Beating the public promise is fine. Missing it is not.

---

## 4. Reply Templates

Change the bracketed parts. Sign with your first name: a person, not a team.

**Urgent problem**

> Hi [name],
>
> Thank you for telling us. I'm looking into it now and will write back today with an update.
>
> Chalece, The BLACQList

**Bug or confusing step**

> Hi [name],
>
> Thank you for reporting this. I've logged it and it's on the list for an upcoming fix. I'll let you know when it's done.
>
> Chalece, The BLACQList

**Feature request**

> Hi [name],
>
> Thank you for the idea. I've added it to the list I review every month, and I'll reach out if it makes it into an update.
>
> Chalece, The BLACQList

**Listing fix**

> Hi [name],
>
> Thank you for letting us know. I'm checking with the business and will update the listing as soon as I confirm the right details.
>
> Chalece, The BLACQList

**Claim question**

> Hi [name],
>
> Thank you for reaching out about your claim. I found your submission, and you'll have a decision within 3–5 business days. We'll email [their email] as soon as it's made.
>
> Chalece, The BLACQList

**Need more detail**

> Hi [name],
>
> Thank you for writing in. So I can look into this, could you tell me:
>
> - What you were trying to do
> - Which page or step you were on
> - What you saw (an error message, a blank screen, something else)
>
> Chalece, The BLACQList

---

## 5. Routine

### Daily (5 minutes)

- Read support@. Answer anything Urgent the same day.
- Tag the rest with a category. Answer what you can in under two minutes; the rest waits for the sweep, inside the 2 business day clock.
- First 30 days: check social mentions.

### Weekly Sweep (30 minutes, same day each week)

1. Open `/admin/feedback` and set a status on every new report (triaged, fixed or dismissed).
2. Check that every email from the week has had a first reply.
3. Turn Bugs and clear Confusing fixes into tickets in `docs/blacqlist/tickets/` (title: `[Bug] short description`). Several small ones can share one "minor fixes" ticket.
4. Fix or chase each Listing Fix: correct it in `/admin/listings`, or ask the business. If the business hasn't answered in 7 days and the detail is clearly wrong, flag the listing for review with a note.
5. Note anything that came up more than once.

### Monthly Feature Review (first week of the month)

1. Group similar feature requests and count them.
2. Mark each group: build soon, later, needs research, or not building (with one line on why).
3. Anything asked for 5 or more times gets a short brief or a roadmap line.

---

## 6. Day 30 Summary

Fill this in at Day 30. Counts can come from the support@ inbox and `/admin/feedback`.

```
## Feedback Summary: Day 30
Period: [launch date] to [Day 30 date]
Total items: [N]

By channel: email [N], Report a Problem [N], replies to site emails [N], invite replies [N], social [N]
By category: urgent [N], bugs [N], confusing [N], listing fixes [N], claims [N], features [N], accessibility [N], praise [N]

Reply clocks met: urgent same day [X of N], others within 2 business days [X of N]
Claims decided within 3–5 business days: [X of N]

Top 3 problems (by count): 1. [...] 2. [...] 3. [...]
Top 3 feature requests (by count): 1. [...] 2. [...] 3. [...]
Next month's focus: [one or two lines]
```

---

## 7. Day 60 Check

At Day 60, ask:

- Is support@ read every day, and are both reply clocks being met?
- Is the weekly sweep taking more than 30 minutes? If yes, what is filling it?
- Are claims decided within 3–5 business days?
- Is daily social checking still worth it, or can it move to weekly?
- Is volume high enough to need a tool (a help desk or shared inbox)? Decide on actual numbers.

---

## 8. Open Items

- **support@ must receive mail.** A test on 2026-11-19 bounced ("address not found"). Chalece is adding support@ as an alias in Google Workspace; send a new test to confirm it before this plan goes live.
- **Replies from support@ may land in spam.** The root SPF record for theblacqlist.com does not include Google (`include:_spf.google.com`) and there is no Google DKIM key. Mail sent from Gmail as support@ can fail checks. Fix in Google Admin (turn on DKIM) and DNS (add Google to SPF). This is a founder DNS task, separate from this plan.
- **Other Contact page addresses** (business@, press@, privacy@) and hello@ (still on the Pricing page FAQ) have not been tested.
