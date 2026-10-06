import JSZip from 'jszip'
import { expect, test } from '@playwright/test'
import {
  addStudent,
  createManualClass,
  downloadFrom,
  fixture,
  importClassList,
  openStartScreen,
} from './helpers.js'

test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => {
    throw error
  })
})

test('imports a class list, compares metrics and exports reports with Chinese names', async ({
  page,
}) => {
  await importClassList(page, 'class-list.xlsx', '五年级3班 E2E')

  await page.click('[data-view="students"]')
  await expect(page.locator('[data-student-name]')).toHaveCount(6)
  await expect(page.locator('[data-student-name="20240101"]')).toHaveValue('张喆')

  await page.click('[data-view="graphs"]')
  await page.locator('#crosstab-row').selectOption({ label: '阅读等级' })
  await page.locator('#crosstab-column').selectOption({ label: '语言支持' })
  await page.click('#load-crosstab')
  await expect(page.locator('#crosstab-result .crosstab-table')).toBeVisible()
  await page.click('#crosstab-result [data-report-comparison]')
  await expect(page.locator('#crosstab-result .report-toggle')).toHaveAttribute(
    'data-included',
    'true',
  )

  await page.click('[data-view="reports"]')
  await expect(page.locator('.report-comparison-list li')).toHaveCount(1)

  const analysis = JSON.parse(
    (await downloadFrom(page, '[data-report-export="/api/export/analysis-json"]')).toString(),
  ) as { version: string; comparisons: Array<{ selection: { kind: string } }> }
  expect(analysis.version).toBe('1.1')
  expect(analysis.comparisons.map((item) => item.selection.kind)).toEqual(['crosstab'])

  const pdf = await downloadFrom(page, '[data-report-export="/api/export/pdf"]')
  expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')

  const docx = await JSZip.loadAsync(
    await downloadFrom(page, '[data-report-export="/api/export/docx"]'),
  )
  const documentXml = (await docx.file('word/document.xml')?.async('string')) ?? ''
  expect(documentXml).toContain('Selected comparisons')
  expect(documentXml).toContain('张喆')
})

test('updates a class from a GBK-encoded CSV and lists every change first', async ({ page }) => {
  await importClassList(page, 'class-list.xlsx', 'CSV update E2E')
  await page.click('[data-view="students"]')
  await page.setInputFiles('#spreadsheet-update-file', fixture('update-gbk.csv'))

  await expect(page.locator('.generator-header')).toContainText('GBK/GB18030')
  await expect(page.locator('.import-facts')).toContainText(
    '2 existing student(s) updated, 1 added',
  )
  await expect(page.locator('#spreadsheet-preview table tbody tr')).toHaveCount(2)
  await page.click('#apply-spreadsheet')

  await expect(page.locator('#status')).toContainText('Class updated')
  await expect(page.locator('[data-student-name]')).toHaveCount(7)
})

test('protects a class with a password and asks for it again after locking', async ({ page }) => {
  await createManualClass(page, 'Protected E2E')
  await addStudent(page, 'p1', '李玥')

  await page.click('#protection-button')
  await page.fill('#protect-password', 'correct horse')
  await page.fill('#protect-confirm', 'correct horse')
  await page.check('#protect-ack')
  await page.click('#enable-protection button[type=submit]')
  await expect(page.locator('#lock-now')).toBeVisible()
  await expect(page.locator('#protection-button')).toContainText('🔒')

  // After locking, restarting the app must ask for the password before reopening the class.
  await page.click('#lock-now')
  await page.reload()
  await expect(page.locator('#unlock-form')).toBeVisible()

  await page.fill('#unlock-password', 'not the password')
  await page.click('#unlock-form button[type=submit]')
  await expect(page.locator('#status')).toContainText('does not unlock')

  await page.fill('#unlock-password', 'correct horse')
  await page.click('#unlock-form button[type=submit]')
  await expect(page.locator('.workspace-header h1')).toHaveText('Protected E2E')

  const backup = (await downloadFrom(page, '#export-json')).toString()
  expect(backup).toContain('classgraph-protected-project')
  expect(backup).not.toContain('李玥')

  await page.click('#protection-button')
  await page.fill('#disable-current', 'correct horse')
  await page.click('#disable-protection button[type=submit]')
  await expect(page.locator('#enable-protection')).toBeVisible()
})

test('restores a JSON backup', async ({ page }) => {
  await createManualClass(page, 'Backup E2E')
  await addStudent(page, 'b1', 'Restore Me')
  const backup = await downloadFrom(page, '#export-json')

  await openStartScreen(page)
  await page.setInputFiles('#json-file', {
    name: 'backup.classgraph.json',
    mimeType: 'application/json',
    buffer: backup,
  })
  await page.click('#import-form button[type=submit]')
  await expect(page.locator('.workspace-header h1')).toHaveText('Backup E2E')
  await page.click('[data-view="students"]')
  await expect(page.locator('[data-student-name="b1"]')).toHaveValue('Restore Me')
})
