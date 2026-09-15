import { test, expect } from '@playwright/test';
import { FREIGHTER_TEST_ADDRESS, mockFreighter } from './fixtures/freighter';

test.describe('wallet gate', () => {
  test('prompts to install Freighter when the extension is not detected', async ({ page }) => {
    await mockFreighter(page, { installed: false });
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Install Freighter Wallet' })).toBeVisible();
    await expect(page.getByText('No Stellar wallet extension detected.')).toBeVisible();
  });

  test('connects via the mocked Freighter extension and reaches the dashboard', async ({ page }) => {
    await mockFreighter(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Connect Wallet to Access Provider Portal' })).toBeVisible();
    await page.getByRole('main').getByRole('button', { name: 'Connect Wallet' }).click();

    await expect(page.getByText(FREIGHTER_TEST_ADDRESS.slice(0, 6))).toBeVisible();
    await expect(page.getByRole('link', { name: 'Patient Search' })).toBeVisible();
  });
});
