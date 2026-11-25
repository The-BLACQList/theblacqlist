// The site tour's words (ticket 280). Written by Author, signed by Marketing,
// picked by the founder 2026-11-24. Change nothing here without all three: the
// deck is the source, this is a copy of it.
//
// Rules the words follow: Title Case for titles and buttons, always "The
// BLACQList", and Cue is never named in the owner path.

export type SiteTourStepCopy = { title: string; body: string; note?: string }

export const SITE_TOUR_OPENING = 'Welcome to The BLACQList'
export const SITE_TOUR_QUESTION = 'Do you own a Black-owned business?'
export const SITE_TOUR_ANSWERS = {
  owner: 'Yes, I Own One',
  shopper: 'No, I’m Here to Find One',
  notNow: 'Not Now',
} as const

export const SITE_TOUR_BUTTONS = {
  next: 'Next',
  back: 'Back',
  end: 'End Tour',
  example: 'Try an Example',
  take: 'Take the Tour',
} as const

/** The ask Try an Example sends (one real Cue call). Release check: a real answer on prod. */
export const SITE_TOUR_EXAMPLE_ASK = 'Help me plan a party in Detroit'

const SAMPLE_NOTE = 'The business on these pages is made up, and so are its reviews and numbers.'

export const SITE_TOUR_CHAPTERS = {
  'shopper-1': { eyebrow: '1 · Find', title: 'Start with a Search' },
  'shopper-2': { eyebrow: '2 · Look Closer', title: 'Get to Know a Business' },
  'shopper-3': { eyebrow: '3 · Go Deeper', title: 'Beyond the Search' },
  'owner-1': { eyebrow: '1 · Find', title: 'Your Page May Already Be Here' },
  'owner-2': { eyebrow: '2 · Show Off', title: 'Make It Yours' },
  'owner-3': { eyebrow: '3 · Keep It Current', title: 'Keep It Current' },
} as const
export type SiteTourChapterKey = keyof typeof SITE_TOUR_CHAPTERS

export const SITE_TOUR_COPY = {
  cue: {
    title: 'Ask Cue',
    body: 'This is Cue. Ask for what you need in your own words, or tap Try an Example to see how it works.',
  },
  answer: {
    title: 'Cue’s Answer',
    body: 'Here’s what Cue found. Open a business to see its Page, or ask Cue a follow-up to narrow it down.',
  },
  map: {
    title: 'Explore the Map',
    body: 'This is the map. You can use it to see who’s listed in an area. Zoom in, and the list follows along.',
  },
  'sample-page': {
    title: 'See a Page Filled In',
    body: 'Here’s a sample Page. When an owner claims theirs, it shows who’s behind the business.',
    note: SAMPLE_NOTE,
  },
  save: {
    title: 'Save It for Next Time',
    body: 'Found one you like? Save it and it’ll be here next time. Saving needs a free account.',
    note: SAMPLE_NOTE,
  },
  blacqlight: {
    title: 'Read The BLACQLight',
    body: 'The BLACQLight is where we share stories about the people behind the businesses.',
  },
  collective: {
    title: 'The Collective · Beta',
    body: 'This is The Collective. It shows where members report buying from businesses on The BLACQList.',
  },
  'owner-search': {
    title: 'Search Your Business Name',
    body: 'Let’s start with your business. Search its name, and if it’s already here, you can claim your Page.',
  },
  'owner-sample': {
    title: 'See a Page Filled In',
    body: 'This is a sample Page, filled in. Some of what you see here needs a paid plan.',
    note: SAMPLE_NOTE,
  },
  'owner-add': {
    title: 'Add Your Business',
    body: 'Not listed yet? You can add your business free. We’ll ask you to sign in first.',
  },
  'owner-collective': {
    title: 'The Collective · Beta',
    body: 'This is The Collective.',
  },
  'owner-free': {
    title: 'Start Free',
    body: 'Claiming your Page is free, and so is keeping it. Starter is a paid plan.',
  },
} as const satisfies Record<string, SiteTourStepCopy>
export type SiteTourStepKey = keyof typeof SITE_TOUR_COPY

/** While Cue answers. The counter stays on step 1. */
export const SITE_TOUR_WAIT: SiteTourStepCopy = {
  title: 'Cue Is Looking',
  body: 'Cue is looking through The BLACQList for you. Your answer appears just under the bar.',
}

/** The Collective's words follow the Demo / Live switch. */
export function collectiveBody(path: 'shopper' | 'owner', live: boolean): string {
  if (path === 'shopper') {
    return `${SITE_TOUR_COPY.collective.body} ${
      live ? 'Each line is one reported purchase.' : 'What you see now is sample data.'
    }`
  }
  return live
    ? 'This is The Collective. Once your Page is published, your business has a spot here. When a member reports buying from a business you’ve claimed, you can confirm it.'
    : 'This is The Collective. Once your Page is published, your business has a spot in the Live view. When a member reports buying from a business you’ve claimed, you can confirm it. What you see now is sample data.'
}

export const SITE_TOUR_END = {
  shopper: {
    title: 'Welcome to The BLACQList',
    body: 'That’s the tour. Start with a search, or create a free account to save what you find.',
    go: { label: 'Create Your Free Account', href: '/sign-up', cta: 'create_account' },
    other: { label: 'Start Exploring', href: null, cta: 'start_exploring' },
  },
  owner: {
    title: 'Ready When You Are',
    body: 'Search your business name first. If it isn’t listed, add it.',
    go: { label: 'Claim Your Page', href: '/claim', cta: 'claim' },
    other: { label: 'Add Your Business', href: '/add-business', cta: 'add_business' },
  },
} as const

export const SITE_TOUR_QUIT_NOTE = {
  signedIn:
    'You can take the tour again from My Account for 30 days after your first visit.',
  signedOut:
    'You can take the tour again from the link at the bottom of the page on this device for 30 days after your first visit.',
} as const

export const SITE_TOUR_ESC_HINT = 'Press Esc again to end the tour.'
