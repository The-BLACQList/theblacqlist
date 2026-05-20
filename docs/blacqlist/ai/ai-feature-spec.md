# AI Feature Specification — The BLACQList

**Date:** 2026-05-11  
**Status:** Foundation defined — no provider connected  
**Phase:** Pre-V2 (data model + placeholders only)

---

## Overview

The BLACQList AI Agent Layer is a set of specialized agents that help shoppers discover, help business owners grow, and help platform admins curate. All agents operate under a **human-in-the-loop** model: AI produces suggestions, humans approve or reject them before any content is published or action is taken.

**Non-negotiables:**

- No AI-generated content auto-published
- No PII passed to any AI provider
- No external AI API calls until provider integration is explicitly approved and configured
- All suggestions persisted in `ai_suggestions` table with `status = 'pending'` until reviewed

---

## Agent Categories

### 1. Shopper-Side Agents (5 agents)

These agents assist community members in discovering, supporting, and spending with Black-owned businesses.

#### 1.1 Find-It-For-Me Agent

**Phase:** V3  
**Purpose:** Natural language discovery — user describes what they need in plain English; agent returns a ranked set of matching listings with a brief explanation of why each is a good match.  
**Trigger:** User types a conversational query into a dedicated search interface (not the standard keyword search)  
**Inputs:** `query` (string), `city` (from session/preference), `category_id` (optional), `trust_tier_filter` (optional)  
**Output:** Ordered list of listing IDs with relevance notes  
**Privacy:** No user_id passed to provider. City and category are non-identifying. Query text is the only user-originated input — it must not contain PII (search field copy enforces this).  
**Data sources:** listings (name, tagline, category, city, description excerpt), search_events (aggregated click patterns — no individual user data)

---

#### 1.2 Support Local Tonight Agent

**Phase:** V2  
**Purpose:** Same-day, occasion-aware discovery. User says "I want to support a local restaurant tonight" or "find something open now in Atlanta" and gets a short, curated list.  
**Trigger:** Dedicated CTA on city landing pages and homepage ("Support Local Tonight")  
**Inputs:** `city_id`, `current_time` (server-side), `occasion_type` (optional: 'dining', 'shopping', 'services', 'all')  
**Output:** 3–5 listing recommendations with "why now" note  
**Privacy:** No user_id. Time of day is non-identifying. `city_id` is public data.  
**Data sources:** listings (hours, category, name, city), listing_hours (is open now)

---

#### 1.3 Gift Finder Agent

**Phase:** V2  
**Purpose:** Gift recommendation by recipient type, occasion, and budget. Returns a curated mix of business listings and marketplace products.  
**Trigger:** "Find a gift" CTA on homepage or collections page  
**Inputs:** `recipient_type` (string: 'parent', 'friend', 'partner', 'child', 'colleague'), `budget_max` (integer cents), `city_id` (optional), `occasion` (optional)  
**Output:** Mix of listing and product suggestions with a brief gift narrative  
**Privacy:** No user_id. Budget and recipient type are anonymized inputs.  
**Data sources:** listings (category, name, marketplace_products), products (name, price, description)

---

#### 1.4 Event Planner Agent

**Phase:** V3  
**Purpose:** Multi-vendor event planning. User describes an event (birthday party, wedding, corporate event) and the agent assembles a multi-category vendor shortlist covering all needed categories.  
**Trigger:** "Plan an Event" CTA on event-type category pages  
**Inputs:** `event_type` (string), `guest_count` (integer), `budget_total_cents` (integer), `city_id`, `event_date` (optional)  
**Output:** Category-by-category vendor shortlist with budget allocation suggestion  
**Privacy:** No user_id. Event metadata is not personally identifiable.  
**Data sources:** listings (category, city, name, CTA type), listing_details_business (price_range)

---

#### 1.5 Community Spend Agent

**Phase:** V3  
**Purpose:** Personal spending analytics + next-dollar nudges. Reviews the user's own spend history (receipt uploads) and surfaces insights like "You've spent $340 at Black-owned restaurants this year — here's what's trending nearby."  
**Trigger:** Spend dashboard section  
**Inputs:** Aggregated spend totals by category + city (from spend_events) — **never individual transaction records**  
**Output:** Narrative summary + 2–3 actionable suggestions ("Try a Black-owned gym near you")  
**Privacy:** **Highest sensitivity.** Only aggregated totals passed to provider — never transaction IDs, amounts, merchant names, or dates. user_id never included. Opt-out must be respected before this agent runs.  
**Data sources:** spend_events (aggregated only: total_usd by category, city — no individual rows)

---

### 2. Business-Side Agents (7 agents)

These agents help business owners improve their BLACQList Pages and grow their presence. All output goes to `ai_suggestions` with `status = 'pending'` — owners must approve before anything is applied.

#### 2.1 Page Builder Agent (BLACQList Page Builder)

**Phase:** V2  
**Purpose:** Guided listing creation. When a business owner creates a new listing, the agent suggests a draft description, tagline, and meta content based on the business category, city, and any initial details the owner provides.  
**Trigger:** "Get AI help" button in the listing creation flow (after category and city are selected)  
**Inputs:** `category_name`, `city_name`, `business_name` (if provided), `price_range` (if provided), optional owner free-text prompt  
**Output:** Draft `description`, `tagline`, `meta_title`, `meta_description` — each as a separate suggestion row  
**Privacy:** Inputs are category/city/business name only. No email, phone, or owner personal data.  
**Approval:** Owner reviews each field suggestion individually; clicks "Apply" per field.

---

#### 2.2 Listing Optimizer Agent

**Phase:** V2 (rule-based checklist at MVP foundation)  
**Purpose:** Identifies specific weaknesses in a listing's page completeness and quality, then generates targeted improvement copy suggestions.  
**MVP implementation:** Rule-based checklist only — no AI API call. Scores 12 listing attributes (see `lib/ai/checklist.ts`).  
**V2 implementation:** After checklist runs, AI generates improvement copy for failed checks (e.g., if description is missing, agent drafts a description; if meta_title is missing, agent drafts one).  
**Trigger:** Owner dashboard "AI Suggestions" page auto-runs checklist on load; AI suggestions button (V2)  
**Inputs:** Checklist score + specific failed checks + existing listing content  
**Output:** One suggestion per failed check — actionable copy the owner can apply  
**Privacy:** Listing name, category, city, current description excerpt only. No PII.

---

#### 2.3 SEO & Visibility Coach Agent

**Phase:** V2  
**Purpose:** Generates SEO-optimized `meta_title` and `meta_description` tailored to the listing's category, city, and business name.  
**Trigger:** "Generate SEO copy" button on the SEO section of the edit page (or via AI Suggestions page)  
**Inputs:** `listing_name`, `category_name`, `city_name`, `current_description` (excerpt, max 500 chars)  
**Output:** `meta_title` (≤60 chars) + `meta_description` (≤160 chars) as two suggestion rows  
**Privacy:** All inputs are publicly visible listing data. No PII.  
**Approval:** Owner previews the generated tags and clicks "Apply" individually.

---

#### 2.4 Social Caption Agent

**Phase:** V2  
**Purpose:** Generates platform-specific captions the owner can copy to share their BLACQList Page on social media.  
**Trigger:** "Generate captions" button on the owner dashboard sharing section  
**Inputs:** `listing_name`, `category_name`, `city_name`, `tagline` (if present), `cta_type` (if present)  
**Output:** One caption per platform: Instagram (≤150 chars), Facebook (≤280 chars), X/Twitter (≤280 chars)  
**Privacy:** All inputs are publicly visible listing data. No PII.  
**Note:** Owner copies caption to clipboard — no direct posting to social platforms.

---

#### 2.5 Marketplace Merchandising Agent

**Phase:** V2  
**Purpose:** Improves marketplace product listing copy. Generates product titles, descriptions, and pricing positioning notes for vendor product listings.  
**Trigger:** "Improve listing" button on product edit page  
**Inputs:** `product_name` (existing or draft), `category_name`, `price_cents`, `current_description` (if any)  
**Output:** Improved `product_name`, `description`, optional pricing note  
**Privacy:** Product catalog data only — no customer data, order history, or seller identity beyond business name.

---

#### 2.6 Review Response Agent

**Phase:** V2  
**Purpose:** Drafts a professional, warm response to a customer review. Output is a starting point — the owner personalizes and approves before it is posted.  
**Trigger:** "Draft response" button beside each approved review in the owner dashboard  
**Inputs:** `review_text`, `rating` (1–5), `listing_name`, `review_sentiment` (derived from rating)  
**Output:** Draft response text (max 300 chars)  
**Privacy:** Review text may contain shopper-written content. Reviewer identity (display_name) is **never** passed to the provider. `reviewer_user_id` is never passed. Review text is the only potentially identifying input — the owner's own listing name is the only business identifier passed.  
**Approval:** Owner edits the draft in a text field before submitting the review response. Response is not posted until the owner submits.

---

#### 2.7 Analytics Explainer Agent

**Phase:** V2  
**Purpose:** Translates the owner's analytics data into a plain-language weekly performance summary.  
**Trigger:** "Explain my analytics" button on the owner analytics page  
**Inputs:** Aggregated counts only — `page_views_7d`, `page_views_30d`, `cta_clicks_30d`, `saves_30d`, `shares_30d` — no individual event records, no user IDs  
**Output:** 2–3 sentence narrative summarizing performance + one actionable tip  
**Privacy:** Only aggregate counts passed — identical to what the owner already sees on their analytics page. No user-level data.

---

### 3. Admin / Platform Agents (5 agents)

These agents assist the admin team in curating the directory, managing content quality, and creating editorial content.

#### 3.1 Directory Curator Agent

**Phase:** V2  
**Purpose:** Automatically scores listing quality and flags low-completeness or potentially problematic listings for admin review. Prioritizes the moderation queue.  
**Trigger:** Nightly background job (V2); manual "Analyze directory" button in admin (foundation placeholder)  
**Inputs:** Listing data (name, category, city, media count, review count, trust_tier, checklist score)  
**Output:** Quality score + flag reason for listings below threshold (added to moderation_queue with `source = 'ai_curator'`)  
**Privacy:** Only public listing data. No user identifiers beyond listing owner_user_id (never passed to provider).

---

#### 3.2 Verification Support Agent

**Phase:** V2  
**Purpose:** Pre-screens claim and verification submissions to give admins a head-start recommendation before manual review.  
**Trigger:** When a new claim or verification submission enters the review queue  
**Inputs:** `claim_method`, `business_name`, `city_name`, `category_name`, `listing_trust_tier` — **never the verification document itself**  
**Output:** Recommendation: `approve_likely`, `review_needed`, `flag_for_review` + reasoning note  
**Privacy:** Verification documents never passed to AI. Only metadata passed. Document review remains fully human.  
**Approval:** Admin reviews the AI recommendation alongside the full submission before taking action.

---

#### 3.3 Collection Builder Agent

**Phase:** V2  
**Purpose:** Suggests listings that should be added to an existing curated collection based on thematic fit.  
**Trigger:** "Get AI suggestions" button on collection edit page  
**Inputs:** `collection_name`, `collection_description`, `existing_listing_names` (up to 10), `city_id` (if city collection), `category_id` (if category collection)  
**Output:** 5–10 listing IDs with a brief fit reason for each  
**Privacy:** Only collection metadata and listing names — no user data, no analytics.  
**Approval:** Admin reviews each suggestion and clicks "Add to collection" individually.

---

#### 3.4 Guide Writer Agent

**Phase:** V2  
**Purpose:** Drafts a new section of a city guide based on the featured listings in that city and category.  
**Trigger:** "Draft section" button in guide editor  
**Inputs:** `city_name`, `category_name`, `featured_listing_names` (up to 8), optional `guide_tone` ('community', 'editorial', 'practical')  
**Output:** Draft guide section (2–4 paragraphs)  
**Privacy:** Only city name, category name, and public listing names — no user data.  
**Approval:** Admin reviews and edits in the guide editor before publishing. No auto-publish.

---

#### 3.5 Social Media Agent

**Phase:** V2  
**Purpose:** Generates platform posts announcing new verified listings, new collections, or editorial highlights for the BLACQList social accounts.  
**Trigger:** "Generate social post" button in admin on verified listing pages or collection pages  
**Inputs:** `listing_name`, `city_name`, `category_name`, `trust_tier`, `tagline` (if present), or `collection_name` + member count  
**Output:** Draft post for Instagram, Facebook, and X — each as a separate suggestion row  
**Privacy:** Only public listing data. No user identifiers.  
**Approval:** Admin edits and posts manually — agent does not connect to social platform APIs.

---

## Privacy Rules (All Agents)

| Rule                          | Detail                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| No PII in prompts             | No email, phone, full address, user_id, reviewer identity, or owner personal information |
| user_id never passed          | Session user is never included in any prompt context                                     |
| Prompts assembled server-side | No prompt construction in client components — always via server-side utility             |
| Review text privacy           | Passed only for Review Response Agent; reviewer display_name and user_id excluded        |
| Spend data anonymized         | Only aggregate totals passed for Community Spend Agent; no individual transactions       |
| Verification docs excluded    | Verification Support Agent uses only metadata — never the document content               |
| Audit trail required          | Every AI API call logged in `ai_generation_requests` before provider is connected        |
| No auto-apply                 | All suggestions require explicit human action to apply                                   |

---

## Suggestion Status Lifecycle

```
created → pending
  → [human approves] → approved
    → [human clicks Apply] → applied
  → [human rejects] → rejected
  → [7 days without action] → expired
```

Rejected and expired suggestions are retained for audit purposes — never deleted.

---

## Implementation Phases Summary

| Phase            | What ships                                                                     |
| ---------------- | ------------------------------------------------------------------------------ |
| Foundation (now) | Data model, checklist, placeholder UI, prompt templates in code — no API calls |
| V2 Mock          | Hardcoded mock suggestions visible in UI; approval workflow active             |
| V2 Provider      | Anthropic API connected server-side; real generation; audit log populated      |
| V3 Autonomous    | Background agent jobs; `ai_agent_runs` table; continuous curation loop         |
