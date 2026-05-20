import { redirect } from "next/navigation"

interface Props {
  params: Promise<{ entityId: string }>
}

export default async function EntityDashboardPage({ params }: Props) {
  const { entityId } = await params
  redirect(`/dashboard/pages/${entityId}/edit`)
}
