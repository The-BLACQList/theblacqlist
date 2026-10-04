// =============================================================================
// Launch-list email copy: W0, W1 and E1 to E4
// =============================================================================
// VERBATIM from the marketing OS drafts. Do not edit wording here; change the
// source draft, have it re-approved, then copy it across.
//
//   W0  10_lifecycle/sequences/pre-launch-waitlist/emails/w0-youre-on-the-list.md
//   W1  10_lifecycle/sequences/pre-launch-waitlist/emails/w1-first-look.md
//   E1  10_lifecycle/sequences/public-launch-d0-d14/emails/e1-the-blacqlist-is-live.md
//   E2  .../e2-your-page-may-already-be-here.md
//   E3  .../e3-save-what-you-find.md
//   E4  .../e4-two-weeks-of-the-blacqlist.md
//
// Every draft is `prepared_awaiting_approval` (send_email gate). Nothing in
// this file sends anything. W0 is the only one wired to code, in
// lib/email/sendLaunchConfirmation.ts, behind LAUNCH_CONFIRMATION_EMAIL_ENABLED
// (default off). W1 and E1 to E4 are broadcasts the founder sends from Resend;
// `pnpm email:export` renders them to static HTML for that.
//
// Straight apostrophes are kept as written in the drafts.
// =============================================================================

export type LaunchEmailId = 'w0' | 'w1' | 'e1' | 'e2' | 'e3' | 'e4'

export interface LaunchEmailLink {
  label: string
  href: string
}

/** A body block: a plain paragraph, or the W1 ready-to-paste quote. */
export type LaunchEmailBlock = { kind: 'p'; text: string } | { kind: 'quote'; text: string }

export interface LaunchEmailCopy {
  id: LaunchEmailId
  /** Option 1 is the default subject; option 2 is the alternative in the draft. */
  subjects: readonly [string, string]
  preheader: string
  greeting: string
  body: readonly LaunchEmailBlock[]
  cta: LaunchEmailLink
  /** Present only where the draft signs the email. */
  signature?: { name: string; title: string }
  /** P.S. text before the link, the link itself, and the closing punctuation. */
  ps?: { lead: string; url: string; tail: string }
}

const p = (text: string): LaunchEmailBlock => ({ kind: 'p', text })

const FOUNDER_SIGNATURE = { name: 'Chalece', title: 'Founder, The BLACQList' } as const

/** The W1 opening line, chosen by the founder before sending (draft section "Opening line"). */
export const W1_OPENING_LINES = {
  /** If W0 went out (the automatic confirmation is on). */
  A: 'Thank you for joining the list early.',
  /** If W0 was skipped. */
  B: "You're on the list, and thank you for joining early.",
} as const
export type W1Opening = keyof typeof W1_OPENING_LINES

const W1_SHARE_URL =
  'https://theblacqlist.com/?utm_source=resend&utm_medium=email&utm_campaign=pre-launch&utm_content=w1-share'

export const W0_COPY: LaunchEmailCopy = {
  id: 'w0',
  subjects: ["You're on the list", 'Thanks for joining The BLACQList launch list'],
  preheader: "We'll email you when we open. Until then, follow along on Instagram.",
  greeting: 'Hi,',
  body: [
    p("You're on the list for The BLACQList. Thank you for joining."),
    p(
      "BLACQList is where you'll find Black-owned businesses across six cities, and the Ally businesses beside them, all in one place."
    ),
    p('We will email you when we open. Before then, you may get one short first look at what is coming.'),
    p('Until then, the best place to watch it come together is our Instagram.'),
  ],
  cta: { label: 'Follow @theblacqlist', href: 'https://www.instagram.com/theblacqlist/' },
  signature: FOUNDER_SIGNATURE,
}

export function w1Copy(opening: W1Opening): LaunchEmailCopy {
  return {
    id: 'w1',
    subjects: ['A first look at The BLACQList', "What you'll find when we open"],
    preheader:
      'Black-owned businesses, the Ally businesses beside them, six cities, and one small favor.',
    greeting: 'Hi,',
    body: [
      p(W1_OPENING_LINES[opening]),
      p('Here is a first look at what you will be able to do when The BLACQList opens.'),
      p(
        'Find Black-owned businesses, and the Ally businesses listed beside them, in Atlanta, Chicago, Houston, Los Angeles, New Orleans and Washington DC. Hundreds of businesses across those six cities already have a Page.'
      ),
      p('Save the places you love with a free account, so they are there when you need them.'),
      p('Read reviews, and leave your own.'),
      p(
        'And we plan to share a new city collection every week, so you always have somewhere to start.'
      ),
      p(
        "If you run a business in these cities, your Page may already be waiting. If it isn't, you can create one. Claiming or creating a Page will be free from the day we open."
      ),
      p(
        'Now the favor. Do you know a business owner who should be here? Send them the link below so they can join the list and hear when they can claim their Page. Please share the link rather than forwarding this email: this email carries your own unsubscribe link, and we would hate for someone else to click it for you.'
      ),
      p('Ready to paste:'),
      {
        kind: 'quote',
        text: `The BLACQList is coming: Black-Owned Anything, plus the Ally businesses beside them, in six cities. Get on the list to hear when it opens: ${W1_SHARE_URL}`,
      },
      p('We will email you when we open.'),
    ],
    cta: { label: 'Share The BLACQList with a business owner you love', href: W1_SHARE_URL },
    signature: FOUNDER_SIGNATURE,
  }
}

export const E1_COPY: LaunchEmailCopy = {
  id: 'e1',
  subjects: ['The BLACQList is open', 'Find & Be Found starts today'],
  preheader: 'Six cities, hundreds of Black-owned and ally businesses, and one place to start.',
  greeting: 'Hi,',
  body: [
    p('You asked us to tell you when The BLACQList opened. Today it is open to everyone.'),
    // OPEN COPY ITEM (handoff doc): the closing parenthetical reads like an
    // internal source note. Kept verbatim because the copy rule forbids edits
    // here; the marketing OS decides whether it stays before E1 is approved.
    p(
      'BLACQList is a national place to find Black-owned businesses and the allies who list beside them. We are starting in six cities: Atlanta, Chicago, Houston, Los Angeles, New Orleans and Washington DC. More than 370 businesses were on the map before launch (source: decision log, measured 4 Sep 2026).'
    ),
    p(
      'If you are not sure where to begin, start with our first collection, Where to Shop Black in Atlanta. Then search your own city and see who is already here.'
    ),
    p('When you find a place you love, save it so you can come back to it.'),
    p('Thank you for waiting with us.'),
  ],
  cta: {
    label: 'Explore your city',
    href: 'https://theblacqlist.com/discover?utm_source=resend&utm_medium=email&utm_campaign=public-launch&utm_content=e1',
  },
  signature: FOUNDER_SIGNATURE,
  ps: {
    lead: 'If you run a business in one of these six cities, your Page may already be here. Claiming it is free at ',
    url: 'https://theblacqlist.com/claim?utm_source=resend&utm_medium=email&utm_campaign=public-launch&utm_content=e1-ps',
    tail: '.',
  },
}

export const E2_COPY: LaunchEmailCopy = {
  id: 'e2',
  subjects: ['Your business may already be on The BLACQList', 'You deserve a better page'],
  preheader: 'If you run a business, check whether your Page is already waiting for you.',
  greeting: 'Hi,',
  body: [
    p('This one is for anyone on our list who runs a business.'),
    p(
      'Before The BLACQList opened, we added businesses in Atlanta, Chicago, Houston, Los Angeles, New Orleans and Washington DC so supporters would have places to find on day one. Yours may be one of them.'
    ),
    p(
      "Claiming your Page is free. New Pages choose their label, Black-Owned or Ally. If the label on your Page is wrong, tell us and we'll correct it. Our team reviews each claim to make sure the right person gets the Page."
    ),
    p('If your business is not there yet, you can add it for free.'),
    p('Search for your business name and claim it today.'),
  ],
  cta: {
    label: 'Claim your Page',
    href: 'https://theblacqlist.com/claim?utm_source=resend&utm_medium=email&utm_campaign=public-launch&utm_content=e2',
  },
  ps: {
    lead: 'Not there yet? Add your business at ',
    url: 'https://theblacqlist.com/add-business?utm_source=resend&utm_medium=email&utm_campaign=public-launch&utm_content=e2-ps',
    tail: '.',
  },
}

export const E3_COPY: LaunchEmailCopy = {
  id: 'e3',
  subjects: [
    'Black-owned coffee in Houston, and a place to keep your favorites',
    'Keep a list of the places you want to support',
  ],
  preheader: 'Our second collection is up. Make a free account to save what you find.',
  greeting: 'Hi,',
  body: [
    p(
      'The BLACQList has been open for a week, and our second collection is up today: Black-Owned Coffee in Houston.'
    ),
    p(
      'Collections are how we help you start. Every Tuesday we publish one, and each one points you to real places you can visit this week.'
    ),
    p(
      'When something catches your eye, save it. A free BLACQList account keeps your saved places in one list, so the next time someone asks where to get coffee or a haircut, you already know.'
    ),
    p('It takes a minute to create your account.'),
  ],
  cta: {
    label: 'Create your free account',
    href: 'https://theblacqlist.com/sign-up?utm_source=resend&utm_medium=email&utm_campaign=public-launch&utm_content=e3',
  },
  ps: {
    lead: 'Want to see the collection first? Explore your city at ',
    url: 'https://theblacqlist.com/discover?utm_source=resend&utm_medium=email&utm_campaign=public-launch&utm_content=e3-ps',
    tail: '.',
  },
}

export const E4_COPY: LaunchEmailCopy = {
  id: 'e4',
  subjects: ['Two weeks of The BLACQList', 'Thank you, and one thing for business owners'],
  preheader:
    'Thank you for being here at the start. If you run a business, your Page is still waiting.',
  greeting: 'Hi,',
  body: [
    p(
      'The BLACQList has been open for two weeks. Thank you for being one of the first people here.'
    ),
    p(
      "In that time three collections have gone up on the site, from shopping in Atlanta to coffee in Houston to today's pick, Chicago's Best Hair Salons. We will keep adding one every Tuesday."
    ),
    p(
      'If you run a business, this is a good moment to claim your Page. Supporters are already searching these six cities, and a claimed Page lets you show up the way you want to. Claiming is free and takes a few minutes.'
    ),
    p(
      'If you are here to support, keep exploring and keep saving. Every save helps the next person find a place worth visiting.'
    ),
  ],
  cta: {
    label: 'Claim your Page',
    href: 'https://theblacqlist.com/claim?utm_source=resend&utm_medium=email&utm_campaign=public-launch&utm_content=e4',
  },
  ps: {
    lead: 'If you have already claimed your Page and want more from it, see what Starter adds at ',
    url: 'https://theblacqlist.com/pricing?utm_source=resend&utm_medium=email&utm_campaign=public-launch&utm_content=e4-ps',
    tail: '.',
  },
}
