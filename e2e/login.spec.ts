import { expect, test } from '@playwright/test';

test('login page renders the core call to action', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Plan the right event, faster' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
});