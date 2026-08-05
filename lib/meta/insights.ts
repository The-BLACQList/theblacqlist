/**
 * Instagram + Facebook Page insights (reach, impressions, engagement, followers).
 * Requires pages_read_engagement / instagram_manage_insights. Read-only.
 */
import type { MetaClient } from './client'
import type { InsightValue, MetaList } from './types'

type InsightPeriod = 'day' | 'week' | 'days_28'

export async function getInstagramInsights(
  client: MetaClient,
  metrics: string[] = ['reach', 'impressions', 'profile_views', 'follower_count'],
  period: InsightPeriod = 'week'
): Promise<InsightValue[]> {
  const res = await client.get<MetaList<InsightValue>>(`${client.env.igBusinessId}/insights`, {
    metric: metrics.join(','),
    period,
  })
  return res.data
}

export async function getFacebookPageInsights(
  client: MetaClient,
  metrics: string[] = ['page_impressions', 'page_post_engagements', 'page_fans'],
  period: InsightPeriod = 'week'
): Promise<InsightValue[]> {
  const res = await client.get<MetaList<InsightValue>>(`${client.env.pageId}/insights`, {
    metric: metrics.join(','),
    period,
  })
  return res.data
}
