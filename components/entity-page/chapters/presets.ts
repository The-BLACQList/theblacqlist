import type { ChapterPreset, Photo } from './model'
import { asset } from '@/lib/example/fixtures/shared'

/**
 * Per-layout choices the listing data does not carry yet (ticket 204): the
 * chapter list, the interlude and duo photos, the booking facts and the
 * ledes. Taken from Creative's approved prototype v7 (DR-008). The sample
 * pages read them from here; a live listing would get them from the owner's
 * settings once the layout ships beyond /example.
 */

export interface StorefrontPreset extends ChapterPreset {
  /** Live pages fill these from the listing's own gallery and leave out what runs short. */
  duo: Photo[]
  interludes: [Photo | null, Photo | null, Photo | null]
  menuPhoto: Photo | null
  offersLede: string
  booking: { title: string; facts: string[]; action: string }
  findLede: string
  map: { land: string; block: string; road: string; park: string; minor: string }
}

/**
 * Photos the Storefront page already shows outside the gallery, as
 * `photoKey`s: the cover, the duo, the interludes and, when a menu shows, the
 * menu photo. The gallery leaves these out so no photo appears twice on a
 * page (Creative F11, ticket 233).
 */
/**
 * One key per stored photo, however its address is written. A cover is kept
 * as a bare storage path ("abc/cover.webp") or, on older listings, a full
 * URL; gallery photos are full public URLs. Both end in the same
 * `listing-media/` path, so that is the key.
 */
export function photoKey(src: string): string {
  const at = src.indexOf('/listing-media/')
  if (at >= 0) return src.slice(at + '/listing-media/'.length).split('?')[0]!
  return src.split('?')[0]!.replace(/^\/+/, '')
}

export function storefrontPlacedSrcs(
  preset: Pick<StorefrontPreset, 'duo' | 'interludes' | 'menuPhoto'>,
  coverSrc: string | null | undefined,
  menuShown: boolean
): Set<string> {
  const placed = [
    coverSrc ?? null,
    ...preset.duo.map((p) => p.src),
    ...preset.interludes.map((p) => p?.src ?? null),
    menuShown ? (preset.menuPhoto?.src ?? null) : null,
  ]
  return new Set(placed.filter((x): x is string => Boolean(x)).map(photoKey))
}

const photo = (file: string, alt: string): Photo => ({ src: asset(`${file}.webp`), alt })

export const STOREFRONT_PRESET: StorefrontPreset = {
  chapters: [
    { id: 'welcome', nav: 'Welcome', title: 'Welcome' },
    { id: 'visit', nav: 'Visit', title: 'Hours and Location' },
    { id: 'menu', nav: 'Menu', title: 'The Menu' },
    { id: 'shop', nav: 'Shop', title: 'Shop' },
    { id: 'gallery', nav: 'Gallery', title: 'Gallery' },
    { id: 'reviews', nav: 'Reviews', title: 'Reviews' },
    { id: 'more', nav: 'More', title: 'More' },
  ],
  aspect: { 'cafe-brunch': '3/4', 'cafe-pour-over': '2/3', 'cafe-window-seat': '2/3' },
  glance: ['Est. 2014', 'Takes Reservations', 'Dogs Welcome on the Patio'],
  neighbourhood: 'Old Fourth Ward, Atlanta',
  cta: 'Order Online',
  coverAlt: 'The café’s main room and pastry counter',
  // F09: the pull quote comes from a review outside the carousel's first view,
  // so the band never shows the same words twice at once.
  pull: {
    reviewId: 'cafe-review-4',
    sentence:
      'Coffee service was seamless, the pastries disappeared in minutes, and the room was quiet enough for a working session.',
  },
  duo: [
    photo('cafe-window-seat', 'The window seat, the best spot in the house'),
    photo('cafe-pastries', 'Thursday’s pastry case: croissants, scones and sweet potato hand pies'),
  ],
  interludes: [
    photo('cafe-counter', 'The espresso bar and pastry case'),
    photo('cafe-interior', 'The main room at opening time'),
    // Not the window seat again: it already opens the page in the Welcome duo.
    photo('cafe-patio', 'The side patio on a spring afternoon'),
  ],
  menuPhoto: photo('cafe-brunch', 'Shrimp and grits from the weekend brunch menu'),
  offersLede: 'Save on your next visit, and on beans ordered online.',
  booking: {
    title: 'Group Bookings and Private Events',
    facts: [
      'Back room seats 24',
      'Buyouts from $350',
      'Coffee service and pastries included',
      'Walk-ins for tables of up to six',
    ],
    action: 'Request a Booking',
  },
  findLede:
    'Visit another location, find us in local shops, order for delivery, or join an upcoming event.',
  map: { land: '#ebe4d8', block: '#f4efe6', road: '#fffdf8', park: '#d8dcc3', minor: '#f9f5ee' },
}

export interface ProfessionalPreset extends ChapterPreset {
  /** The hero's numbers strip. The founding year comes from the listing itself. */
  nums: { value: number; suffix?: string; label: string }[]
  foundedLabel: string
  welcomePhoto: Photo
  interludes: [Photo, Photo, Photo]
  offersLede: string
  booking: { title: string; facts: string[] }
  findTitle: string
  findLede: string
  gettingHere: { title: string; note: string }[]
  map: { land: string; block: string; road: string; park: string; minor: string }
}

export const PROFESSIONAL_PRESET: ProfessionalPreset = {
  chapters: [
    { id: 'welcome', nav: 'Welcome', title: 'Welcome' },
    { id: 'services', nav: 'Services', title: 'Services' },
    { id: 'how', nav: 'How We Work', title: 'How We Work' },
    { id: 'visit', nav: 'Visit', title: 'Office and Hours' },
    { id: 'shop', nav: 'Shop', title: 'Shop' },
    { id: 'reviews', nav: 'Reviews', title: 'Reviews' },
    { id: 'more', nav: 'More', title: 'More' },
  ],
  aspect: {},
  // F10: no "Est. 2016" here; the founding year is in the hero's numbers.
  glance: ['In Person and Remote', 'Serves the Southeast'],
  neighbourhood: 'Midtown, Atlanta',
  cta: 'Book a Discovery Call',
  coverAlt: 'A corner office with floor-to-ceiling windows over the city',
  // F10: the rating is in the facts row, so the strip leaves it out.
  nums: [
    { value: 120, suffix: '+', label: 'Companies Advised' },
    { value: 8, label: 'Clients at a Time' },
  ],
  foundedLabel: 'Founded in Midtown Atlanta',
  // No pull quote (F09): Why People Come already quotes every review once.
  why: [
    {
      title: 'Decisions, Not Slides',
      text: 'A two-week diagnostic, then a ninety-day plan, with the dashboards, templates and meeting rhythm that keep it running after we leave.',
      reviewId: 'pro-review-2',
      sentence:
        'This one came with the Monday meeting, the scorecard and the dashboard, and six months later we are still using all three.',
    },
    {
      title: 'Straight Answers About the Numbers',
      text: 'Interviews with the owner and the team, a read of the numbers and a written report, with a fixed price for the next step.',
      reviewId: 'pro-review-3',
      sentence:
        'The diagnostic told us things we did not want to hear about our sales process, which is exactly what we paid for.',
    },
    {
      title: 'Eight Clients at a Time',
      text: 'We cap the roster so every client gets a partner’s time. It is why there is sometimes a wait.',
      reviewId: 'pro-review-4',
      sentence: 'Two days a week, but the operating rhythm they set up carried the other three.',
    },
    {
      title: 'Built for Founder-Led Companies',
      text: 'Five to fifty people, a product customers already pay for, and an owner who wants a plan the team can run without us.',
      reviewId: 'pro-review-1',
      sentence: 'Revenue is up and churn did not move.',
    },
  ],
  welcomePhoto: photo('pro-coffee-meeting', 'Coffee and the first draft of a plan'),
  interludes: [
    photo('pro-office', 'The open-plan office in Midtown'),
    photo('pro-skyline', 'The view from the office'),
    photo('pro-meeting', 'The main meeting room'),
  ],
  offersLede: 'For BLACQList members and companies new to the firm.',
  booking: {
    title: 'Start with a Discovery Call',
    facts: ['Thirty minutes with a partner', 'No pitch', 'Reply within one business day'],
  },
  findTitle: 'Other Offices and Events',
  findLede: 'Our other offices, where else to find us, free events, and how to get here.',
  gettingHere: [
    { title: 'Free Parking', note: 'Appointment required' },
    { title: 'Elevator Access', note: 'Wheelchair-accessible office' },
  ],
  map: { land: '#dedfe6', block: '#e9eaf0', road: '#ffffff', park: '#d2dacb', minor: '#f3f3f7' },
}

export interface CreativePreset extends ChapterPreset {
  welcomePhoto: Photo
  interludes: [Photo, Photo, Photo]
  /** Albums that count as work for Selected Work; studio photos stay out of it. */
  workAlbums: string[]
  booking: { title: string; facts: string[] }
  shopNoun: string
  findTitle: string
  findLede: string
  openStudio: { title: string; note: string }[]
  map: { land: string; block: string; road: string; park: string; minor: string }
}

export const CREATIVE_PRESET: CreativePreset = {
  chapters: [
    { id: 'welcome', nav: 'Welcome', title: 'Welcome' },
    { id: 'work', nav: 'Work', title: 'Selected Work' },
    { id: 'commissions', nav: 'Commissions', title: 'Commissions' },
    { id: 'shop', nav: 'Shop', title: 'Print Shop' },
    { id: 'visit', nav: 'Visit', title: 'Studio and Hours' },
    { id: 'reviews', nav: 'Reviews', title: 'Reviews' },
    { id: 'more', nav: 'More', title: 'More' },
  ],
  aspect: {
    'studio-branding': '16/9',
    'studio-packaging': '4/3',
    'studio-print': '2/3',
    'studio-sketch': '4/3',
  },
  glance: ['Est. 2018', 'Ships Nationwide', 'Open Studio First Saturdays'],
  neighbourhood: 'Castleberry Hill, Atlanta',
  cta: 'Start a Commission',
  coverAlt: 'The studio, with a chalk-drawn wall above the desks',
  // F09: from the last review, so it never sits beside the same words in the
  // carousel's first view.
  pull: {
    reviewId: 'studio-review-4',
    sentence: 'Brought a sketch, left with forty two-colour prints and a new hobby.',
  },
  welcomePhoto: photo('studio-desk', 'A designer’s desk mid-project'),
  // Studio photos, so Selected Work keeps to the work.
  interludes: [
    photo('studio-sketch', 'Logo sketches from the first week of an identity project'),
    photo('studio-space', 'The studio floor on a first-Saturday open day'),
    photo('studio-gallery-wall', 'The print wall, where every edition hangs before it ships'),
  ],
  workAlbums: ['Identity', 'Murals', 'Print'],
  booking: {
    title: 'Commission the Studio',
    facts: [
      'Reply within two business days',
      'A fixed-price proposal after the call',
      'A fifty per cent deposit books the start date',
    ],
  },
  shopNoun: 'Prints',
  findTitle: 'Where Else to Find Us',
  findLede:
    'Visit the gallery or the market pop-up, find the prints in shops, or come to an open studio.',
  openStudio: [
    { title: 'First Saturday of Every Month', note: '11 am – 4 pm, no appointment needed' },
    { title: 'Other Days', note: 'By appointment' },
  ],
  map: { land: '#e4e2de', block: '#efeeeb', road: '#ffffff', park: '#d5d6cc', minor: '#f7f6f3' },
}
