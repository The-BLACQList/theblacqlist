# 188: The click-to-fill editor — the sample page as the owner's editor

**Status:** Reserved — founder 2026-11-13. The goal the 184 plan works toward; starts after 184, 185 and the feature tickets it needs (107–110, 189–196) have shipped.
**Follows:** 184 (section registry, `SectionMark`, `isFilled`, `editor.href`, `minTierFor`), 185
**Area:** the owner dashboard
**Gates:** to be set when it is specified.

## Why

The founder wants an owner to fill in their page by looking at a fully loaded example of it: click a missing or demo area, fill it with our tools, or get an upgrade prompt. 184 built the example and the registry; this ticket turns them into the editor.

## Proposed shape

- `EntityRenderMode` gains `'edit'`. In edit mode each `SectionMark` becomes a target: filled sections show the owner's own content with an "Edit" affordance (`editor.href`); empty sections show the sample content faded with "Fill this in"; sections above the owner's plan show the sample content with "Upgrade to {minTierFor(id)}".
- Nothing is saved from the example page itself; every action deep-links to the existing editor route (`page()` and `edit()` in `lib/entity-page/sections.ts`), which is why the registry carries those links today.

## Not in this ticket

Any new section or table. 188 only reuses what the feature tickets build.
