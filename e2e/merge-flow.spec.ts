import { test, expect } from '@playwright/test';
import path from 'path';

const FIXTURES = path.join(import.meta.dirname, 'fixtures', 'files');
const FILE1 = path.join(FIXTURES, 'cities_north.xlsx');
const FILE2 = path.join(FIXTURES, 'cities_south.xlsx');

test.describe('Excel Merge Flow', () => {
  test('upload two files, merge, and download result', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('eXmerg');

    const fileInput = page.locator('input[type="file"]');

    // Upload file 1
    await fileInput.setInputFiles(FILE1);
    await expect(page.getByText('cities_north.xlsx')).toBeVisible();

    // Upload file 2
    await fileInput.setInputFiles(FILE2);
    await expect(page.getByText('cities_south.xlsx')).toBeVisible();

    // Verify file count
    await expect(page.getByText(/2 Dateien|2 files/i)).toBeVisible();

    // Select merge mode "Alles in eine Tabelle"
    await page
      .locator('p')
      .filter({ hasText: /^Alles in eine Tabelle$/ })
      .click();

    // Click the primary merge button (the large green one at the bottom)
    await page
      .locator('button.btn-primary')
      .filter({ hasText: /zusammenführen|merge/i })
      .click();

    // Wait for success message
    await expect(page.getByText(/Merge abgeschlossen|Merge completed/i)).toBeVisible({ timeout: 15_000 });

    // Verify primary download button appears
    await expect(page.getByRole('button', { name: /^Herunterladen$|^Download$/i })).toBeVisible();
  });

  test('file input accepts only spreadsheet formats', async ({ page }) => {
    await page.goto('/');
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute('accept', '.xlsx,.xls,.ods');
  });

  test('app loads with correct title and upload area', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/eXmerg/i);
    await expect(page.locator('h1')).toContainText('eXmerg');
    await expect(page.getByText(/Dateien hinzufügen|Add files/i)).toBeVisible();
    await expect(page.getByText(/MERGE-OPTIONEN|MERGE OPTIONS/i)).toBeVisible();
  });

  test('merge mode selection switches active mode', async ({ page }) => {
    await page.goto('/');

    // Click "Zeilenmatrix" mode card
    await page
      .locator('p')
      .filter({ hasText: /^Zeilenmatrix$/ })
      .click();

    // The radio indicator dot (h-2 w-2 emerald circle) should appear inside the Zeilenmatrix card
    const zeilenmatrixButton = page
      .locator('button')
      .filter({ hasText: /^.*Zeilenmatrix(?!.*Summen).*$/s })
      .first();
    const radioDot = zeilenmatrixButton.locator('div.rounded-full');
    await expect(radioDot).toBeVisible();
  });
});
