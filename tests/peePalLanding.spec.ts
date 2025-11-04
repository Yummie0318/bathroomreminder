import { test, expect } from '@playwright/test';

// Simple E2E smoke test for the PeePal landing component (rendered at `/`)
// Navigates to the app root and checks for the app title and subtitle text.

test('PeePal landing loads and shows title and subtitle', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Check the main heading "PeePal" is visible
  const heading = page.getByRole('heading', { name: /PeePal/i });
  await expect(heading).toBeVisible();

  // Check subtitle text exists on the page
  await expect(page.locator('text=Your Smart Bathroom Reminder')).toBeVisible();
});
