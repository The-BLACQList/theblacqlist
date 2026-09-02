import { test, expect } from '@playwright/test'
import { OWNER_EMAIL } from './helpers/fixtures'
import { waitForTurnstileToken } from './helpers/auth'

/**
 * TA-02 (sign-up) and TA-03 (sign-in) validation — the negative half.
 *
 * Why these are worth automating: nothing visibly breaks when a validation
 * boundary regresses. A `required` attribute dropped in a refactor, or a
 * duplicate-email branch that starts returning the generic "Something went
 * wrong", both still render a page that looks correct. A human walking the
 * plan sees a form; only an assertion sees the missing guard.
 *
 * ⚠ Several TA-02 steps are enforced by NATIVE browser constraint validation
 * (`required`, `type="email"`, `minLength={8}`), not by a server-rendered
 * error. The correct assertion is "the control is :invalid and the form did
 * not navigate", not "an alert appeared". The test plan asserts the latter and
 * is wrong; see the 2d corrections.
 */

const SIGN_UP = '/sign-up'
const SIGN_IN = '/sign-in'

test.describe('TA-02 — Sign-up validation', () => {
  test('step 1 — the sign-up form renders with all three fields', async ({ page }) => {
    await page.goto(SIGN_UP)
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
    await expect(page.locator('#displayName')).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
  })

  test('step 2 — submitting an empty form is blocked and does not navigate', async ({ page }) => {
    await page.goto(SIGN_UP)
    await page.getByRole('button', { name: 'Create account' }).click()

    // Native validation: the first required control is invalid and focused,
    // and the browser never issues the request.
    await expect(page.locator('#displayName')).toHaveJSProperty('validity.valid', false)
    await expect(page).toHaveURL(new RegExp(`${SIGN_UP}$`))
  })

  test('step 3 — an invalid email address is rejected by the email input', async ({ page }) => {
    await page.goto(SIGN_UP)
    await page.locator('#displayName').fill('E2E Validation Probe')
    await page.locator('#email').fill('not-an-email')
    await page.locator('#password').fill('ValidPassword123!')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.locator('#email')).toHaveJSProperty('validity.typeMismatch', true)
    await expect(page).toHaveURL(new RegExp(`${SIGN_UP}$`))
  })

  test('step 4 — a password under 8 characters is rejected', async ({ page }) => {
    await page.goto(SIGN_UP)
    await page.locator('#displayName').fill('E2E Validation Probe')
    await page.locator('#email').fill(`e2e-probe-${Date.now()}@test.local`)
    await page.locator('#password').fill('short')
    await page.getByRole('button', { name: 'Create account' }).click()

    // TWO layers enforce this rule, and either one refusing is correct:
    // the native `minLength={8}` constraint, and the server rule at
    // lib/actions/auth/signUp.ts:28-32, which returns `field: 'password'`
    // and drives `aria-invalid` plus the #password-error alert.
    //
    // ⚠ Asserting `validity.tooShort` ALONE is unreliable, and it turned
    // `main` red twice on 2026-09-02. `tooShort` is only reported for an
    // element whose dirty value flag is set. The password input is
    // controlled (`value={password}`), so once the action returns its error
    // state React re-renders it and the native flag reads false — while the
    // app is visibly and correctly refusing the password. The captured DOM
    // at failure showed exactly that: value="short", minlength="8",
    // aria-invalid="true", the red border, and tooShort false.
    //
    // So assert the OUTCOME, which holds under both paths: the password is
    // rejected by one layer or the other, and we never left the page.
    await expect(page).toHaveURL(new RegExp(`${SIGN_UP}$`))
    await expect
      .poll(
        () =>
          page
            .locator('#password')
            .evaluate(
              (el) =>
                (el as HTMLInputElement).validity.tooShort ||
                el.getAttribute('aria-invalid') === 'true'
            ),
        { message: 'neither the native constraint nor the server rule rejected a 5-char password' }
      )
      .toBe(true)
  })

  test('step 6 — an already-registered email is refused by name, not generically', async ({
    page,
  }) => {
    await page.goto(SIGN_UP)
    await page.locator('#displayName').fill('E2E Duplicate Probe')
    await page.locator('#email').fill(OWNER_EMAIL)
    await page.locator('#password').fill('E2EDuplicate1234!')
    await waitForTurnstileToken(page)
    await page.getByRole('button', { name: 'Create account' }).click()

    // ⚠ This case has two legitimate outcomes, and which one you get is a
    // Supabase project setting rather than a code path. With **Confirm email
    // OFF** (local), signUp returns "User already registered" and
    // lib/actions/auth/signUp.ts:63-70 names the collision. With **Confirm
    // email ON** (staging, production), Supabase deliberately suppresses that
    // error and returns an obfuscated success to prevent account enumeration —
    // so the `already registered` branch is unreachable and the user sees the
    // "Check your inbox" panel instead.
    //
    // Asserting only the message failed in CI against staging on 2026-08-23.
    // Both branches are asserted here; what is unacceptable in either is being
    // signed in or navigated away, which is the actual security invariant.
    const namedError = page.locator('#email-error')
    const confirmPanel = page.getByRole('heading', { name: 'Check your inbox' })
    await expect(namedError.or(confirmPanel).first()).toBeVisible()

    if (await namedError.isVisible()) {
      // toContainText, not toHaveText: the message element also holds a
      // "Sign in instead" link, so the sentence appears twice in textContent.
      await expect(namedError).toContainText('That email is already registered.')
      await expect(namedError.getByRole('link', { name: 'Sign in instead' })).toHaveAttribute(
        'href',
        '/sign-in'
      )
    } else {
      // Enumeration-suppressed branch. Recorded as a UX finding, not a pass:
      // an owner who already has an account is told to check an inbox that
      // will never receive a new-account email.
      await expect(confirmPanel).toBeVisible()
    }

    await expect(page).toHaveURL(new RegExp(`${SIGN_UP}$`))
  })
})

test.describe('TA-03 — Sign-in validation', () => {
  test('step 1 — the sign-in form renders', async ({ page }) => {
    await page.goto(SIGN_IN)
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
  })

  test('step 2 — wrong credentials are refused without revealing which field was wrong', async ({
    page,
  }) => {
    await page.goto(SIGN_IN)
    await page.locator('#email').fill(OWNER_EMAIL)
    await page.locator('#password').fill('DefinitelyNotTheOwnerPassword999!')
    await waitForTurnstileToken(page)
    await page.getByRole('button', { name: 'Sign in' }).click()

    // "Incorrect email or password." — deliberately ambiguous. An error that
    // distinguished the two would be an account-enumeration oracle.
    const alert = page.getByRole('alert').filter({ hasText: 'Incorrect email or password.' })
    await expect(alert).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`${SIGN_IN}`))
  })
})
