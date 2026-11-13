# 199: A pinned review quote in the hero

**Status:** Stub — founder 2026-11-13. Not on the sample page; needs a decision before it is built.
**Follows:** 184
**Area:** business pages (hero), the owner dashboard (reviews)

**Problem.** Social proof above the fold without the owner writing copy.

**Proposed shape.** `listings.pinned_review_id` FK to a **published** review on the same listing; the hero shows one line of it with the reviewer's display name and a link to Reviews. Only a real review can be pinned, which keeps it inside the no-fabrication rule; deleting or unpublishing the review clears the pin.

**Depends on.** 184. **Gate.** GATE-DATA for the migration.
