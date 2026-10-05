import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { OpeningSoonCover } from '@/components/marketing/OpeningSoonCover'
import { SOON_FEATURES, SOON_FEATURE_KEYS, isSoonFeature } from '@/lib/features/opening-soon'

// The cover for a feature that isn't open yet (ticket 122). People normally
// land here through a rewrite in proxy.ts, so the address bar still shows the
// link they followed. Once a feature opens, proxy.ts redirects this path to
// the real thing, so the page itself never has to read the flag.

interface Props {
  params: Promise<{ feature: string }>
}

export const dynamicParams = false

export function generateStaticParams(): { feature: string }[] {
  return SOON_FEATURE_KEYS.map((feature) => ({ feature }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { feature } = await params
  if (!isSoonFeature(feature)) return {}
  const config = SOON_FEATURES[feature]
  return {
    title: `${config.name} is opening soon | The BLACQList`,
    description: config.blurb,
    robots: { index: false, follow: true },
  }
}

export default async function OpeningSoonPage({ params }: Props) {
  const { feature } = await params
  if (!isSoonFeature(feature)) notFound()
  return <OpeningSoonCover feature={SOON_FEATURES[feature]} />
}
