/**
 * Publish photos to Instagram + the Facebook Page.
 * IG requires instagram_content_publish; FB requires pages_manage_posts.
 * Both are write actions — call only after GATE-PUBLISH.
 */
import type { MetaClient } from './client'
import type { PublishResult } from './types'

/**
 * Publish a single photo to the IG Business account.
 * Two-step: create a media container, then publish it.
 */
export async function publishInstagramPhoto(
  client: MetaClient,
  imageUrl: string,
  caption: string
): Promise<PublishResult> {
  const container = await client.post<{ id: string }>(`${client.env.igBusinessId}/media`, {
    image_url: imageUrl,
    caption,
  })
  return client.post<PublishResult>(`${client.env.igBusinessId}/media_publish`, {
    creation_id: container.id,
  })
}

/** Publish a photo post to the Facebook Page. */
export async function publishFacebookPhoto(
  client: MetaClient,
  imageUrl: string,
  message: string
): Promise<PublishResult> {
  return client.post<PublishResult>(`${client.env.pageId}/photos`, {
    url: imageUrl,
    caption: message,
  })
}
