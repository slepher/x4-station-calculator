import { test } from '../../test-setup';
import { expect } from '@playwright/test';

test.describe('Station Title Editing', () => {
  test('Test 1: Default Title Behavior', async ({ page }) => {
    await page.goto('/');
    
    // Verify default title display
    const titleElement = page.locator('.toolbar-title');
    await expect(titleElement).toBeVisible();
    // Since we don't know the exact language, we check if it's not empty
    await expect(titleElement).not.toBeEmpty();
    
    // Ideally we would check the store, but we can't access store directly from test context easily without exposing it.
    // So we rely on UI behavior.
  });

  test('Test 2: Title Editing', async ({ page }) => {
    await page.goto('/');
    
    // Click title to edit
    const titleContainer = page.locator('.toolbar-title').locator('..'); // Parent div
    await titleContainer.click();
    
    // Check input appears
    const input = page.locator('input[type="text"]'); // Assuming it's the only text input or we can be more specific
    // The input in StationToolbar doesn't have a specific class but has v-model displayTitle
    // Let's target by value or visibility
    const editInput = page.locator('.toolbar-panel input');
    await expect(editInput).toBeVisible();
    
    // Change title
    await editInput.fill('My New Station');
    await editInput.press('Enter');
    
    // Verify display updates
    const titleElement = page.locator('.toolbar-title');
    await expect(titleElement).toHaveText('My New Station');
    
    // Verify document title (browser tab)
    await expect(page).toHaveTitle(/My New Station/);
  });

  test('Test 3: Empty Title Reversion', async ({ page }) => {
    await page.goto('/');
    
    // Set a valid title first
    const titleContainer = page.locator('.toolbar-title').locator('..');
    await titleContainer.click();
    const editInput = page.locator('.toolbar-panel input');
    await editInput.fill('Valid Title');
    await editInput.press('Enter');
    
    // Edit again and clear
    await titleContainer.click();
    await editInput.fill('');
    await editInput.press('Enter');
    
    // Verify it reverted to 'Valid Title'
    const titleElement = page.locator('.toolbar-title');
    await expect(titleElement).toHaveText('Valid Title');
  });

  test('Test 4: Save Validation (No Modules)', async ({ page }) => {
    await page.goto('/');
    
    // Reset to empty state first
    const newBtn = page.getByRole('button', { name: /New/i });
    await newBtn.click();
    
    // If dialog appears, click Discard & New
    const discardBtn = page.getByRole('button', { name: /Discard & New/i });
    if (await discardBtn.isVisible()) {
      await discardBtn.click();
    }
    
    // Ensure no modules (default state)
    // Click Save
    const saveBtn = page.getByRole('button', { name: /Save/i }).first(); // Matches "Save" and "Save As"
    await saveBtn.click();
    
    // Verify StatusMonitor warning
    // Wait a bit for animation
    await page.waitForTimeout(500);
    await expect(page.getByText(/Cannot save.*empty plan/i)).toBeVisible();
    
    // Verify Save Dialog is NOT open
    // Check for "Save Plan" header in modal
    await expect(page.getByRole('heading', { name: 'Save Plan' })).not.toBeVisible();
  });

  test('Test 5: Save with Title', async ({ page }) => {
    await page.goto('/');
    
    // Reset to empty state first
    const newBtn = page.getByRole('button', { name: /New/i });
    await newBtn.click();
    const discardBtn = page.getByRole('button', { name: /Discard & New/i });
    if (await discardBtn.isVisible()) {
      await discardBtn.click();
    }
    
    // Add a module using the search picker
    // Click search input to open popover
    await page.click('.search-panel input');
    // Type to ensure results
    await page.fill('.search-panel input', 'Energy');
    
    // Wait for results and click the first one
    await page.locator('.result-item').first().click();
    
    // Set title
    const titleContainer = page.locator('.toolbar-title').locator('..');
    await titleContainer.click();
    const editInput = page.locator('.toolbar-panel input');
    await editInput.fill('Saved Station');
    await editInput.press('Enter');
    
    // Click Save
    const saveBtn = page.getByRole('button', { name: /Save/i }).first();
    await saveBtn.click();
    
    // Verify Save Dialog is open
    await expect(page.getByRole('heading', { name: 'Save Plan' })).toBeVisible();
    
    // Verify input in dialog has the title
    const dialogInput = page.locator('input[placeholder="Enter name for plan..."]');
    await expect(dialogInput).toHaveValue('Saved Station');
  });

  test('Test 6: New Plan Title Reset', async ({ page }) => {
    await page.goto('/');

    // 1. Set a custom title
    const titleContainer = page.locator('.toolbar-title').locator('..');
    await titleContainer.click();
    const editInput = page.locator('.toolbar-panel input');
    await editInput.fill('Old Plan Title');
    await editInput.press('Enter');
    await expect(page.locator('.toolbar-title')).toHaveText('Old Plan Title');

    // 2. Add a module to make plan dirty (so New triggers a prompt or action)
    // Actually, if we just change title, isDirty might not be true depending on implementation?
    // Let's add a module to be safe and ensure "Discard & New" flow is tested if applicable,
    // OR just use New on a clean plan if title change doesn't count as dirty.
    // Store implementation: isDirty checks plannedModules, lockedWares, settings. Title is NOT in isDirty check usually unless snapshot includes it.
    // Based on previous code, title is separate. Let's add a module to be sure we can trigger "New" effectively.
    await page.click('.search-panel input');
    await page.fill('.search-panel input', 'Energy');
    await page.locator('.result-item').first().click();

    // 3. Click New
    const newBtn = page.getByRole('button', { name: /New/i });
    await newBtn.click();

    // 4. Handle Discard if dialog appears
    const discardBtn = page.getByRole('button', { name: /Discard & New/i });
    if (await discardBtn.isVisible()) {
      await discardBtn.click();
    }

    // 5. Verify title is reset to default (we assume default contains "Station" or localized equivalent)
    // The default is "Station Planner" or similar.
    // We can check it is NOT "Old Plan Title"
    await expect(page.locator('.toolbar-title')).not.toHaveText('Old Plan Title');
    
    // Check it matches the default text behavior (Test 1)
    const titleElement = page.locator('.toolbar-title');
    await expect(titleElement).not.toBeEmpty();
  });

  test('Test 7: Edit Interaction & Cancel', async ({ page }) => {
    await page.goto('/');

    // 1. Enter edit mode
    const titleContainer = page.locator('.toolbar-title').locator('..');
    await titleContainer.click();
    const editInput = page.locator('.toolbar-panel input');
    
    // Verify initial value is not empty (default title)
    await expect(editInput).not.toHaveValue('');
    const defaultTitle = await editInput.inputValue();

    // Verify confirm button exists
    // The confirm button has a specific class 'text-green-400' or we can target by svg path if unique,
    // but better to use the container structure we just created.
    // The confirm button is a sibling of the input in the editing container.
    const confirmBtn = page.locator('.toolbar-panel input + button');
    await expect(confirmBtn).toBeVisible();

    // 2. Clear input but DON'T submit (test internal state)
    await editInput.fill('');
    await expect(editInput).toHaveValue(''); // Should remain empty while focused

    // 3. Cancel by blurring (clicking outside)
    // Click somewhere safe, e.g., the toolbar background
    await page.locator('.toolbar-panel').click({ position: { x: 10, y: 10 } });
    
    // Verify reverted to original title
    await expect(page.locator('.toolbar-title')).toHaveText(defaultTitle);

    // 4. Edit and Confirm with Button
    await titleContainer.click();
    await editInput.fill('Confirmed Title');
    await confirmBtn.click();
    
    // Verify updated
    await expect(page.locator('.toolbar-title')).toHaveText('Confirmed Title');
  });

  test('Test 8: Visual Stability (Height)', async ({ page }) => {
    await page.goto('/');

    // 1. Get initial height of toolbar panel
    const toolbar = page.locator('.toolbar-panel');
    const initialBox = await toolbar.boundingBox();
    const initialHeight = initialBox?.height;

    // 2. Enter edit mode
    const titleContainer = page.locator('.toolbar-title').locator('..');
    await titleContainer.click();
    
    // 3. Get height during edit
    const editingBox = await toolbar.boundingBox();
    const editingHeight = editingBox?.height;

    // 4. Verify height is stable (allowing small pixel differences due to rendering, but ideally 0)
    // We expect it to be very close
    expect(Math.abs((editingHeight || 0) - (initialHeight || 0))).toBeLessThan(2);
  });
});
