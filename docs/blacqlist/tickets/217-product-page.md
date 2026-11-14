# Ticket 217: The product page, the shop is the first row

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 211, 213, 214, 215 (for the working list); for seller items 221 (variants, stock, purchasable view) and 225 (cart)
**Gates:** no migration. Behind `FEATURE_MARKETPLACE_OPEN`. Outbound links keep the existing CTA click count and add no affiliate parameters (Q7 A).
**Decision record:**
- **Amended 2026-11-13 (one cart):** seller items get a real buy box and no outbound Buy. See "Amendment" below, which overrides the seller-item parts of Scope. The round 3 board R3-1 sets the buy box layout.
- S3 E (founder, 2026-11-08), picked over C and D in round 2.
- Q2 B, price ranges on directory items.
- The States board, stockist out of date.

## Amendment, 2026-11-13: one cart

This overrides the seller-item parts of Scope and Checks below. The directory-item parts stand.

- **The seller item is only shown when it's purchasable,** per the 221 view: active, approved, in stock or unlimited, a seller with payouts on, Growth or above, and `FEATURE_CART` plus `FEATURE_MARKETPLACE_OPEN` on.
- **The buy box,** as drawn on round 3 board R3-1. Its contents:
  - the price, with tabular figures;
  - the variant pickers, which come from `product_variants`. A sold-out variant is disabled, and the label reads "Sold out";
  - a quantity stepper, capped at the stock on hand for tracked variants;
  - **Add to cart**, which uses 225 and shows a toast with View cart;
  - **Buy now**, which adds the item and goes to checkout;
  - "Sold and shipped by {shop}", "Ships in {n} to {m} business days" from the shop's shipping profile, and the shipping price or "Free shipping over {x}";
  - "Returns: {policy}", linking to the shop's policy;
  - for a digital item: "Digital download · {format}", and no shipping line.
- **There's no outbound Buy and no `external_purchase_url` for products.** The old "Future · Add to cart" flag is gone. "Meet the maker" still links to the business page.
- **Where to buy** stays for directory items. For a seller item it shows the seller's other ways to get the item, such as Near you pickup, if the seller offers it. The Online tab lists no third-party sites for seller items.
- **Photos.** The gallery uses `product_images` from 222. A physical item never shows an image that failed provenance.
- **"Report this listing"** sits under the buy box. Its reasons:
  - Photo looks AI-made
  - Not as pictured
  - Prohibited item
  - Counterfeit or IP
  - Suspicious seller

  It writes a `moderation_queue` row, per 223. This is also the INFORM report link.
- **The INFORM seller block** shows the seller's name, address and contact once they pass $20k in 12 months, per 224.
- **Sold out or no longer purchasable.** The page returns 200 with `noindex`, "This item is no longer available", and "More from {shop}" showing up to 6 purchasable items. It never returns a 404, so shared links keep working. Restocking brings the full page back.

**Amended checks:**
- A seller item with every variant at 0 shows the no-longer-available page with `noindex`, and isn't in the sitemap.
- Add to cart with a quantity above stock is capped, and the box shows "{n} left".
- No product page contains an outbound purchase link for a seller item.

## Why

One template serves both seller items and directory items. Where to buy is the page, and for a seller item the seller's own shop is the first thing the shopper sees under it.

## Scope

In, as drawn on S3-E:
- **The route.** `/marketplace/products/[slug]` resolves a seller product first, then a directory product. Slugs are unique across both, from 211.
- **The hero:**
  - the image;
  - the department chip, H1 with name and size, the description, and "Made by {brand} · {city} · Meet the maker". On a seller item, "Meet the maker" links to the business page;
  - a seller item shows "From {price}". A directory item shows the range, with "Price range from the brand. Stores set their own prices.";
  - **Add to my list**, which adds the item to the 215 working list, with a toast reading "Added to your list";
  - **See where to buy**, which jumps to the section.
  There's **no buy box**.
- **Where to buy:**
  - H2 "Where to buy" with "Stock lists come from the brand and can be out of date.";
  - tabs, as a real tablist with arrow keys: **Your stores · {n}**, **Other stores near you · {n}**, **Online · {n}**;
  - the default tab:
    - **a seller item opens on Online;**
    - **a directory item opens on Your stores,** or on Online when the shopper has no stores picked.
- **The Online tab, seller item.** The seller's own shop is the top row, on a light panel. It shows:
  - "{shop} · Ships to you";
  - "Sold and shipped by {shop} · Opens their site";
  - the price;
  - **Buy** with the external-link icon, which opens `external_purchase_url` in a new tab and counts through `/api/marketplace/cta-click`;
  - a "Future · Add to cart" flag.
  Other online stockists follow, each with "Price on their site" and **Open**.
- **The store tabs.** Each row shows "{store} · {street}" and "{distance} mi · Reported by the brand · updated {date}", with **Directions** and "Tell us it's not there".
  - Directions opens Google Maps with the name and address, using the `directionsUrl` from #249.
  - Stale rows show amber, per 213.
  - A picked store that isn't on the brand's list shows a dashed icon and "Not on {brand}'s stockist list yet." with **Ask {store} to carry it**. That link opens the share sheet, or copies a short note the shopper can send to the store themselves. We store and send nothing.
- **The map,** on the right at 1024px and up. It uses MapLibre from N7, lazy-loaded: the shopper's picked stores are pinned, and other stores are hollow pins. On a phone there's no map in v1, and the rows carry the distance.
- **The "Later" note:** "Live shelf checks from store partners come in a later layer. Until then this list is what the brand tells us."
- **On a phone:** the image and title side by side, then the price panel, Where to buy with the short tab names "Your stores · Nearby · Online", the rows, and **Add to my list** in a bottom bar.
- **States:**
  - no stockists yet: "No stores have been reported for this one yet." with **Suggest a store**, which uses the 216 suggestion form;
  - no stores picked: **Pick your stores**, which opens the 214 sheet;
  - couldn't load: Try again.

Out:
- A cart, beyond the "Future" flag (release item 38).
- Live stock.
- Claiming, which is 212. This page only carries its "Is this your brand? Claim it" link.

## Checks

- A seller item opens on Online with the seller's shop first. A directory item opens on Your stores. A directory item with no picked stores opens on Online.
- **Buy** opens a new tab, records one CTA click, and its URL has no added parameters.
- A directory item never shows a single price or a Buy button.
- The tabs work with the keyboard: arrow keys move between tabs, and Enter or Space selects.
- The map is lazy-loaded and doesn't block LCP. With reduced motion on, it doesn't fly to pins.
- No "Black-owned" badge, no em dashes and no parentheses in the page's strings.
