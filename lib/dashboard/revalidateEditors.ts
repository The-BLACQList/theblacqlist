import { revalidatePath } from 'next/cache'

/**
 * Refresh both places an owner edits a page: the dashboard editor and the
 * /add-business finish view (ticket 129). A save on a draft revalidates no
 * public URL, so without this the finish view's meter and preview would not
 * move until a reload.
 */
export function revalidateOwnerEditors(listingId: string): void {
  revalidatePath(`/dashboard/pages/${listingId}/edit`)
  revalidatePath(`/add-business/finish/${listingId}`)
}
