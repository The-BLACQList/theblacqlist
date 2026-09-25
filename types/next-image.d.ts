// Static image imports (`import mark from '@/public/brand/x.png'`) are typed by
// `next/image-types/global`. Next normally pulls that in through next-env.d.ts,
// but next-env.d.ts is gitignored and only exists after `next dev` or
// `next build`, so a fresh CI checkout running `tsc --noEmit` never sees it.
// This tracked reference makes typecheck independent of that generated file.
/// <reference types="next/image-types/global" />
