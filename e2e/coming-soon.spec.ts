import { test, expect, type Page } from '@playwright/test'

/**
 * Pre-launch /coming-soon (marketing OS capture.md, 2026-10-04).
 *
 *   R1  the approved copy is on the page, and the owner headline row is off
 *   R3  the role field is optional and nothing is preselected
 *   R5  UTMs survive the / -> /coming-soon bounce (only with the gate on)
 *   R6  coming_soon_view fires with the landing UTMs; a rejected address fires
 *       launch_list_submit_error and keeps what was typed
 *   R7  the consent line links to /privacy, which the gate lets through
 *
 * Nothing here writes a subscriber. The only submission is a malformed
 * address, which the action rejects before any insert. The success path (the
 * confirmation and the share button) needs a database and is covered by the
 * unit tests; it is skipped here unless E2E_LAUNCH_LIST_DB=1.
 */

type Beacon = { event_name: string; properties?: Record<string, unknown> }

/** Forces track() onto fetch, then captures every analytics event the page posts. */
async function captureAnalytics(page: Page): Promise<Beacon[]> {
  const events: Beacon[] = []
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'sendBeacon', { value: undefined, configurable: true })
  })
  await page.route('**/api/analytics/event', async (route) => {
    try {
      events.push(JSON.parse(route.request().postData() ?? '{}') as Beacon)
    } catch {
      // ignore a malformed body
    }
    await route.fulfill({ status: 204, body: '' })
  })
  return events
}

test.describe('/coming-soon', () => {
  test('shows the approved copy, with the owner headline off by default (R1)', async ({ page }) => {
    await page.goto('/coming-soon')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find & Be Found.')
    await expect(
      page.getByText(
        'Black-owned businesses across six cities, and the Ally businesses beside them, all in one place. The BLACQList opens soon. Join the launch list to hear first.'
      )
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Join the launch list' })).toBeVisible()
    await expect(page.getByText(/^Own a business in Atlanta, Chicago, Houston, Los Angeles, New Orleans or DC\?/)).toBeVisible()
    await expect(page.getByText("Not listed yet? You'll be able to create your Page, free.")).toBeVisible()
    await expect(page.getByText('Ally businesses and Ally supporters are welcome on BLACQList too.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Follow @theblacqlist' })).toHaveAttribute(
      'href',
      'https://www.instagram.com/theblacqlist/'
    )

    // COMING_SOON_OWNER_HEADLINE is unset here, so neither variant renders.
    await expect(page.getByText('You deserve a better page.')).toHaveCount(0)
    await expect(page.getByText('Your Black-owned business deserves a better Page.')).toHaveCount(0)
  })

  test('the role question is optional with nothing preselected (R3)', async ({ page }) => {
    await page.goto('/coming-soon')

    const group = page.getByRole('group', { name: 'Which describes you?' })
    const owner = group.getByRole('radio', { name: 'I own a business' })
    const supporter = group.getByRole('radio', { name: "I'm here to find businesses" })
    await expect(owner).not.toBeChecked()
    await expect(supporter).not.toBeChecked()
    await expect(owner).not.toHaveAttribute('required', /.*/)

    await group.getByText('I own a business').click()
    await expect(owner).toBeChecked()
    await group.getByText("I'm here to find businesses").click()
    await expect(supporter).toBeChecked()
    await expect(owner).not.toBeChecked()
  })

  test('the consent line links to the Privacy Policy, and it opens (R7)', async ({ page }) => {
    await page.goto('/coming-soon')

    await expect(page.getByText("Drop your email and we'll let you know the moment we go live.")).toBeVisible()
    const privacy = page.getByRole('link', { name: 'Privacy Policy' })
    await expect(privacy).toHaveAttribute('href', '/privacy')
    await privacy.click()
    await expect(page).toHaveURL(/\/privacy$/)
  })

  test('fires coming_soon_view with the landing UTMs (R6)', async ({ page }) => {
    const events = await captureAnalytics(page)
    await page.goto('/coming-soon?utm_source=instagram&utm_medium=social&utm_campaign=pre-launch&utm_content=bio-link')

    await expect.poll(() => events.filter((e) => e.event_name === 'coming_soon_view').length).toBe(1)
    expect(events.find((e) => e.event_name === 'coming_soon_view')?.properties).toMatchObject({
      utm_source: 'instagram',
      utm_medium: 'social',
      utm_campaign: 'pre-launch',
      utm_content: 'bio-link',
    })
  })

  test('a rejected address keeps what was typed and fires launch_list_submit_error (R6)', async ({ page }) => {
    const events = await captureAnalytics(page)
    await page.goto('/coming-soon')

    const email = page.getByLabel('Email address')
    await email.fill('not-an-email')
    await page.getByRole('group', { name: 'Which describes you?' }).getByText('I own a business').click()
    await page.getByRole('button', { name: 'Join the launch list' }).click()

    // #subscribe-error, not getByRole('alert'): Next's route announcer is also
    // an alert. The long timeout covers the rate-limit ledger lookup, which
    // fails open but can take seconds when no database is reachable.
    await expect(page.locator('#subscribe-error')).toHaveText('Please check that email address.', {
      timeout: 30_000,
    })
    // Controlled inputs: React 19's post-action reset must not wipe these.
    await expect(email).toHaveValue('not-an-email')
    await expect(page.getByRole('radio', { name: 'I own a business' })).toBeChecked()

    await expect
      .poll(() => events.find((e) => e.event_name === 'launch_list_submit_error')?.properties)
      .toMatchObject({ error_type: 'invalid_email' })
  })

  test('the gate keeps UTMs through the bounce from / (R5)', async ({ page }) => {
    test.skip(process.env.COMING_SOON_MODE !== 'true', 'needs COMING_SOON_MODE=true on the server')

    await page.goto('/?utm_source=instagram&utm_campaign=pre-launch&fbclid=drop-me')
    const url = new URL(page.url())
    expect(url.pathname).toBe('/coming-soon')
    expect(Object.fromEntries(url.searchParams)).toEqual({ utm_source: 'instagram', utm_campaign: 'pre-launch' })
  })

  test('a successful signup shows the confirmation and the share button (R4)', async ({ page }) => {
    test.skip(process.env.E2E_LAUNCH_LIST_DB !== '1', 'writes a launch_subscribers row; opt in with E2E_LAUNCH_LIST_DB=1')

    await page.goto('/coming-soon')
    await page.getByLabel('Email address').fill(`e2e-${Date.now()}@example.test`)
    await page.getByRole('button', { name: 'Join the launch list' }).click()

    await expect(page.getByTestId('launch-list-confirmation')).toContainText("You're on the list.")
    await expect(page.getByTestId('launch-list-share')).toBeVisible()
  })
})
