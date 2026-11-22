// =============================================================================
// The search eval set (ticket 256)
// =============================================================================
// Questions people really type, and what a good answer must contain. Two
// runners read this list:
//
//   * tests/search-evals.test.ts runs every question through the quick answer
//     and the mock Cue against the small catalogue below. No model, no
//     database: it pins query understanding and Cue's query building.
//   * scripts/eval/search-evals.ts sends the same questions to a Preview or
//     staging /api/cue and checks the rules that hold for any catalogue.
//
// `find` names a business from the catalogue below; it only applies to the
// unit run, since live data differs.
// =============================================================================

import type { AssistantCategory } from '@/lib/ai/assistant'

export interface SearchEval {
  query: string
  /** At least one of these must be among the cards (unit run only). */
  find?: readonly string[]
  /** None of these may be among the cards (unit run only). */
  never?: readonly string[]
  /** The mock Cue can't follow this one (a place it strips, a typo). */
  skipMockCue?: boolean
}

export const SEARCH_EVALS: readonly SearchEval[] = [
  // The question that started it (founder, 2026-11-21).
  { query: 'How do I switch to Black Owned bathroom products', find: ['Lather & Light Soap Co.'] },
  { query: 'how do I switch to black owned toiletries', find: ['Lather & Light Soap Co.'] },
  { query: 'replace my lotion with a black owned brand', find: ['Lather & Light Soap Co.', 'Shea Glow Body Butter'] },
  { query: 'where can I buy shea butter', find: ['Shea Glow Body Butter'] },
  { query: 'bath bombs', find: ['Lather & Light Soap Co.'] },
  { query: 'body wash', find: ['Lather & Light Soap Co.', 'Shea Glow Body Butter', 'Pure Pit Naturals'] },
  { query: 'natural deodorant', find: ['Pure Pit Naturals'] },
  // Identity words alone: browse, never remark on them.
  { query: 'black owned' },
  { query: 'black owned businesses near me' },
  // Words that look alike but are other trades.
  { query: 'auto body shop', find: ['Precision Collision'], never: ['Lather & Light Soap Co.', 'Shea Glow Body Butter'] },
  { query: 'IT support', find: ['Byte Fix IT Support'], never: ['Lather & Light Soap Co.'] },
  { query: 'IT services for a small office', find: ['Byte Fix IT Support'] },
  { query: 'computer support for my business', find: ['Byte Fix IT Support'] },
  { query: 'support black owned bakeries', find: ['Sweet Auburn Bakery'] },
  // Names, including ones made of filler words.
  { query: 'The Shop ATL', find: ['The Shop ATL'] },
  { query: 'Black Tie Catering', find: ['Black Tie Catering'] },
  { query: 'black seed oil', find: ['Habesha Black Seed Oil Co.'] },
  // Everyday words for a trade.
  { query: 'where can I get a haircut', find: ['The Shop ATL'] },
  { query: 'I need a black owned dentist', find: ['Bright Smile Dental'] },
  { query: 'groceries', find: ['Harvest Market'] },
  { query: 'coffee', find: ['Daily Grind Cafe'] },
  { query: 'clothes for my son', find: ['Kente Kids Boutique'] },
  { query: 'makeup', find: ['Melanin Beauty Cosmetics'] },
  { query: 'tax help', find: ['Ledger Tax & Bookkeeping'] },
  // "auto" alone found auto insurance (live eval, 2026-11-21).
  { query: 'a good mechanic', find: ['Precision Collision'], never: ['Safe Harbor Insurance'] },
  { query: 'daycare for my toddler', find: ['Little Scholars Childcare'] },
  { query: 'counseling', find: ['Healing Roots Counseling'] },
  { query: 'photographer for a wedding', find: ['Golden Hour Photography'] },
  { query: 'where can I find books', find: ['Freedom Books'] },
  { query: 'wine', find: ['Twelve Vines Winery'] },
  // Hard ones: a typo, a place we don't cover, and nothing but a generic word.
  { query: 'barbr shop', skipMockCue: true },
  { query: 'lawyer in Boise', skipMockCue: true },
  { query: 'products' },
]

// ─── The unit run's catalogue ────────────────────────────────────────────────

export const EVAL_CATEGORIES: AssistantCategory[] = [
  { id: 'p-retail', slug: 'retail-gifts', name: 'Retail & Gifts', parentId: null },
  { id: 'c-hwp', slug: 'health-wellness-products', name: 'Health & Wellness Products', parentId: 'p-retail' },
  { id: 'c-bath', slug: 'bath-body', name: 'Bath & Body', parentId: 'p-retail' },
  { id: 'c-cloth', slug: 'clothing-boutiques', name: 'Clothing Boutiques', parentId: 'p-retail' },
  { id: 'c-books', slug: 'gift-shops', name: 'Gift Shops', parentId: 'p-retail' },
  { id: 'p-beauty', slug: 'beauty-personal-care', name: 'Beauty & Personal Care', parentId: null },
  { id: 'c-barber', slug: 'barber-shops', name: 'Barber Shops', parentId: 'p-beauty' },
  { id: 'c-makeup', slug: 'makeup-artists', name: 'Makeup Artists', parentId: 'p-beauty' },
  { id: 'p-auto', slug: 'automotive', name: 'Automotive', parentId: null },
  { id: 'c-auto', slug: 'auto-repair-mechanics', name: 'Auto Repair & Mechanics', parentId: 'p-auto' },
  { id: 'p-tech', slug: 'technology', name: 'Technology', parentId: null },
  { id: 'c-it', slug: 'it-support-managed-services', name: 'IT Support & Managed Services', parentId: 'p-tech' },
  { id: 'p-food', slug: 'food-drink', name: 'Food & Drink', parentId: null },
  { id: 'c-bake', slug: 'bakeries-pastry-shops', name: 'Bakeries & Pastry Shops', parentId: 'p-food' },
  { id: 'c-cafe', slug: 'cafes-coffee', name: 'Cafes & Coffee', parentId: 'p-food' },
  { id: 'c-grocery', slug: 'grocery-markets', name: 'Grocery & Markets', parentId: 'p-food' },
  { id: 'c-cater', slug: 'catering-events-food', name: 'Catering', parentId: 'p-food' },
  { id: 'p-health', slug: 'health-wellness', name: 'Health & Wellness', parentId: null },
  { id: 'c-dental', slug: 'specialty-medicine', name: 'Specialty Medicine', parentId: 'p-health' },
  { id: 'c-therapy', slug: 'mental-health-therapy', name: 'Mental Health & Therapy', parentId: 'p-health' },
  { id: 'p-pro', slug: 'professional-services', name: 'Professional Services', parentId: null },
  { id: 'c-tax', slug: 'tax-services', name: 'Tax Services', parentId: 'p-pro' },
  { id: 'c-law', slug: 'law-legal-services', name: 'Law & Legal Services', parentId: 'p-pro' },
  { id: 'c-ins', slug: 'insurance', name: 'Insurance', parentId: 'p-pro' },
  { id: 'p-family', slug: 'family-education', name: 'Family & Education', parentId: null },
  { id: 'c-child', slug: 'childcare-centers', name: 'Childcare Centers', parentId: 'p-family' },
  { id: 'p-events', slug: 'events-entertainment', name: 'Events & Entertainment', parentId: null },
  { id: 'c-wedphoto', slug: 'wedding-photography', name: 'Wedding Photography', parentId: 'p-events' },
  { id: 'p-farm', slug: 'farms-agriculture', name: 'Farms & Agriculture', parentId: null },
  { id: 'c-farm', slug: 'farms-farm-stands', name: 'Farms & Farm Stands', parentId: 'p-farm' },
]

export interface EvalListing {
  name: string
  category: string
  description: string
}

/** Twenty-five businesses, each findable only by words its own text uses. */
export const EVAL_LISTINGS: readonly EvalListing[] = [
  { name: 'Lather & Light Soap Co.', category: 'bath-body', description: 'Handmade soap, bath bombs and lotion in small batches.' },
  { name: 'Shea Glow Body Butter', category: 'bath-body', description: 'Whipped shea butter and lotion for dry skin.' },
  { name: 'Pure Pit Naturals', category: 'bath-body', description: 'Aluminum-free deodorant made with natural oils.' },
  { name: 'Habesha Black Seed Oil Co.', category: 'health-wellness-products', description: 'Cold-pressed black seed oil and honey.' },
  { name: 'Precision Collision', category: 'auto-repair-mechanics', description: 'Collision repair, auto body work and paint. Certified mechanic on site.' },
  { name: 'Byte Fix IT Support', category: 'it-support-managed-services', description: 'Computer repair and IT support for small offices.' },
  { name: 'The Shop ATL', category: 'barber-shops', description: 'Fades, lineups and beard trims. Walk-ins welcome.' },
  { name: 'Black Tie Catering', category: 'catering-events-food', description: 'Plated dinners and buffets for weddings and galas.' },
  { name: 'Sweet Auburn Bakery', category: 'bakeries-pastry-shops', description: 'Pound cake, sweet potato pie and custom cakes.' },
  { name: 'Daily Grind Cafe', category: 'cafes-coffee', description: 'Espresso, pour-over and pastries.' },
  { name: 'Harvest Market', category: 'grocery-markets', description: 'Fresh produce, pantry staples and local eggs.' },
  { name: 'Kente Kids Boutique', category: 'clothing-boutiques', description: 'Clothing and shoes for babies and kids.' },
  { name: 'Melanin Beauty Cosmetics', category: 'makeup-artists', description: 'Cosmetics and foundation shades for deep skin tones.' },
  { name: 'Ledger Tax & Bookkeeping', category: 'tax-services', description: 'Bookkeeping, payroll and accounting for families and small businesses.' },
  { name: 'Bright Smile Dental', category: 'specialty-medicine', description: 'Family dentistry, cleanings and braces.' },
  { name: 'Little Scholars Childcare', category: 'childcare-centers', description: 'Preschool and childcare for ages one to five.' },
  { name: 'Healing Roots Counseling', category: 'mental-health-therapy', description: 'Licensed therapist for individuals and couples.' },
  { name: 'Golden Hour Photography', category: 'wedding-photography', description: 'Wedding and engagement photography.' },
  { name: 'Freedom Books', category: 'gift-shops', description: 'Independent bookstore with readings every Friday.' },
  { name: 'Twelve Vines Winery', category: 'farms-farm-stands', description: 'Family vineyard and tasting room.' },
  { name: 'Peach State Law Group', category: 'law-legal-services', description: 'Family and estate attorney.' },
  { name: 'Kingdom Cuts', category: 'barber-shops', description: 'Barbershop with kids cuts on Saturdays.' },
  { name: 'Roots Farm Stand', category: 'farms-farm-stands', description: 'Seasonal vegetables and fresh flowers.' },
  { name: 'Velvet Lounge', category: 'catering-events-food', description: 'Small plates and private events.' },
  { name: 'Safe Harbor Insurance', category: 'insurance', description: 'Auto insurance, home and life policies.' },
]
