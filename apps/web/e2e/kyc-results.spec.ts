import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * End-to-end tests for the KYC simulator results page.
 *
 * These tests intercept the `/api/sim/runs/*` calls (proxied by Vite to the
 * Fastify backend) and feed the React UI synthetic ScenarioRun payloads so we
 * can verify rendering without running the real backend.
 *
 * Tests target the English locale — we set `vitality.locale` in localStorage
 * before navigation so i18next picks `en` deterministically.
 */

const RUN_ID_SCORED = 'test-run-id';
const RUN_ID_NETWORK_ERROR = 'network-error-id';

/** Pin the UI locale via the same localStorage key i18next reads. */
async function pinLocale(page: Page, locale: 'en' | 'ru') {
  await page.addInitScript((loc) => {
    try {
      window.localStorage.setItem('vitality.locale', loc);
    } catch {
      // ignore
    }
  }, locale);
}

/**
 * Mocked ScenarioRun with two mistakes — one critical (penalty 30) and one
 * minor (penalty 10).
 */
const SCORED_RUN_BODY = {
  id: RUN_ID_SCORED,
  scenarioId: 'kyc',
  status: 'scored',
  score: 60,
  currentStepId: null,
  mistakes: [
    {
      stepId: 'sanctions_check',
      code: 'passed_sanctioned',
      messageKey: 'sim.kyc.sanctions_check.passed_sanctioned',
      penalty: 30,
    },
    {
      stepId: 'risk_score',
      code: 'mismatch',
      messageKey: 'sim.kyc.risk_score.mismatch',
      penalty: 10,
    },
  ],
};

/**
 * Always-on guard: refuse any unmocked /api/** call so the test fails loudly
 * instead of waiting on a real backend that isn't there.
 */
async function blockUnmockedApi(page: Page) {
  await page.route('**/api/**', async (route: Route) => {
    // Routes registered with page.route() are tried in reverse order, so
    // more-specific handlers registered later win. If we get here, no test-
    // specific handler matched.
    await route.fulfill({
      status: 599,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unmocked_route', url: route.request().url() }),
    });
  });
}

test.describe('KYC ResultsView', () => {
  test('renders severity-grouped mistakes with translated text, step title, and -N pts', async ({
    page,
  }) => {
    await pinLocale(page, 'en');
    await blockUnmockedApi(page);

    // More-specific mock registered AFTER the catch-all so it takes precedence.
    await page.route(`**/api/sim/runs/${RUN_ID_SCORED}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SCORED_RUN_BODY),
      });
    });

    await page.goto(`/simulator/kyc/${RUN_ID_SCORED}`);

    // Wait until the results screen renders. The score "60" is shown in a
    // large heading once the scored run is loaded.
    await expect(page.getByText('60', { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });

    // --- Critical section ----------------------------------------------------
    const criticalHeading = page.getByRole('heading', { name: /critical mistake/i });
    await expect(criticalHeading).toBeVisible();

    const criticalSection = criticalHeading.locator('xpath=../..');
    // Translated message (NOT the raw messageKey).
    await expect(
      criticalSection.getByText(/Customer is on the sanctions list but was passed/i),
    ).toBeVisible();
    // Step title (NOT the raw stepId "sanctions_check").
    await expect(
      criticalSection.getByText(/Sanctions\s*&\s*PEP screening/i),
    ).toBeVisible();
    // Penalty rendered as "-30 pts".
    await expect(criticalSection.getByText(/-30\s*pts/)).toBeVisible();

    // Negative assertion: the raw messageKey must NOT leak through.
    await expect(
      page.getByText('sim.kyc.sanctions_check.passed_sanctioned'),
    ).toHaveCount(0);
    // Negative assertion: the raw stepId must NOT appear as bare text.
    await expect(
      page.locator('text=/^sanctions_check$/'),
    ).toHaveCount(0);

    // --- Minor section -------------------------------------------------------
    const minorHeading = page.getByRole('heading', { name: /minor mistake/i });
    await expect(minorHeading).toBeVisible();

    const minorSection = minorHeading.locator('xpath=../..');
    // Translated message body (EN: "Incorrect risk tier. Review the customer
    // profile, sanctions, and PEP status.").
    await expect(
      minorSection.getByText(/Incorrect risk tier/i),
    ).toBeVisible();
    // Risk Score step title (EN: "4. Risk score").
    await expect(
      minorSection.getByText(/Risk\s*score/i),
    ).toBeVisible();
    await expect(minorSection.getByText(/-10\s*pts/)).toBeVisible();

    // No raw key for the minor mistake either.
    await expect(page.getByText('sim.kyc.risk_score.mismatch')).toHaveCount(0);
  });
});

test.describe('Network error toast', () => {
  test('shows translated text from errors.api.internal_error, not "sim 500"', async ({
    page,
  }) => {
    await pinLocale(page, 'en');
    await blockUnmockedApi(page);

    // Server returns a structured 500 with { error: "internal_error" } so
    // jsonOrThrow constructs key "errors.api.internal_error".
    await page.route(`**/api/sim/runs/${RUN_ID_NETWORK_ERROR}`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'internal_error' }),
      });
    });

    await page.goto(`/simulator/kyc/${RUN_ID_NETWORK_ERROR}`);

    // The KycRunPage shows the load-error in a centered card, NOT a [role=alert]
    // toast — toasts are only for per-step submit errors. We assert on the
    // visible card text.
    const errorPanel = page.locator('main').filter({ has: page.locator('.ring-rose-200') });
    await expect(errorPanel).toBeVisible({ timeout: 10_000 });

    // The translated value of errors.api.internal_error (EN).
    await expect(
      errorPanel.getByText(/unexpected error/i),
    ).toBeVisible();

    // Must NOT show the old raw-string formats.
    await expect(page.getByText(/^sim 500$/)).toHaveCount(0);
    await expect(page.getByText('errors.api.internal_error')).toHaveCount(0);
    await expect(page.getByText('errors.network', { exact: true })).toHaveCount(0);
  });

  test('falls back to errors.network when body has no error code', async ({
    page,
  }) => {
    await pinLocale(page, 'en');
    await blockUnmockedApi(page);

    // No JSON body at all — jsonOrThrow's `try` block throws and the catch
    // leaves errorCode at the default 'errors.network'.
    await page.route(`**/api/sim/runs/${RUN_ID_NETWORK_ERROR}-no-body`, async (route) => {
      await route.fulfill({
        status: 502,
        contentType: 'text/plain',
        body: 'Bad Gateway',
      });
    });

    await page.goto(`/simulator/kyc/${RUN_ID_NETWORK_ERROR}-no-body`);

    const errorPanel = page.locator('main').filter({ has: page.locator('.ring-rose-200') });
    await expect(errorPanel).toBeVisible({ timeout: 10_000 });

    // English value of errors.network.
    await expect(
      errorPanel.getByText(/network error/i),
    ).toBeVisible();

    await expect(page.getByText(/^sim 502$/)).toHaveCount(0);
    await expect(page.getByText('errors.network', { exact: true })).toHaveCount(0);
  });
});
