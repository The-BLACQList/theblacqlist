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
  duo: [Photo, Photo]
  interludes: [Photo, Photo, Photo]
  menuPhoto: Photo
  offersLede: string
  booking: { title: string; facts: string[]; action: string }
  findLede: string
  map: { land: string; block: string; road: string; park: string; minor: string }
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
