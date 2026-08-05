/**
 * Instagram + Messenger DM helpers via the Page's conversations edge.
 * Reads require instagram_manage_messages / pages_messaging. Sending is a
 * write action — call only after GATE-PUBLISH.
 */
import type { MetaClient } from './client'
import type { Conversation, DirectMessage, MetaList } from './types'

/** DM conversation threads for the Page. platform 'instagram' for IG DMs, 'messenger' for FB. */
export async function getConversations(
  client: MetaClient,
  platform: 'instagram' | 'messenger',
  limit = 25
): Promise<Conversation[]> {
  const res = await client.get<MetaList<Conversation>>(`${client.env.pageId}/conversations`, {
    platform,
    fields: 'id,updated_time',
    limit,
  })
  return res.data
}

/** First page of messages in a conversation. */
export async function getMessages(
  client: MetaClient,
  conversationId: string,
  limit = 25
): Promise<DirectMessage[]> {
  const res = await client.get<MetaList<DirectMessage>>(`${conversationId}/messages`, {
    fields: 'id,message,from,created_time',
    limit,
  })
  return res.data
}

/** Send a DM reply. Write — GATE-PUBLISH. */
export async function sendMessage(
  client: MetaClient,
  recipientId: string,
  text: string
): Promise<{ message_id?: string }> {
  return client.post<{ message_id?: string }>(`${client.env.pageId}/messages`, {
    recipient: JSON.stringify({ id: recipientId }),
    message: JSON.stringify({ text }),
    messaging_type: 'RESPONSE',
  })
}
