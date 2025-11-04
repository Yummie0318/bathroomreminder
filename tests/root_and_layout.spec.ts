import { test, expect } from '@playwright/test';

// Basic smoke tests for the app root (src/app/page.tsx) and shared layout (src/app/layout.tsx)
// - ensures the landing page renders
// - ensures layout/footer content is present

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
  await page.goto('http://localhost:3000');
});

test('home page renders PeePal landing with title and start button', async ({ page }) => {
  const heading = page.getByRole('heading', { name: /PeePal/i });
  await expect(heading).toBeVisible();

  const startBtn = page.getByRole('button', { name: /Start Reminders|Erinnerungen starten|开始提醒/i });
  await expect(startBtn).toBeVisible();
});

test('layout footer shows built with copy', async ({ page }) => {
  // footer text comes from the layout or component translations
  await expect(page.locator('text=Built with').first()).toBeVisible();
  // also check PeePal brand is visible somewhere in footer/header
  await expect(page.locator('text=PeePal').first()).toBeVisible();
});
