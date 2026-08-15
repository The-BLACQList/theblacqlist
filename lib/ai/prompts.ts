// Prompt template constants for BLACQList AI agents.
// These are string templates only — no API calls in this file.
// All templates use {{variable}} placeholders for safe server-side assembly.
//
// PRIVACY: Templates may only reference publicly visible listing data.
// Never include email, phone, address, user_id, or reviewer identity.
// See docs/blacqlist/ai/ai-safety-and-approval-plan.md for full rules.

export const PROMPT_TEMPLATES = {
  // ─── Business-side agents ────────────────────────────────────────────────

  LISTING_DESCRIPTION: `You are a copywriter helping a Black-owned business get discovered online. Write a compelling business description for "{{listing_name}}", a {{category_name}} business in {{city_name}}.

The description should:
- Be 150–250 words
- Open with the business's core value proposition
- Highlight what makes this business worth visiting or contacting
- Use warm, community-oriented language
- End with a clear reason to reach out or visit
- Not include contact information, URLs, or pricing

Write only the description text. No headings, no intro, no explanation.`,

  SEO_TITLE: `Generate a concise, compelling meta title for a Black-owned business listing.

Business name: {{listing_name}}
Category: {{category_name}}
City: {{city_name}}

Requirements:
- Maximum 60 characters
- Include the business name and city
- Naturally include the category or service type
- Do not use pipes (|) or all-caps
- Write only the title text, nothing else`,

  SEO_DESCRIPTION: `Generate a meta description for a Black-owned business listing.

Business name: {{listing_name}}
Category: {{category_name}}
City: {{city_name}}
Current description excerpt: {{description_excerpt}}

Requirements:
- 140–160 characters exactly
- Include a clear call to action ("Find", "Discover", "Book", "Visit", "Contact")
- Include the city name
- Do not use quotation marks
- Write only the meta description text, nothing else`,

  SOCIAL_CAPTION_INSTAGRAM: `Write an Instagram caption for a Black-owned business to share their BLACQList Page.

Business name: {{listing_name}}
Category: {{category_name}}
City: {{city_name}}
Tagline: {{tagline}}

Requirements:
- Maximum 150 characters (not counting hashtags)
- Energetic and community-oriented tone
- End with 3–5 relevant hashtags on a new line
- Do not include URLs
- Write only the caption text and hashtags, nothing else`,

  SOCIAL_CAPTION_FACEBOOK: `Write a Facebook post for a Black-owned business to share their BLACQList Page.

Business name: {{listing_name}}
Category: {{category_name}}
City: {{city_name}}
Tagline: {{tagline}}

Requirements:
- 1–2 sentences, maximum 280 characters
- Conversational and inviting tone
- Include a call to action ("Check us out", "Find us on", "Support us")
- Do not include URLs
- Write only the post text, nothing else`,

  SOCIAL_CAPTION_X: `Write an X (Twitter) post for a Black-owned business to share their BLACQList Page.

Business name: {{listing_name}}
Category: {{category_name}}
City: {{city_name}}

Requirements:
- Maximum 280 characters including hashtags
- Direct and compelling
- Include 2–3 relevant hashtags
- Do not include URLs
- Write only the post text, nothing else`,

  REVIEW_RESPONSE: `Write a professional, warm response to a customer review for a Black-owned business.

Business name: {{listing_name}}
Review rating: {{rating}} out of 5 stars
Review text: {{review_text}}

Requirements:
- Maximum 300 characters
- Warm and personal tone, not corporate or template-sounding
- For positive reviews (4–5 stars): express genuine gratitude, reference something specific from the review
- For neutral reviews (3 stars): thank the reviewer, acknowledge their feedback, invite them back
- For negative reviews (1–2 stars): acknowledge the experience calmly, express commitment to improvement, invite direct contact to resolve
- Do not include contact information, promises, or discounts
- Do not be defensive
- Write only the response text, nothing else`,

  ANALYTICS_SUMMARY: `Write a plain-language summary of a Black-owned business's recent performance on The BLACQList.

Business name: {{listing_name}}
Category: {{category_name}}
City: {{city_name}}
Last 30 days:
- Page views: {{page_views_30d}}
- CTA clicks: {{cta_clicks_30d}}
- Saves: {{saves_30d}}
- Shares: {{shares_30d}}
Last 7 days page views: {{page_views_7d}}

Requirements:
- 2–3 sentences maximum
- Plain language, no jargon
- Highlight the strongest metric
- End with one actionable tip to improve the weakest metric
- Do not include numbers that appear fabricated
- Write only the summary text, nothing else`,

  // ─── Admin / platform agents ─────────────────────────────────────────────

  COLLECTION_SUGGESTION: `Suggest listings that belong in a curated collection on The BLACQList, a platform for Black-owned businesses.

Collection name: {{collection_name}}
Collection description: {{collection_description}}
City filter: {{city_name}}
Category filter: {{category_name}}
Existing members (for context): {{existing_listing_names}}

Candidate listings to evaluate:
{{candidate_listings}}

For each candidate that fits the collection, provide:
- The listing name
- One sentence explaining why it belongs

Format your response as a simple list. Only include listings that genuinely fit. If none fit, say so.`,

  GUIDE_SECTION: `Write a section for a city guide on The BLACQList, a platform for discovering Black-owned businesses.

City: {{city_name}}
Category: {{category_name}}
Tone: {{guide_tone}}
Featured businesses: {{featured_listing_names}}

Requirements:
- 2–4 paragraphs
- Community-oriented, editorial voice
- Weave in 2–4 of the featured business names naturally
- Do not fabricate details about the businesses
- Do not include contact information, addresses, or URLs
- End with a brief "why this matters to the community" closing thought
- Write only the guide section text, nothing else`,

  SOCIAL_POST_ADMIN: `Write a social media post announcing a newly verified Black-owned business on The BLACQList.

Business name: {{listing_name}}
Category: {{category_name}}
City: {{city_name}}
Trust tier: {{trust_tier}}
Tagline: {{tagline}}

Requirements for Instagram version (max 150 chars + hashtags):
- Celebratory and community-proud tone
- Mention the city
- 3–5 hashtags on a new line
- Do not include URLs

Write three versions labeled "Instagram:", "Facebook:", and "X:" with each on its own line.`,
} as const

export type PromptTemplateKey = keyof typeof PROMPT_TEMPLATES

// Agent type → prompt template mapping.
// Used by the provider to look up the right template for a given agent.
export const AGENT_PROMPT_MAP: Record<string, PromptTemplateKey> = {
  listing_description: 'LISTING_DESCRIPTION',
  seo_coach_title: 'SEO_TITLE',
  seo_coach_description: 'SEO_DESCRIPTION',
  social_caption_instagram: 'SOCIAL_CAPTION_INSTAGRAM',
  social_caption_facebook: 'SOCIAL_CAPTION_FACEBOOK',
  social_caption_x: 'SOCIAL_CAPTION_X',
  review_response: 'REVIEW_RESPONSE',
  analytics_explainer: 'ANALYTICS_SUMMARY',
  collection_builder: 'COLLECTION_SUGGESTION',
  guide_writer: 'GUIDE_SECTION',
  social_media_admin: 'SOCIAL_POST_ADMIN',
}
