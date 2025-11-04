import { test, expect } from '@playwright/test';

// E2E tests for the Dashboard page at /dashboard
// Covers: header text, play/pause controls, settings modal interactions (language + frequency)

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem('peePalNotificationPermission');
    window.localStorage.removeItem('peePalLang');
    window.localStorage.removeItem('peePalFrequency');
    window.localStorage.removeItem('peePalIsRunning');
    window.localStorage.removeItem('peePalLastStart');
  });
  await page.goto('http://localhost:3000/dashboard');
});

test('dashboard loads and shows title and subtitle', async ({ page }) => {
  const heading = page.getByRole('heading', { name: /PeePal/i });
  await expect(heading).toBeVisible();
  await expect(page.locator('text=Active Reminder')).toBeVisible();
});

test('resume -> pause -> resume control toggles', async ({ page }) => {
  // initial state should show Resume (not running)
  const resumeBtn = page.getByRole('button', { name: /Resume|Fortsetzen|继续/i });
  await expect(resumeBtn).toBeVisible();

  await resumeBtn.click();
  // pause button should appear
  const pauseBtn = page.getByRole('button', { name: /Pause|Pause|暂停/i });
  await expect(pauseBtn).toBeVisible();

  await pauseBtn.click();
  await expect(resumeBtn).toBeVisible();
});

test('find bathroom and send local reminder buttons exist', async ({ page }) => {
  const findBtn = page.getByRole('button', { name: /Find Nearest Bathroom|Nächstes Badezimmer finden|寻找最近的洗手间/i });
  await expect(findBtn).toBeVisible();
  await expect(findBtn).toBeEnabled();

  const sendLocal = page.getByRole('button', { name: /Send Local Reminder|Lokale Erinnerung senden|发送本地提醒/i });
  await expect(sendLocal).toBeVisible();
  await expect(sendLocal).toBeEnabled();
});

test('open settings modal, change language to German, change frequency and close', async ({ page }) => {
  const settingsBtn = page.getByLabel('Settings');
  await settingsBtn.click();

  // modal should show
  const modalHeading = page.getByRole('heading', { name: /Settings|Einstellungen|设置/i });
  await expect(modalHeading).toBeVisible();

  // change language to German via select inside modal
  const langSelect = page.locator('select').filter({ hasText: /English|Deutsch|中文/ });
  await langSelect.selectOption('de');

  // heading text should update to German
  await expect(page.locator('text=Einstellungen')).toBeVisible();

  // change frequency slider value to 30 and verify the displayed value updates
  const range = page.locator('input[type=range]').first();
  // Update the range value and dispatch input/change events so React picks it up.
  // Use InputEvent with composed:true to better emulate user interaction.
  await range.evaluate((el) => {
    (el as HTMLInputElement).value = '30';
    el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true } as any));
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true } as any));
  });

  // Wait for the displayed value to update (motion span)
  await expect(page.locator('text=30m')).toBeVisible({ timeout: 10000 });

  // click Done to close settings
  const doneBtn = page.getByRole('button', { name: /Done|Fertig|完成/i });
  await doneBtn.click();

  // modal should be gone
  await expect(page.locator('text=Einstellungen')).toHaveCount(0);
});
