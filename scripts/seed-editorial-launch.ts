/**
 * Seed the editorial launch set — 3 articles + 2 guides written in the founder's
 * voice (decision-log, GATE-PUBLISH 2026-08-23).
 *
 * Lights up both homepage editorial surfaces in one run:
 *   - components/home/BlacqlightFeature.tsx  needs >= 1 published article
 *   - components/home/EditorialRail.tsx:49   needs >= 3 published articles + guides
 * This set publishes 3 articles + 2 guides, so the rail lands 4 cards against a
 * minimum of 3 and a single later unpublish does not drop it back under the guard.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/seed-editorial-launch.ts [--dry-run] [--yes]
 *
 *   --dry-run   print the plan and write nothing (DRY_RUN=1 also works)
 *   --yes       confirm a remote target; required for staging or production
 *
 * Idempotent: articles and guides upsert on `slug`; guide sections are replaced
 * for their guide on each run. Re-running restores the intended state rather
 * than duplicating it.
 *
 * TARGET SAFETY: there is no dotenv and no --env flag here, matching
 * seed-launch-listings.ts. The database is chosen entirely by the exported
 * SUPABASE_URL, so a mistyped host silently writes to the wrong project. The
 * script prints the resolved project ref before writing and requires --yes for
 * any non-local host.
 *
 * The homepage hero is the article with the newest `published_at`
 * (app/page.tsx:98 orders published_at DESC, :185 takes row 0). Publishing by
 * hand makes that depend on the order of clicks. Here it is data: each article
 * carries an explicit `publishedOffsetMinutes` and the founder's piece is last,
 * so the hero is deterministic no matter what order this script writes in.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env['SUPABASE_URL']
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const DRY_RUN = process.env['DRY_RUN'] === '1' || process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  console.error('Values are in .env.production.local / .env.staging.local (never commit them).')
  process.exit(1)
}

/**
 * Confirm the operator meant this database.
 *
 * Mirrors assertTargetConfirmed() in seed-launch-listings.ts. Local hosts run
 * unattended. Anything else is a consequential write behind GATE-DATA, so it
 * must be named out loud with --yes. The project ref is printed either way; it
 * is the only signal that distinguishes staging from production at the command
 * line. A dry run prints the target but never needs confirming, since it writes
 * nothing.
 */
function assertTargetConfirmed(url: string): void {
  const host = new URL(url).hostname
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
  const ref = host.endsWith('.supabase.co') ? host.split('.')[0] : host

  console.log(`Target: ${isLocal ? 'LOCAL' : 'REMOTE'} — project ref "${ref}" (${host})`)
  if (DRY_RUN) {
    console.log('Mode:   DRY RUN — nothing will be written.\n')
    return
  }
  console.log('Mode:   LIVE — this run publishes to the project above.\n')

  if (isLocal || process.argv.includes('--yes')) return

  console.error(
    `Refusing to publish to remote project "${ref}" without confirmation.\n` +
      `Check the ref above against the project you intend to write to, then re-run with --yes.\n` +
      `Publishing to a remote project is a GATE-PUBLISH and GATE-DATA action; confirm the gate before passing it.`
  )
  process.exit(1)
}

assertTargetConfirmed(SUPABASE_URL)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface ArticleSeed {
  title: string
  slug: string
  subtitle: string
  authorName: string
  metaDescription: string
  tags: string[]
  /** Minutes before the run timestamp. Larger = older = further from the hero. */
  publishedOffsetMinutes: number
  body: string
}

interface GuideSectionSeed {
  heading: string
  body: string
}

interface GuideSeed {
  title: string
  slug: string
  subtitle: string
  description: string
  metaDescription: string
  city: string | null
  publishedOffsetMinutes: number
  sections: GuideSectionSeed[]
}

// ---------------------------------------------------------------------------
// Articles. Ordered oldest to newest; the last one becomes the homepage hero.
// ---------------------------------------------------------------------------

const ARTICLES: ArticleSeed[] = [
  {
    title: 'A Page, Not a Listing',
    slug: 'a-page-not-a-listing',
    subtitle: 'The difference between being in a directory and being represented.',
    authorName: 'The BLACQList Team',
    metaDescription:
      'A listing is a row of data. A Page is a business introduced the way its owner would introduce it. Here is why The BLACQList builds Pages.',
    tags: ['pages', 'owners'],
    publishedOffsetMinutes: 20,
    body: `Ask any owner what happened after they got listed somewhere and you will hear a version of the same story. The name is spelled right. The hours are three years old. The one photo is the sign out front, shot from a car window.

Owners deserve better than that. So we built The BLACQList around the Page.

## A listing describes. A Page introduces.

A listing is a row of data. Name, address, phone, a star average. It answers exactly one question, which is whether the business exists.

A Page answers the questions people actually have before they spend money. What do you make. Who is behind the counter. What does the room feel like on a Saturday afternoon. Are you open right now. How do I buy something from you today.

Same business. A completely different amount of respect.

## The owner writes it

This is the part that changes everything, and it is the easiest part to skim past.

On most platforms, your business is described by whoever scraped it. Here, once you claim your Page, you write it. You set the hours. You add the photos. You say what you are known for. You respond to reviews in your own voice, as yourself.

We do not think of that as a feature. We think of it as the entire point. Nobody describes your business better than you do, and no directory has ever been improved by keeping the owner out of it.

Our approach is simple. Give the owner the page they would have built for themselves if they had the time.

## A good Page works while you are busy working

Someone searches for what you sell, in the city you are in. They land on your Page. Inside of fifteen seconds they know what you do, whether you are open, what other people say about you, and how to reach you. That is a customer you never had to go find.

A stale listing does the opposite, quietly. It hands people a number that rings nowhere and hours that were true two summers ago, and they draw the obvious conclusion. They decide you are closed. You never hear about it, because nothing happened. That is what makes it expensive.

## Your turn

Look yourself up the way a stranger would. Search your city and your category, and find your own business.

Then ask it honestly. Is that a Page, or is that a row in a database?

If it is a row, claim it. Claiming takes a few minutes. Everything after that is yours to write.`,
  },
  {
    title: 'Spending on Purpose',
    slug: 'spending-on-purpose',
    subtitle: 'Where you spend decides where the money goes next.',
    authorName: 'The BLACQList Team',
    metaDescription:
      'Buying from a Black-owned business is not a donation. It is a decision about where your dollar goes after it leaves your hand.',
    tags: ['circulation', 'community'],
    publishedOffsetMinutes: 10,
    body: `There is a moment most people have had and then let go of. You are ordering something ordinary, a coffee, a haircut, a birthday cake, and it occurs to you that you have no idea who you just handed your money to.

Nothing went wrong in that transaction. It is just a decision that got made without you.

## Money does not stop when you spend it

Your dollar has a life after it leaves your hand.

It covers part of somebody's shift. That shift covers a rent payment, a tuition bill, an order placed with a supplier down the road. If the business you bought from hires locally, banks locally, and buys from people it actually knows, your dollar takes a longer walk through your own neighborhood before it leaves.

If it does not, the dollar leaves on the first bounce.

We are not going to put a figure on that here. The honest answer is that it depends on your city, your block, and the business, and we would rather tell you the truth than a statistic. What is not in dispute is the direction. Where you spend decides where the money goes next.

## This is not charity

We want to be plain about this, because a lot of people have been trained to hear it the wrong way.

Buying from a Black-owned business is not a donation. It is not a favor, a gesture, or a thing you do for one month a year. It is buying a good haircut from somebody who gives a good haircut.

The BLACQList is not a cause page. It is a directory of businesses that want your money in exchange for something excellent. Support who matters and get your money's worth. Both of those are true at the same time, and neither one has to apologize to the other.

## The version that works is boring

You do not have to overhaul your life to do this, and the people who try usually quit by March.

Pick the two or three things you buy most often. Coffee, food, hair, cleaning, printing, whatever yours actually are. Find one place for each. Then go back.

Repeat business is the part that moves anything. A standing Saturday appointment does more for a shop over a year than one big intentional spend in February ever will, and it is easier on you.

## Your turn

Pick one recurring purchase. Just one, the one you make without thinking about it.

Search it here, in your city. Find a Black-owned business that sells it and go once. If they are good, go back, and save the Page so you can find your way there again without hunting.

That is the whole practice. One line item at a time, on purpose.`,
  },
  {
    // Published last on purpose. This is the founding piece and it takes the hero.
    // author_name is set explicitly: the column defaults to 'The BLACQList Team',
    // and this is the one piece in the set that carries a personal byline.
    title: 'The List We Could Not Find',
    slug: 'the-list-we-could-not-find',
    subtitle: 'Why I started The BLACQList.',
    authorName: 'Chalece DeLaCoudray',
    metaDescription:
      'Everybody had a list of Black-owned businesses. Nobody had the list. Why I stopped looking for it and started building it.',
    tags: ['founder', 'why we exist'],
    publishedOffsetMinutes: 0,
    body: `I went looking for the list long before I ever thought about building one.

I wanted to spend my money with Black-owned businesses in my own city, and I assumed the hard part would be choosing between them. It was not. The hard part was finding out who was out there at all.

What I found was pieces. A screenshot somebody posted in 2019. A group thread with forty replies and not one address in any of them. A roundup post where half the links were dead and the other half went to businesses that had moved, rebranded, or closed years ago. Everybody had a list. Nobody had the list.

## The businesses were never the problem

They were there. They are there. That is the part that kept nagging at me.

They were open, they were good, and they were invisible to anyone who did not already know somebody who knew. Discovery was running entirely on word of mouth, and word of mouth only travels as far as your group chat.

That is a distribution problem wearing the costume of a scarcity problem. From the outside it can look like there are not enough Black-owned businesses to choose from. There are plenty. They are just scattered across a hundred screenshots, and keeping any of it current was nobody's job.

## So I built the thing I kept looking for

I create, I build, and I teach. For more than a decade I have taken complicated things apart and put them back together so that other people can actually use them. This turned out to be that same work in different clothes.

My approach is simple. Start from what a person has to be able to do, build the shortest clear path to get them there, and judge the result by whether it holds up in practice.

What a person has to be able to do here is find a Black-owned business that sells what they need, today, in the city they are standing in, and trust what they are looking at when they arrive.

Everything else comes out of that one sentence. Pages instead of listings, because a row of data has never helped anybody decide anything. Trust shown honestly instead of assumed, because the day it stops being true the whole thing is worthless. Atlanta-born and national from day one, because the woman looking for a barber in a city I have never set foot in deserves the same answer I wanted.

## What I am asking

We are early. I would rather say that plainly than pretend otherwise.

A directory becomes useful the way a neighborhood does, slowly and then all at once, and only if people actually show up. So here is the ask, and it is small.

If you own a business, claim your Page and make it yours. If you know a business that belongs here, tell them, or add them yourself. If you are buying something this week, find one place here and go.

The list we could not find is the one we are building. It only works if we build it together.

With gratitude,
Chalece`,
  },
]

// ---------------------------------------------------------------------------
// Guides. Both land in the rail; order between them does not matter.
// ---------------------------------------------------------------------------

const GUIDES: GuideSeed[] = [
  {
    title: 'Reviews That Do Real Work',
    slug: 'reviews-that-do-real-work',
    subtitle: 'How to write one that actually helps the next person decide.',
    description:
      'Most reviews are a star and a shrug. Here is how to write the kind somebody reads twice, and what our policy will and will not take down.',
    metaDescription:
      'A short guide to writing reviews that help people decide, and a plain explanation of what The BLACQList removes and what it leaves up.',
    city: null,
    publishedOffsetMinutes: 15,
    sections: [
      {
        heading: 'A review is a favor you do for a stranger',
        body: `Think about the last time you were deciding between two places you had never been. You did not want a star average. You wanted one person to tell you what it was actually like.

That is the whole job. You are not grading the business. You are handing the next person the thing you wish somebody had handed you.

Everything below is just how to do that well.`,
      },
      {
        heading: 'Say what you bought',
        body: `The single biggest upgrade to any review is naming the thing.

"Great food" tells nobody anything. "The oxtail is worth the wait, and the wait is real on Sundays" tells somebody exactly what to order and when not to show up hungry.

Same for services. What did you get, how long did it take, and did it hold up. A locs retwist that still looked good three weeks later is a completely different review from one that looked good walking out the door.

Specific is not the same as long. Two honest sentences about one real purchase beat a paragraph of adjectives.`,
      },
      {
        heading: 'Give the reader the context they cannot see',
        body: `You know things the photos do not show, and those things are usually what decide it for somebody.

Is there parking, and is it a fight. Is the room loud or is it somewhere you could actually have a conversation. Did they take walk-ins or should you book. Is it cash friendly. Did they take care of your kid, your grandmother, your dietary thing, without making it awkward.

Write down the detail you would text a friend. That detail is the review.`,
      },
      {
        heading: 'Stars are one signal, not the point',
        body: `We are not building a scoreboard.

A rating is a quick summary for people skimming, and that is a real job, so pick the number that honestly matches your experience. But the words are what people trust, and the words are what an owner can actually act on.

If you are torn between two ratings, stop fussing over the number and go spend that energy on the sentence underneath it. Nobody has ever changed their mind because of a fourth star. Plenty of people have changed their mind because of one clear line.`,
      },
      {
        heading: 'A bad experience is worth writing, if you write it fairly',
        body: `Negative reviews stay up here. We want to be clear about that, because plenty of people assume the opposite.

A genuine bad experience is real information, and burying it would make every good review worth less. So write it. Just write it the way you would want yours written.

Say what happened, not what you assume about the people involved. Keep it to your own visit and your own facts. Give the date or the general timeframe, because a rough Tuesday two years ago under different management is not the same as last week. And if the owner fixed it, come back and say that too. That is the most useful review on the whole page.

What does not belong in a review is anybody's personal information, threats, or slurs. That is not a bad review. That is a different thing entirely, and we take it down.`,
      },
      {
        heading: 'What we remove, and what we do not',
        body: `Our moderation policy is published, and it is short on purpose.

We remove spam and advertising, hate, harassment, threats, and doxxing. We remove reviews that expose somebody's personal information. We remove reviews we can demonstrate are fake, including bulk patterns and competitor sabotage. We remove owners reviewing their own business.

We do not remove a review for being negative. Not when the owner asks. Not when it stings. A directory that quietly deletes its bad reviews is not a directory anybody should trust, including you.

Owners get the better remedy anyway, which is a reply. If you own the business, claim your Page and respond in your own voice. A thoughtful response to a hard review does more for you than the review's removal ever would.`,
      },
      {
        heading: 'Your turn',
        body: `Think of one Black-owned business you already go back to. Not a hypothetical, a real one, the one you would name if somebody asked you right now.

Find its Page and write two sentences. What you buy there, and one thing the next person should know before they walk in.

That is it. Two sentences, once. It is the cheapest thing any of us can do for a business we like.`,
      },
    ],
  },
  {
    title: 'Start Here: Your First Week as an Owner',
    slug: 'start-here-your-first-week-as-an-owner',
    subtitle: 'Find your business, claim it, and set it up so people can actually find you.',
    description:
      'A week-one walkthrough for business owners. What to do first, what can wait, and how trust is earned here.',
    metaDescription:
      'The first week on The BLACQList, in order. Find your business, claim your Page, fill in what makes you findable, and understand how verification works.',
    city: null,
    publishedOffsetMinutes: 5,
    sections: [
      {
        heading: 'Day one, look yourself up before you add anything',
        body: `Start by searching for your own business by name, then by your category and city.

There is a good chance you are already here. We built the directory to be useful before every owner arrives, so a lot of businesses are listed and waiting for the person who runs them.

If you find yourself, do not add a second entry. Duplicates split your reviews and confuse customers, and cleaning them up later is a chore neither of us needs. Claim the one that exists.

If you genuinely are not here, add your business. A person reviews new submissions before they go live, so it will not appear the instant you hit submit. That review is the reason the directory is worth trusting, and it applies to everybody.`,
      },
      {
        heading: 'Claim your Page',
        body: `Claiming is the door. Almost nothing else on this list is available until you walk through it.

Find your business and use the claim option on the Page. You are telling us you own or represent this business, and we check that before we hand you the keys. Once the claim is approved, your Page moves from unclaimed to claimed, and it becomes yours to edit.

What that gets you, immediately: you update your own information, you add your own photos, and you respond to reviews in your own voice.

That last one matters more than owners expect. A thoughtful reply on a hard review is one of the most persuasive things on any Page.`,
      },
      {
        heading: 'Fill in the boring fields, because they are the findable ones',
        body: `This is the least glamorous hour of your week and the highest return.

Get your hours right, including the ones you actually keep, not the ones on the door from 2022. Get your phone and email right. Put your website in. Get your address and city right, because that is how you show up when somebody searches near them.

Then write your description like a person. Not a mission statement. What you make, who you are, what you are known for. Someone deciding whether to drive across town should be able to read it once and know.

Pick your category carefully too. Being in the right category is most of being found at all.`,
      },
      {
        heading: 'Photos, and the one photo people actually need',
        body: `Add real photos. Not stock, not a screenshot of your flyer.

The one everybody forgets is the shot that helps somebody arrive. Your storefront from the sidewalk, or the entrance they will be standing in front of holding a phone, confused. That photo prevents more lost customers than any hero image.

After that: what you sell, in good light. The room, so people know what they are walking into. You, if you are comfortable, because people buy from people.

Three good photos beat twelve blurry ones. You can always add more later.`,
      },
      {
        heading: 'Ask for your first reviews, out loud',
        body: `Nobody reviews a business they were not asked to review. This is true everywhere, and it is not a flaw in you.

So ask. Not a campaign, not a discount, just a sentence to the customers who already like you. Tell them you are on The BLACQList now, and ask them to say what they actually think.

Do not buy reviews and do not write your own. We remove both, and it is not a close call. Beyond the policy, a page of obviously purchased praise reads as exactly that, and it costs you the trust you were trying to buy.

Real reviews come in slower. They are also the only ones that do anything.`,
      },
      {
        heading: 'Verification, when you are ready for it',
        body: `Claimed says you told us this is yours. Verified says we checked.

You start verification from your dashboard once your Page is claimed. You upload documents, and a human reads them.

What clears the bar: two independent signals, and one of them has to connect you personally to the business. Business registration or an LLC filing. An EIN or tax document. A utility bill, lease, or bank statement at the listed address from within the last year. At least one of those has to have your name on it, or a document has to tie you to the entity.

What does not clear it: anything you made yourself. A website screenshot, a social profile, a business card, an invoice you wrote. Three documents proving the business exists but never naming you prove the business exists. They do not prove it is yours.

If we cannot verify you, we tell you which document is missing, not "insufficient evidence." Send that one in and try again.`,
      },
      {
        heading: 'Certified is computed, not granted',
        body: `There is one more tier above verified, and no one can hand it to you. Not us, not anybody. It is calculated.

A Page becomes certified when all of it is true at once: it is verified, it is published, it has at least five published reviews, its average rating is at least 3.5, at least ninety days have passed since your claim was approved, and your business details are complete.

We are telling you the criteria so nobody has to wonder, and so nobody wastes time asking to be moved up the list. There is no line. Certified is tenure plus community weight, and the only way to it is to keep doing the work in front of you.`,
      },
      {
        heading: 'Your first week, in order',
        body: `Day one. Search for your business. Claim it if it is here, add it if it is not.

Day two. Once your claim is approved, fix your hours, phone, address, and category. Write your description.

Day three. Add three real photos, and make one of them the storefront.

Day four. Ask five customers who already like you to leave an honest review.

Day five. Start verification from your dashboard if you have your documents handy. If you do not, this is the week to go find them.

Then get back to running your business. Come back when a review lands, and answer it like yourself.`,
      },
    ],
  },
]

// ---------------------------------------------------------------------------

const RUN_AT = Date.now()

function publishedAt(offsetMinutes: number): string {
  return new Date(RUN_AT - offsetMinutes * 60_000).toISOString()
}

async function seedArticle(a: ArticleSeed): Promise<boolean> {
  const row = {
    title: a.title,
    slug: a.slug,
    subtitle: a.subtitle,
    body: a.body,
    author_name: a.authorName,
    meta_description: a.metaDescription,
    tags: a.tags,
    status: 'published',
    published_at: publishedAt(a.publishedOffsetMinutes),
  }

  if (DRY_RUN) {
    console.log(`[dry-run] article "${a.slug}" — published_at ${row.published_at}, by ${a.authorName}`)
    return true
  }

  const { error } = await supabase
    .from('editorial_articles')
    .upsert(row, { onConflict: 'slug' })
    .select('id')
    .single()

  if (error) {
    console.error(`[${a.slug}] Failed to upsert article:`, error.message)
    return false
  }
  console.log(`[${a.slug}] published ${row.published_at} — by ${a.authorName}`)
  return true
}

async function seedGuide(g: GuideSeed): Promise<boolean> {
  const row = {
    title: g.title,
    slug: g.slug,
    subtitle: g.subtitle,
    description: g.description,
    meta_description: g.metaDescription,
    city: g.city,
    status: 'published',
    published_at: publishedAt(g.publishedOffsetMinutes),
  }

  if (DRY_RUN) {
    console.log(`[dry-run] guide "${g.slug}" — ${g.sections.length} sections`)
    return true
  }

  const { data: guideRow, error: guideErr } = await supabase
    .from('guides')
    .upsert(row, { onConflict: 'slug' })
    .select('id')
    .single()

  if (guideErr || !guideRow) {
    console.error(`[${g.slug}] Failed to upsert guide:`, guideErr?.message)
    return false
  }
  const guideId = guideRow.id as string

  // Replace sections so a re-run restores the intended set rather than doubling it.
  const { error: delErr } = await supabase.from('guide_sections').delete().eq('guide_id', guideId)
  if (delErr) {
    console.error(`[${g.slug}] Failed to clear sections:`, delErr.message)
    return false
  }

  const { error: secErr } = await supabase.from('guide_sections').insert(
    g.sections.map((s, i) => ({
      guide_id: guideId,
      heading: s.heading,
      body: s.body,
      display_order: i + 1,
    }))
  )
  if (secErr) {
    console.error(`[${g.slug}] Failed to insert sections:`, secErr.message)
    return false
  }

  console.log(`[${g.slug}] published — ${g.sections.length} sections written`)
  return true
}

async function verify(): Promise<void> {
  const [articlesRes, guidesRes] = await Promise.all([
    supabase
      .from('editorial_articles')
      .select('title, author_name, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false }),
    supabase.from('guides').select('title').eq('status', 'published'),
  ])

  const articles = articlesRes.data ?? []
  const guides = guidesRes.data ?? []
  const hero = articles[0]

  console.log('\n--- Verification (reads the same queries the homepage runs) ---')
  console.log(`Published articles: ${articles.length}   (BlacqlightFeature needs >= 1)`)
  console.log(`Published guides:   ${guides.length}`)
  console.log(`Rail cards:         ${articles.length - 1 + guides.length}   (EditorialRail needs >= 3 combined)`)

  if (hero) {
    console.log(`\nHomepage hero: "${hero.title}" by ${hero.author_name}`)
    if (hero.title !== 'The List We Could Not Find') {
      console.warn('WARNING: the hero is not the founding piece. Check published_at ordering.')
    }
    if (hero.author_name === 'The BLACQList Team' && hero.title === 'The List We Could Not Find') {
      console.warn('WARNING: the founding piece lost its byline. author_name fell back to the default.')
    }
  } else {
    console.warn('WARNING: no published article. The homepage feature will render nothing.')
  }

  if (articles.length + guides.length < 3) {
    console.warn('WARNING: fewer than 3 published pieces. The editorial rail will not render.')
  }
}

async function main(): Promise<void> {
  if (!DRY_RUN) console.log('Seeding editorial launch set...\n')

  let ok = true
  for (const a of ARTICLES) ok = (await seedArticle(a)) && ok
  for (const g of GUIDES) ok = (await seedGuide(g)) && ok

  if (DRY_RUN) {
    console.log('\nDry run complete. Nothing was written.')
    console.log('To publish, re-run the same command with --dry-run replaced by --yes.')
    return
  }

  await verify()

  if (!ok) {
    console.error('\nOne or more pieces failed. Fix the error above and re-run; the script is idempotent.')
    process.exit(1)
  }
  console.log('\nEditorial launch set complete.')
}

void main()
