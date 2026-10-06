import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { openStartScreen } from './helpers.js'

const VIEWS = [
  'overview',
  'students',
  'graphs',
  'relationships',
  'seating',
  'assistance',
  'reports',
  'terms',
] as const

async function violations(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return result.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help}\n${violation.nodes
        .slice(0, 5)
        .map((node) => `  ${node.target.join(' ')} — ${node.failureSummary ?? ''}`)
        .join('\n')}`,
  )
}

for (const scheme of ['light', 'dark'] as const) {
  test(`every screen passes automated WCAG 2.1 AA checks in the ${scheme} theme`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await openStartScreen(page)
    const found: Record<string, string[]> = { start: await violations(page) }

    await page.click('#configure-synthetic')
    await expect(page.locator('#generate-structured-class')).toBeVisible()
    found.builder = await violations(page)
    await page.click('#generate-structured-class')
    await expect(page.locator('.workspace-header h1')).toBeVisible()

    for (const view of VIEWS) {
      await page.click(`[data-view="${view}"]`)
      await expect(page.locator(`[data-view="${view}"]`)).toHaveAttribute('aria-current', 'page')
      if (view === 'seating') {
        await page.click('#room-form button[type=submit]')
        await expect(page.locator('.seat-card').first()).toBeVisible()
        await page.click('#seating-generator-form button[type=submit]')
        await expect(page.locator('#seating-generator-form')).toBeVisible()
      }
      found[view] = await violations(page)
    }

    const failing = Object.entries(found).filter(([, list]) => list.length > 0)
    expect(failing.map(([screen, list]) => `${screen}:\n${list.join('\n')}`).join('\n\n')).toBe('')
  })
}

test('the appearance setting overrides the system theme and is remembered', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await openStartScreen(page)
  await page.selectOption('.setup-appearance [data-theme-select]', 'dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await openStartScreen(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundImage)
  expect(background).not.toContain('255, 255, 255')

  await page.selectOption('.setup-appearance [data-theme-select]', 'system')
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
})

test('the workspace can be reached and used from the keyboard', async ({ page }) => {
  await openStartScreen(page)
  await page.click('#configure-synthetic')
  await page.click('#generate-structured-class')
  await expect(page.locator('.workspace-header h1')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.locator('.skip-link')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#workspace-content')).toBeFocused()

  await page.focus('[data-view="seating"]')
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-view="seating"]')).toBeFocused()
  await page.focus('#room-form button[type=submit]')
  await page.keyboard.press('Enter')
  await expect(page.locator('.seat-card').first()).toHaveAttribute(
    'aria-label',
    /^Row 1, column 1: /,
  )
})
