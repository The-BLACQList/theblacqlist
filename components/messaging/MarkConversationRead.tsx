'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { markConversationReadAction } from '@/lib/actions/messaging/markConversationRead'

/**
 * Marks an unread thread read once it has been shown, then refreshes so the
 * nav badges (rendered by the layouts, in parallel with the page) drop.
 * Rendered only when the thread is unread, so a read thread costs nothing.
 */
export function MarkConversationRead({ conversationId }: { conversationId: string }) {
  const router = useRouter()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    void markConversationReadAction(conversationId).then((result) => {
      if ('success' in result) router.refresh()
    })
  }, [conversationId, router])

  return null
}
