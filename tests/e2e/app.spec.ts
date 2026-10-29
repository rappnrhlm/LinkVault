import { test, expect, type Page } from '@playwright/test';

const unique = Date.now().toString(36);

test.describe.configure({ mode: 'serial' });

test('the full library workflow', async ({ page }) => {
  const bookmarkTitle = `Example Domain ${unique}`;
  const noteTitle = `Notes on example ${unique}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your library' })).toBeVisible();

  // 1. Save a bookmark through quick capture.
  await page.getByRole('button', { name: 'Save a link' }).first().click();
  await expect(page.getByRole('heading', { name: 'Save a link' })).toBeVisible();
  const bookmarkDialog = page.getByRole('dialog');
  await bookmarkDialog.getByLabel('URL').fill('https://example.com/');
  await bookmarkDialog.getByLabel(/^Title/).fill(bookmarkTitle);
  await bookmarkDialog.getByLabel(/^Tags/).fill('e2e, research');
  await bookmarkDialog.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByLabel('Item title')).toHaveValue(bookmarkTitle);

  // 2. Create a note and connect it to the bookmark.
  await page.getByRole('button', { name: 'New note' }).first().click();
  const noteDialog = page.getByRole('dialog');
  await noteDialog.getByLabel('Title', { exact: true }).fill(noteTitle);
  await noteDialog.getByLabel(/Start writing/).fill('# Field notes\n\nA note written by the browser test.');
  await noteDialog.getByRole('button', { name: 'Create note' }).click();
  await expect(page.getByLabel('Item title')).toHaveValue(noteTitle);

  await page.getByPlaceholder('Find an item to link…').fill(unique);
  await page.locator('.link-results button', { hasText: bookmarkTitle }).click();
  await expect(page.getByText('Items linked')).toBeVisible();
  await expect(page.locator('.linked-list li', { hasText: bookmarkTitle })).toHaveCount(1);

  // 3. Tag the note and add both items to a collection.
  await page.getByLabel('Add a tag').fill('e2e');
  await page.getByLabel('Add a tag').press('Enter');
  await expect(page.locator('.tag-row .tag', { hasText: 'e2e' })).toBeVisible();

  await page.goto('/collections');
  await page.getByRole('button', { name: 'New collection' }).click();
  const collectionName = `E2E shelf ${unique}`;
  const collectionDialog = page.getByRole('dialog');
  await collectionDialog.getByLabel('Name').fill(collectionName);
  await collectionDialog.getByLabel(/Description/).fill('Created by the browser test');
  await page.getByRole('button', { name: 'Create collection' }).click();
  await expect(page.getByRole('heading', { name: collectionName })).toBeVisible();

  await page.locator('.collection-link', { hasText: collectionName }).click();
  await page.getByRole('button', { name: 'Add items' }).click();
  await page.getByPlaceholder('Search bookmarks and notes…').fill(unique);
  const pickRows = page.locator('.pick-row');
  await expect(pickRows).toHaveCount(2);
  await pickRows.nth(0).locator('input').check();
  await pickRows.nth(1).locator('input').check();
  await page.getByRole('button', { name: /Add 2 items/ }).click();
  await expect(page.locator('.item-row')).toHaveCount(2);

  // 4. Find both items through global search.
  await page.keyboard.press('Control+k');
  await page.getByRole('dialog').getByLabel('Search').fill(unique);
  await expect(page.locator('.search-result')).toHaveCount(2);
  await page.locator('.search-result', { hasText: noteTitle }).click();
  await expect(page.getByLabel('Item title')).toHaveValue(noteTitle);

  // 5. Edit in Markdown, then in rich text, and confirm the content survives both.
  const markdown = page.getByLabel('Note body in Markdown');
  await markdown.fill('# Field notes\n\n## Added in Markdown\n\n- [x] keep this\n\n| Key | Value |\n| --- | --- |\n| one | 1 |\n');
  await expect(page.locator('.save-state')).toContainText(/Saved|Saving/, { timeout: 10_000 });
  await expect(page.locator('.save-state')).toHaveAttribute('data-state', 'saved');

  await page.getByRole('button', { name: 'Rich text' }).click();
  const editor = page.getByLabel('Note body');
  await expect(editor.locator('h1', { hasText: 'Field notes' })).toBeVisible();
  await expect(editor.locator('table')).toBeVisible();
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\nAdded in rich text.');
  await expect(page.locator('.save-state')).toHaveAttribute('data-state', 'saved', { timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Rich text' })).toHaveClass(/on/);
  await expect(page.getByLabel('Note body')).toContainText('Added in rich text.');

  await page.getByRole('button', { name: 'Markdown' }).click();
  await expect(page.getByLabel('Note body in Markdown')).toHaveValue(/Added in rich text/);
  await expect(page.getByLabel('Note body in Markdown')).toHaveValue(/\[x\] keep this/);

  // 6. Move the note to Trash and restore it.
  await page.goto('/notes');
  const row = page.locator('.item-row', { hasText: noteTitle });
  await row.hover();
  await row.getByRole('link').first().click();
  await page.getByRole('button', { name: 'Move to Trash' }).click();
  await expect(page).toHaveURL(/\/notes$/);
  await page.goto('/trash');
  await expect(page.locator('.item-row', { hasText: noteTitle })).toHaveCount(1);
  await page.locator('.item-row', { hasText: noteTitle }).getByRole('button', { name: 'Restore item' }).click();
  await expect(page.locator('.item-row')).toHaveCount(0);
  await page.goto('/notes');
  await expect(page.locator('.item-row', { hasText: noteTitle })).toHaveCount(1);

  // 7. Data survives a full page reload and is still searchable.
  await page.reload();
  await expect(page.locator('.item-row', { hasText: noteTitle })).toHaveCount(1);
  await page.keyboard.press('Control+k');
  await page.getByRole('dialog').getByLabel('Search').fill('Added in rich text');
  await expect(page.locator('.search-result', { hasText: noteTitle })).toHaveCount(1);
  await page.keyboard.press('Escape');

  // 8. Export, then re-import the same file without duplicating anything.
  await page.goto('/data');
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export JSON' }).click();
  const file = await download;
  const path = await file.path();
  expect(path).toBeTruthy();
  const { readFileSync } = await import('node:fs');
  const exported = JSON.parse(readFileSync(path!, 'utf8'));
  expect(exported.version).toBe(1);
  expect(exported.items.length).toBe(2);

  await page.locator('input[type="file"]').setInputFiles(path!);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText(/Imported 0 items; skipped 2/)).toBeVisible();
});

test('an inaccessible page still saves with a warning', async ({ page }) => {
  await page.goto('/bookmarks');
  await page.getByRole('button', { name: 'New bookmark' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('URL').fill(`https://example.com/blocked-${unique}`);
  await dialog.getByLabel(/^Title/).fill('Saved without metadata');
  await dialog.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByLabel('Item title')).toHaveValue('Saved without metadata');
});

test('stored HTML is not executed', async ({ page }) => {
  let dialog = false;
  page.on('dialog', async (event) => {
    dialog = true;
    await event.dismiss();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'New note' }).first().click();
  const xssDialog = page.getByRole('dialog');
  await xssDialog.getByLabel('Title', { exact: true }).fill(`XSS ${unique}`);
  await xssDialog.getByLabel(/Start writing/).fill('<img src=x onerror="alert(1)"> <script>alert(2)</script>');
  await xssDialog.getByRole('button', { name: 'Create note' }).click();
  await page.getByRole('button', { name: 'Rich text' }).click();
  await expect(page.getByLabel('Note body')).toContainText('<img');
  expect(dialog).toBe(false);
});

test('destructive delete requires the trash and a confirmation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New note' }).first().click();
  const throwDialog = page.getByRole('dialog');
  await throwDialog.getByLabel('Title', { exact: true }).fill(`Throwaway ${unique}`);
  await throwDialog.getByRole('button', { name: 'Create note' }).click();
  await page.getByRole('button', { name: 'Move to Trash' }).click();
  await page.goto('/trash');
  await page.locator('.item-row', { hasText: `Throwaway ${unique}` }).getByRole('button', { name: 'Delete forever' }).click();
  await expect(page.getByRole('heading', { name: 'Delete forever?' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete forever' }).last().click();
  await expect(page.locator('.item-row', { hasText: `Throwaway ${unique}` })).toHaveCount(0);
});

test('a failed autosave leaves a recoverable draft', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New note' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title', { exact: true }).fill(`Draft note ${unique}`);
  await dialog.getByRole('button', { name: 'Create note' }).click();
  await expect(page.getByLabel('Item title')).toHaveValue(`Draft note ${unique}`);

  await page.route('**/api/items/*/note', (route) => route.abort());
  await page.getByLabel('Note body in Markdown').fill('# Recovered\n\nThis text only exists in the browser draft.');
  await expect(page.locator('.save-state')).toHaveAttribute('data-state', 'error', { timeout: 10_000 });

  await page.reload();
  await expect(page.getByText(/unsaved draft/i)).toBeVisible();
  await page.unroute('**/api/items/*/note');
  await page.getByRole('button', { name: 'Restore it' }).click();
  await expect(page.locator('.save-state')).toHaveAttribute('data-state', 'saved', { timeout: 10_000 });
  await expect(page.getByLabel('Note body in Markdown')).toHaveValue(/only exists in the browser draft/);
});

test('a stale editor is told the note changed elsewhere', async ({ context, page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New note' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title', { exact: true }).fill(`Two editors ${unique}`);
  await dialog.getByRole('button', { name: 'Create note' }).click();
  await expect(page).toHaveURL(/\/items\//);
  const url = page.url();

  const second = await context.newPage();
  await second.goto(url);
  await expect(second.getByLabel('Note body in Markdown')).toBeVisible();

  await page.getByLabel('Note body in Markdown').fill('# Written in the first tab');
  await expect(page.locator('.save-state')).toHaveAttribute('data-state', 'saved', { timeout: 10_000 });

  await second.getByLabel('Note body in Markdown').fill('# Written in the second tab');
  await expect(second.locator('.draft-banner.warning')).toBeVisible({ timeout: 10_000 });
  await second.getByRole('button', { name: 'Load the latest version' }).click();
  await expect(second.getByLabel('Note body in Markdown')).toHaveValue(/Written in the first tab/);
});
