/**
 * Minimal response shapes for the Meta Graph API endpoints the ops bundle uses.
 * Only the fields we consume are typed; Meta returns more.
 */

export interface MetaPaging {
  cursors?: { before?: string; after?: string }
  next?: string
  previous?: string
}

export interface MetaList<T> {
  data: T[]
  paging?: MetaPaging
}

export interface IgMedia {
  id: string
  caption?: string
  permalink?: string
  timestamp?: string
  media_type?: string
}

export interface IgComment {
  id: string
  text?: string
  username?: string
  timestamp?: string
  like_count?: number
}

export interface IgTag {
  id: string
  caption?: string
  username?: string
  permalink?: string
  timestamp?: string
}

export interface FbComment {
  id: string
  message?: string
  from?: { id: string; name?: string }
  created_time?: string
}

export interface Conversation {
  id: string
  updated_time?: string
}

export interface DirectMessage {
  id: string
  message?: string
  from?: { id: string; username?: string; name?: string }
  created_time?: string
}

export interface InsightValue {
  name: string
  period?: string
  values?: Array<{ value: number | Record<string, number>; end_time?: string }>
}

export interface PublishResult {
  id: string
}
