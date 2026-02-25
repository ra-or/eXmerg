import { test, expect } from '@playwright/test';
import path from 'path';

const FIXTURES = path.join(import.meta.dirname, 'fixtures', 'files');
const FILE1 = path.join(FIXTURES, 'cities_north.xlsx');
const FILE2 = path.join(FIXTURES, 'cities_south.xlsx');

/** Helper: upload both test files and wait for the file list to show them. */
async function uploadBothFiles(page: import('@playwright/test').Page) {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(FILE1);
  await expect(page.getByText('cities_north.xlsx')).toBeVisible();
  await fileInput.setInputFiles(FILE2);
  await expect(page.getByText('cities_south.xlsx')).toBeVisible();
  await expect(page.getByText(/2 Dateien|2 files/i)).toBeVisible();
}

/** Helper: click the primary merge button and wait for completion. */
async function runMerge(page: import('@playwright/test').Page) {
  await page
    .locator('button.btn-primary')
    .filter({ hasText: /zusammenführen|merge/i })
    .click();
  await expect(page.getByText(/Merge abgeschlossen|Merge completed/i)).toBeVisible({ timeout: 15_000 });
}

test.describe('Core Merge Flow', () => {
  test('upload two files, merge "Alles in eine Tabelle", download', async ({ page }) => {
    await page.goto('/');
    await uploadBothFiles(page);

    await page
      .locator('p')
      .filter({ hasText: /^Alles in eine Tabelle$/ })
      .click();
    await runMerge(page);

    await expect(page.getByRole('button', { name: /^Herunterladen$|^Download$/i })).toBeVisible();
  });

  test('merge with "Eine Datei = ein Sheet" mode', async ({ page }) => {
    await page.goto('/');
    await uploadBothFiles(page);

    await page
      .locator('p')
      .filter({ hasText: /^Eine Datei = ein Sheet$/ })
      .click();
    await runMerge(page);

    await expect(page.getByRole('button', { name: /^Herunterladen$|^Download$/i })).toBeVisible();
  });

  test('merge with "Konsolidierung + Einzelne Sheets" mode', async ({ page }) => {
    await page.goto('/');
    await uploadBothFiles(page);

    await page
      .locator('p')
      .filter({ hasText: /^Konsolidierung \+ Einzelne Sheets$/ })
      .click();
    await runMerge(page);

    await expect(page.getByRole('button', { name: /^Herunterladen$|^Download$/i })).toBeVisible();
  });

  test('merge with "Zeilenmatrix" mode', async ({ page }) => {
    await page.goto('/');
    await uploadBothFiles(page);

    await page
      .locator('p')
      .filter({ hasText: /^Zeilenmatrix$/ })
      .click();
    await runMerge(page);

    await expect(page.getByRole('button', { name: /^Herunterladen$|^Download$/i })).toBeVisible();
  });
});

test.describe('UI Interactions', () => {
  test('app loads with correct title and upload area', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/eXmerg/i);
    await expect(page.locator('h1')).toContainText('eXmerg');
    await expect(page.getByText(/Dateien hinzufügen|Add files/i)).toBeVisible();
    await expect(page.getByText(/MERGE-OPTIONEN|MERGE OPTIONS/i)).toBeVisible();
  });

  test('file input accepts only spreadsheet formats', async ({ page }) => {
    await page.goto('/');
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute('accept', '.xlsx,.xls,.ods');
  });

  test('merge mode selection switches active mode', async ({ page }) => {
    await page.goto('/');

    await page
      .locator('p')
      .filter({ hasText: /^Zeilenmatrix$/ })
      .click();

    const zeilenmatrixButton = page
      .locator('button')
      .filter({ hasText: /^.*Zeilenmatrix(?!.*Summen).*$/s })
      .first();
    const radioDot = zeilenmatrixButton.locator('div.rounded-full');
    await expect(radioDot).toBeVisible();
  });

  test('output format can be switched between xlsx and ods', async ({ page }) => {
    await page.goto('/');

    const odsButton = page.locator('button[role="radio"]').filter({ hasText: '.ods' });
    await odsButton.click();
    await expect(odsButton).toHaveAttribute('aria-checked', 'true');

    const xlsxButton = page.locator('button[role="radio"]').filter({ hasText: '.xlsx' });
    await xlsxButton.click();
    await expect(xlsxButton).toHaveAttribute('aria-checked', 'true');
    await expect(odsButton).toHaveAttribute('aria-checked', 'false');
  });

  test('language toggle switches between DE and EN', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Dateien hinzufügen/i)).toBeVisible();

    // Click the English flag
    const enToggle = page.locator('button').filter({ hasText: /🇬🇧/ });
    if (await enToggle.isVisible()) {
      await enToggle.click();
      await expect(page.getByText(/Add files/i)).toBeVisible();

      // Switch back to German
      const deToggle = page.locator('button').filter({ hasText: /🇩🇪/ });
      await deToggle.click();
      await expect(page.getByText(/Dateien hinzufügen/i)).toBeVisible();
    }
  });
});

test.describe('API Health', () => {
  test('backend health endpoint returns ok', async ({ request }) => {
    const response = await request.get('http://localhost:3004/api/health');
    expect(response.status()).toBe(200);
    expect(await response.text()).toBe('ok');
  });
});
