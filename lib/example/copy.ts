/**
 * The two strings a visitor reads on a sample page that the fixtures do not
 * own (ticket 184). Pure, so the Playwright spec and the components read one
 * source and the wording cannot drift between the page and the test.
 */

/** The banner above every sample page. Keeps the figures inside the no-fabrication rule. */
export const EXAMPLE_BANNER_TEXT =
  'Test Business 123 is not a real business. Every name, review, number and photo is illustrative.'

/** Shown by ExampleLinkGuard when a link that would leave the sample page is clicked. */
export const EXAMPLE_LINK_NOTE = 'Links are off on the sample page.'

/**
 * Whether a link may work on a sample page: in-page anchors and the sample
 * pages themselves. Everything else — the business's site, tel:, mailto:,
 * sign-in, the related cards — is held so a visitor cannot leave through a
 * link that points at a business that does not exist.
 */
export function isAllowedExampleHref(href: string): boolean {
  if (href.startsWith('#')) return true
  if (href === '/example') return true
  return (
    href.startsWith('/example/') || href.startsWith('/example?') || href.startsWith('/example#')
  )
}
