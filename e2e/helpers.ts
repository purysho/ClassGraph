import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, type Download, type Page } from '@playwright/test'

export function fixture(name: string): string {
  return fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))
}

/** Loads the app and returns to the start screen, whatever was open last. */
export async function openStartScreen(page: Page): Promise<void> {
  await page.goto('/')
  const first = page.locator('#manual-form, #new-project, #unlock-form').first()
  await first.waitFor()
  if (await page.locator('#new-project').isVisible()) await page.click('#new-project')
  if (await page.locator('#unlock-back').isVisible()) await page.click('#unlock-back')
  await expect(page.locator('#manual-form')).toBeVisible()
}

export async function createManualClass(page: Page, title: string): Promise<void> {
  await openStartScreen(page)
  await page.fill('#manual-form input[name=title]', title)
  await page.click('#manual-form button[type=submit]')
  await expect(page.locator('.workspace-header h1')).toHaveText(title)
}

export async function addStudent(page: Page, id: string, name?: string): Promise<void> {
  await page.click('[data-view="students"]')
  await page.fill('#add-student-form input[name=id]', id)
  if (name) await page.fill('#add-student-form input[name=displayName]', name)
  await page.click('#add-student-form button[type=submit]')
  await expect(page.locator(`[data-student-name="${id}"]`)).toBeVisible()
}

export async function importClassList(page: Page, file: string, title: string): Promise<void> {
  await openStartScreen(page)
  await page.setInputFiles('#spreadsheet-file', fixture(file))
  await page.click('#spreadsheet-form button[type=submit]')
  await expect(page.locator('.mapping-table')).toBeVisible()
  await page.fill('#spreadsheet-title', title)
  await expect(page.locator('#apply-spreadsheet')).toBeEnabled()
  await page.click('#apply-spreadsheet')
  await expect(page.locator('.workspace-header h1')).toHaveText(title)
}

export async function downloadFrom(page: Page, selector: string): Promise<Buffer> {
  const [download]: [Download, void] = await Promise.all([
    page.waitForEvent('download'),
    page.click(selector),
  ])
  const path = await download.path()
  return readFile(path)
}
