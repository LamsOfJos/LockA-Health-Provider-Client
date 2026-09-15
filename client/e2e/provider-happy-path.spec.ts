import { test, expect } from '@playwright/test';
import { mockFreighter } from './fixtures/freighter';

/**
 * Full cross-page happy-path journey: wallet gate -> connect (mocked) ->
 * search for a patient -> send an access request -> upload a record ->
 * revoke an existing access grant -> confirm every action landed in the
 * Audit Log.
 */
test('provider happy path: connect, request access, upload a record, revoke a grant, and see it all in the audit log', async ({
  page,
}) => {
  await mockFreighter(page);
  await page.goto('/');

  // 1. Land on the wallet gate, connect via the mocked Freighter extension.
  await expect(page.getByRole('heading', { name: 'Connect Wallet to Access Provider Portal' })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Connect Wallet' }).click();
  await expect(page.getByRole('link', { name: 'Patient Search' })).toBeVisible();

  // 2. Search for a patient.
  await page.getByRole('link', { name: 'Patient Search' }).click();
  await page.getByPlaceholder('Passport ID, name, or contact method…').fill('Chidinma');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText('Chidinma Eze')).toBeVisible();

  // 3. Send an access request for that patient.
  await page.getByRole('button', { name: 'Request Access' }).click();
  await expect(page.getByText('Request Access — Chidinma Eze')).toBeVisible();
  await page.getByRole('button', { name: 'Lab Result' }).click();
  await page.getByPlaceholder('Describe why access is needed…').fill('E2E happy-path journey test');
  await page.getByRole('button', { name: 'Send Access Request' }).click();
  await expect(page.getByText('Access request sent to Chidinma Eze')).toBeVisible();

  // 4. Navigate to Records and upload one.
  await page.getByRole('link', { name: 'Medical Records' }).click();
  await page.getByRole('button', { name: 'Add Record' }).click();
  await page.getByPlaceholder('pp_…').fill('pp_3a91ee02');
  await page.getByPlaceholder('Patient display name').fill('Chidinma Eze');
  await page.getByPlaceholder('e.g. Complete Blood Count Panel').fill('E2E Test Upload');
  await page.locator('textarea').fill('Uploaded during the full E2E happy-path spec.');
  await page.getByRole('button', { name: 'Upload & Commit Hash' }).click();
  await expect(page.getByText('Record uploaded and hash committed on-chain')).toBeVisible();
  await expect(page.getByRole('button', { name: 'All Records' })).toHaveClass(/active/);
  await expect(page.getByText('E2E Test Upload')).toBeVisible();

  // 5. Navigate to Access Management and revoke an existing grant.
  await page.getByRole('link', { name: 'Access Management' }).click();
  const tundeCard = page.locator('.glass').filter({ hasText: 'Tunde Balogun' });
  await tundeCard.getByRole('button', { name: 'Revoke' }).click();
  await expect(page.getByText('Access to Tunde Balogun revoked')).toBeVisible();
  await expect(tundeCard.getByRole('button', { name: 'Revoke' })).not.toBeVisible();

  // 6. Navigate to Audit Log and confirm every action above landed there.
  await page.getByRole('link', { name: 'Audit Log' }).click();

  const requestRow = page
    .getByText('Requested access to 1 categories for 30 days', { exact: true })
    .locator('xpath=../..');
  await expect(requestRow).toContainText('Chidinma Eze');
  await expect(requestRow).toContainText('Requested');

  const uploadRow = page.getByText('Uploaded E2E Test Upload', { exact: true }).locator('xpath=../..');
  await expect(uploadRow).toContainText('Chidinma Eze');
  await expect(uploadRow).toContainText('Uploaded');

  const revokeRow = page.getByText('Revoked access to 1 categories', { exact: true }).locator('xpath=../..');
  await expect(revokeRow).toContainText('Tunde Balogun');
  await expect(revokeRow).toContainText('Revoked');
});
