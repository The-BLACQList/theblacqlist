# Ticket 121: Show the BLACQLight story cover on the homepage

**Phase:** V1.5 · **Priority:** P2 · **Status:** Ready
**Depends on:** 116, 117 (story covers, LIVE)
**Gates:** GATE-DEPLOY

---

## Why

Stories have covers on `/blacqlight` and on each article page. The homepage still showed a gradient placeholder in the BLACQLight block, and the story cards in the rail below had no photo. The founder asked on 2026-10-05 for the cover to show on the homepage too.

## Acceptance criteria

- The homepage editorial query selects `cover_image_path` and resolves it with `resolveStoryCover`, the same helper the story pages use.
- Given the newest story has a cover, the BLACQLight block shows it, in the same treatment as the `/blacqlight` lead card: grayscale at rest, colour on hover, no transition under reduced motion.
- Given it has no cover, the block keeps the ember wash and the gold quote mark.
- The image has `alt=""`, because the headline sits right beside it.
- The story cards in the "More stories & city guides" rail show their covers through `BlogPostCard`'s existing `coverSrc`.
- No layout shift: the image fills the existing aspect box.

## QA notes

- Check 375px and 1280px. Check a story with a licensed `/images/editorial/*` cover and one with a storage cover.
- Axe passes on `/`.

## Out of scope

Making the cover itself a link. The "Read the story" button is the link.
