# 200: Sticky desktop mini header on long pages

**Status:** Stub — founder 2026-11-13. Not on the sample page; needs a decision before it is built.
**Follows:** 184
**Area:** business pages (desktop)

**Problem.** Mobile has `EntityQuickActionBar`; desktop has only the sticky anchor tabs. On a long Premium page the name, open-now status and primary CTA scroll away.

**Proposed shape.** A slim bar that appears once the hero scrolls out: logo · name · `OpenStatus` · primary CTA · Message, sharing `EntityAnchorTabs`' sticky slot so the two never stack. No data; display only.

**Depends on.** 184, 185 (logo). **Gate.** none.
