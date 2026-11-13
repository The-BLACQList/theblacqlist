# Font licenses

Fonts committed to the repo as files. The site itself loads its fonts through
`next/font/google` and commits nothing; these files exist because the share-card
renderer (`next/og`, which runs Satori) needs raw TrueType data and can't use
`next/font` or a WOFF2 file.

| File                         | Family | Weight       | License                   | Source       |
| ---------------------------- | ------ | ------------ | ------------------------- | ------------ |
| `assets/fonts/Jost-300.ttf`  | Jost   | 300 Light    | SIL Open Font License 1.1 | Google Fonts |
| `assets/fonts/Jost-500.ttf`  | Jost   | 500 Medium   | SIL Open Font License 1.1 | Google Fonts |
| `assets/fonts/Inter-600.ttf` | Inter  | 600 Semibold | SIL Open Font License 1.1 | Google Fonts |

**Used by:** `lib/share/cardAssets.ts` (read at request time) for the cards drawn
by `app/api/share-card/listing/[slug]/route.tsx`.

**What the OFL allows:** bundling, embedding and redistributing the fonts with
software, including commercially, as long as the fonts aren't sold on their own.
Rendering them into a PNG carries no obligation at all. The license texts are at
https://openfontlicense.org.

Added 2026-11-13 with the profile share sheet.
