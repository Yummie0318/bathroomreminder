import { test, expect } from '@playwright/test';

// E2E tests for the Map page (/map)
// - Stubs geolocation and grants permission
// - Verifies header, recenter button, list of suggestions (demo fallback),
//   and that "Open in Maps" / "Navigate to Nearest" open a popup to Google Maps.
//
// Run locally with the dev server running at http://localhost:3000

const GEO = { latitude: 14.6, longitude: 121.0 };

test.beforeEach(async ({ page, context }) => {
  // Clear persisted state and set deterministic language
  await page.addInitScript(() => {
    window.localStorage.removeItem('peePalLang');
    window.localStorage.setItem('peePalLang', 'en');
  });

  // Grant geolocation permission and set a deterministic location
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(GEO as any);

  await page.goto('http://localhost:3000/map');
});

test('renders header, recenter button and map area', async ({ page }) => {
  // Title should be visible
  await expect(page.getByRole('heading', { name: /Find Nearest Bathroom|Nächstes Badezimmer finden|寻找最近的洗手间/i })).toBeVisible();

  // Recenter FAB should be present
  const recenter = page.getByRole('button', { name: /Recenter|回到当前位置|Zentrieren/i });
  await expect(recenter).toBeVisible();

  // Map container (leaflet) should be present in the DOM
  await expect(page.locator('.leaflet-container')).toBeVisible();
});

test('shows nearby suggestions (demo fallback) and "Open in Maps" opens popup', async ({ page }) => {
  // The demo suggestions contain the fallback name used in the page; wait for the exact heading
  // Use a role-based, exact-heading locator to avoid strict-mode collisions when similar
  // names (e.g. "Starbucks SM City Tuguegarao") appear.
  await expect(page.getByRole('heading', { name: 'SM City Tuguegarao', exact: true })).toBeVisible({ timeout: 5000 });

  // Click the first "Open in Maps" button and expect a popup to open
  const openButtons = page.getByRole('button', { name: /Open in Maps|In Karten öffnen|在地图中打开/i });
  await expect(openButtons.first()).toBeVisible();

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    openButtons.first().click(),
  ]);

  // Popup should have loaded a google maps URL
  await expect(popup).not.toBeNull();
  await popup.waitForLoadState();
  expect(popup.url()).toContain('google.com');
});

test('"Navigate to Nearest" primary CTA opens directions popup', async ({ page }) => {
  // Wait for demo suggestions to be present so nearest exists. Use exact heading match
  await expect(page.getByRole('heading', { name: 'SM City Tuguegarao', exact: true })).toBeVisible({ timeout: 5000 });

  // Primary CTA may include an icon; pick the first matching visible button
  const navBtn = page.getByRole('button', { name: /Navigate to Nearest|Navigate to nearest restroom|导航到最近的洗手间|Navigate/i });
  await expect(navBtn.first()).toBeVisible();
  await expect(navBtn.first()).toBeEnabled();

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    navBtn.first().click(),
  ]);

  await popup.waitForLoadState();
  expect(popup.url()).toContain('google.com/maps');
});
