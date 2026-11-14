/**
 * The help the owner Cue reads from (ticket 203). Written by us, not the
 * model: get_help returns one of these, and the prompt tells Cue to answer
 * how-to questions from them and nothing else.
 *
 * Plans come from lib/stripe/plans.ts, the same list /pricing shows, and only
 * plans on sale are described as something you can buy. When a feature or a
 * limit changes, change it here too; tests/owner-cue.test.ts checks the plan
 * text follows plans.ts.
 */

import { RATE_LIMIT_PER_LISTING_24H } from '@/lib/ai/provider'
import { aiQuota, photoLimit } from '@/lib/stripe/features'
import { PLANS, type PlanSlug } from '@/lib/stripe/plans'

export const OWNER_HELP_TOPICS = [
  'plans',
  'edit_page',
  'photos',
  'buttons',
  'messages',
  'happening_now',
  'deals',
  'order_on',
  'google',
  'verification',
  'analytics',
  'writing_help',
  'import_site',
] as const

export type OwnerHelpTopic = (typeof OWNER_HELP_TOPICS)[number]

function count(n: number | null, noun: string): string {
  return n === null ? `unlimited ${noun}s` : `${n} ${noun}${n === 1 ? '' : 's'}`
}

function plansText(openTiers: ReadonlySet<PlanSlug>): string {
  const lines = PLANS.map((p) => {
    if (p.slug === 'free') return `Free ($0): ${p.features.join('; ')}.`
    if (!openTiers.has(p.slug)) return `${p.name}: not on sale yet.`
    return `${p.name} ($${p.price_monthly} a month, or $${p.price_yearly} a year): ${p.features.join('; ')}.`
  })
  return [
    ...lines,
    'Change plans on Upgrade in the dashboard sidebar. Every plan is the same price for every business.',
  ].join('\n')
}

const STATIC: Record<Exclude<OwnerHelpTopic, 'plans'>, string> = {
  edit_page: [
    'Edit content (under This page in the sidebar) has tabs: Basics, Contact & buttons, Photos & video, Services, Where to find us, Social & links, and More.',
    'Page strength at the top lists what is missing; click an item to jump straight to it.',
    'Each card saves on its own, or use the save bar at the bottom. The preview beside the form shows changes as you type.',
  ].join(' '),
  photos: [
    `Photos are on the Photos & video tab. Free pages get ${count(photoLimit('free'), 'photo')}, Starter ${count(photoLimit('starter'), 'photo')}, Growth ${count(photoLimit('growth'), 'photo')}, Premium ${count(photoLimit('premium'), 'photo')}.`,
    'Set one as your cover; it is the first thing people see. Starter and up can add a video, an upload or a link.',
  ].join(' '),
  buttons: [
    'Your main button is on the Contact & buttons tab. Pick what it does: call, website, book, order, Message us (your inbox) or Email us.',
    'Extra buttons sit next to it: none on Free, 1 on Starter, 2 on Growth, 3 on Premium.',
    'If your inbox is off, a Message us button shows "Not accepting messages", so turn the inbox on or pick another button.',
  ].join(' '),
  messages: [
    'Messages in the sidebar is one inbox for every page you own, with tabs for customers and other businesses (and job applicants or event guests when you have postings).',
    "Turn each page's inbox on or off in Inbox settings, where you also manage blocked people and saved replies.",
    'When you message another business you can send as one of your pages.',
  ].join(' '),
  happening_now: [
    'A Happening now post is a short banner at the top of your page and in the Happening now strip on your city and category pages: a headline, one line, an optional photo and button, and an end date up to 30 days away.',
    'Starter has 1 post at a time, Growth 3, Premium 5. Free pages do not have posts.',
    'Write one on the Basics tab, or manage them all under Happening now in the sidebar.',
  ].join(' '),
  deals: [
    'Deals are a Premium feature: a title, what you get, an optional code and terms, shown in a Deals section on your page with a Copy code button.',
    'You honour the code yourself; there is no checkout. Add them on the Services tab.',
  ].join(' '),
  order_on: [
    'Order on adds buttons for DoorDash, Grubhub, Instacart and Uber Eats. Paste your store link for each on the Services tab.',
    'Find us at lists the stores that carry your products: pick a chain or type a store name, then add the cities or zip codes, or mark it nationwide. Up to 25 stores. It is on the Where to find us tab, with your location type and service area.',
  ].join(' '),
  google: [
    'Your search title and search description are what Google can show for your page. They are on the More tab, in the Google card.',
    'Keep the title under 60 characters and the description under 160, and say what you offer and where. Writing help can draft both.',
  ].join(' '),
  verification: [
    'Get Verified (under This page in the sidebar) walks you through showing the page is yours. It is free on every plan.',
    'Verified pages show a badge.',
  ].join(' '),
  analytics: [
    'Analytics (under This page) shows your views, saves and taps over the last 30 days. It comes with Starter and up.',
    'More photos, hours, a main button and a full About usually bring more views and taps.',
  ].join(' '),
  writing_help: [
    `Writing help drafts your About, search title and search description from what is on your page. It comes with Starter (${count(aiQuota('starter'), 'draft')} every 30 days), Growth (${count(aiQuota('growth'), 'draft')}) and Premium (${count(aiQuota('premium'), 'draft')}), up to ${RATE_LIMIT_PER_LISTING_24H} a day per page.`,
    'A draft never goes on your page by itself: you read it, then choose Use this, or set it aside. The more your page says (services, details, a line about what you do), the better the draft.',
  ].join(' '),
  import_site: [
    'Import from my website, at the top of Edit content, reads your site and shows what it found next to what your page has now: name, About, phone, email, address, hours, social links and photos.',
    'Tick what you want and save. Nothing is ticked by default where your page already has a value.',
  ].join(' '),
}

/** The help for one topic. Null for an unknown topic. */
export function ownerHelp(topic: string, openTiers: ReadonlySet<PlanSlug>): string | null {
  if (topic === 'plans') return plansText(openTiers)
  return (STATIC as Record<string, string>)[topic] ?? null
}
