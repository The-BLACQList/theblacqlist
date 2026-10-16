import { permanentRedirect } from 'next/navigation'

interface Props {
  params: Promise<{ entityId: string }>
}

// Writing help now lives inside Edit content, next to each field it can help
// with (ticket 138). Old links and bookmarks land there.
export default async function AiSuggestionsPage({ params }: Props) {
  const { entityId } = await params
  permanentRedirect(`/dashboard/pages/${entityId}/edit`)
}
