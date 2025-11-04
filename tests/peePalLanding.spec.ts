import { test, expect } from '@playwright/test';

// E2E tests for the PeePal landing component (rendered at `/`).
// Covers: language selector, frequency select + save toast, Find button visibility,
// and Start Reminders permission handling (denied flow).

test.beforeEach(async ({ page }) => {
  // Ensure no persisted permission or language from prior runs
  await page.addInitScript(() => {
    window.localStorage.removeItem('peePalNotificationPermission');
    window.localStorage.removeItem('peePalLang');
    window.localStorage.removeItem('peePalFrequency');
  });
  await page.goto('http://localhost:3000');
});

test('loads and shows title and subtitle', async ({ page }) => {
  const heading = page.getByRole('heading', { name: /PeePal/i });
  await expect(heading).toBeVisible();
  await expect(page.locator('text=Your Smart Bathroom Reminder')).toBeVisible();
});

test('language selector changes UI text', async ({ page }) => {
  // select German
  await page.selectOption('select', 'de');
  // subtitle in German
  await expect(page.locator('text=Deine intelligente Toilettenerinnerung')).toBeVisible();
});

test('change frequency and save shows toast and disables save button', async ({ page }) => {
  // choose 30 minutes
  await page.selectOption('select', '30');

  const saveButton = page.getByRole('button', { name: /Save|Speichern|保存/ });
  await expect(saveButton).toBeEnabled();

  await saveButton.click();

  // toast should appear with saved message (English default)
  await expect(page.locator('text=Reminder set to every 30 minutes')).toBeVisible();

  // after saving, button should be disabled (not dirty)
  await expect(saveButton).toBeDisabled();
});

test('Find Nearest Bathroom button is visible', async ({ page }) => {
  const findBtn = page.getByRole('button', { name: /Find Nearest Bathroom|Nächstes Badezimmer finden|寻找最近的洗手间/i });
  await expect(findBtn).toBeVisible();
  await expect(findBtn).toBeEnabled();
});

test('Start Reminders denied permission shows denied UI', async ({ page }) => {
  // Stub Notification.requestPermission to return 'denied' so we can exercise the denied UI
  await page.addInitScript(() => {
    // @ts-ignore
    window.Notification = window.Notification || {};
    // @ts-ignore
    window.Notification.requestPermission = () => Promise.resolve('denied');
  });

  const startBtn = page.getByRole('button', { name: /Start Reminders|Erinnerungen starten|开始提醒/i });
  await startBtn.click();

  // denied UI should show
  await expect(page.locator('text=Notifications Disabled')).toBeVisible().catch(async () => {
    // also accept German/Chinese variants if language changed
    await expect(page.locator('text=Benachrichtigungen deaktiviert')).toBeVisible();
  });
});

