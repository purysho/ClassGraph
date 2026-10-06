import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { ZH } from '../src/i18n-zh.js'
import { ZH_ERRORS } from '../src/i18n-zh-errors.js'
import { createManualClass, openStartScreen } from './helpers.js'

test.use({ locale: 'zh-CN' })

test('a Chinese system opens ClassGraph in Chinese, and English can be chosen instead', async ({
  page,
}) => {
  await openStartScreen(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.locator('#manual-form button[type=submit]')).toHaveText(ZH['Create class']!)

  await createManualClass(page, '五年级（1）班')
  for (const [view, english] of [
    ['overview', 'Overview'],
    ['students', 'Students'],
    ['seating', 'Seating'],
    ['reports', 'Reports'],
  ] as const) {
    await expect(page.locator(`[data-view="${view}"]`)).toHaveText(ZH[english]!)
  }
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(scan.violations.map((violation) => violation.id)).toEqual([])

  await page.selectOption('.sidebar-appearance [data-language-select]', 'en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('[data-view="students"]')).toHaveText('Students')

  await page.selectOption('.sidebar-appearance [data-language-select]', 'zh')
  await expect(page.locator('[data-view="students"]')).toHaveText(ZH.Students!)
})

test('a wrong password is explained in Chinese', async ({ page }) => {
  await createManualClass(page, '密码测试班')
  await page.click('#protection-button')
  await page.fill('#protect-password', 'correct horse')
  await page.fill('#protect-confirm', 'correct horse')
  await page.check('#protect-ack')
  await page.click('#enable-protection button[type=submit]')
  await page.click('#lock-now')
  await page.reload()

  await page.fill('#unlock-password', 'not the password')
  await page.click('#unlock-form button[type=submit]')
  const status = page.locator('#status')
  await expect(status).toBeVisible()
  await expect(status).toContainText(/[一-鿿]/)
  await expect(status).not.toContainText('does not unlock')

  await page.fill('#unlock-password', 'correct horse')
  await page.click('#unlock-form button[type=submit]')
  await expect(page.locator('.workspace-header h1')).toHaveText('密码测试班')
})

test('errors are explained in Chinese and keep their code and English detail', async ({ page }) => {
  await openStartScreen(page)
  await page.setInputFiles('#json-file', {
    name: 'broken.classgraph.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion": "1.0", "students": "not a list"}'),
  })
  await page.click('#import-form button[type=submit]')
  const status = page.locator('#status')
  await expect(status).toBeVisible()
  const text = await status.innerText()
  const code = /CG-\d{4}/.exec(text)?.[0]
  expect(code, text).toBeDefined()
  expect(text.startsWith(ZH_ERRORS[code!]!), text).toBe(true)
  expect(text).toContain('英文详情：')
})
