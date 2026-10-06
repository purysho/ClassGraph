import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { serializeProjectJson } from '../src/json.js'
import { addMetricDefinition, setStudentMetricValue } from '../src/metrics.js'
import type { ClassGraphProject, MetricValue } from '../src/model.js'
import { addStudent, createEmptyProject } from '../src/workspace.js'
import { downloadFrom, openStartScreen } from './helpers.js'

const now = '2026-10-06T10:00:00.000Z'

function term(
  id: string,
  name: string,
  rows: Array<[string, string, MetricValue, string]>,
): ClassGraphProject {
  let project = createEmptyProject({
    projectId: id,
    title: `Terms E2E ${name}`,
    classInfo: { term: name },
    now,
  })
  project = addMetricDefinition(
    project,
    { key: 'score', label: 'Score', kind: 'number', numberScale: { min: 0, max: 100 } },
    now,
  )
  project = addMetricDefinition(
    project,
    { key: 'house', label: 'House', kind: 'category', categories: ['Red', 'Blue'] },
    now,
  )
  for (const [studentId, displayName, score, house] of rows) {
    project = addStudent(project, { id: studentId, displayName }, now)
    project = setStudentMetricValue(project, studentId, 'score', score, now)
    project = setStudentMetricValue(project, studentId, 'house', house, now)
  }
  return project
}

async function restore(page: Page, project: ClassGraphProject): Promise<void> {
  await openStartScreen(page)
  await page.setInputFiles('#json-file', {
    name: `${project.projectId}.classgraph.json`,
    mimeType: 'application/json',
    buffer: Buffer.from(serializeProjectJson(project)),
  })
  await page.click('#import-form button[type=submit]')
  await expect(page.locator('.workspace-header h1')).toHaveText(project.title)
}

test('compares two terms by student ID, exports CSV and starts a next term', async ({ page }) => {
  const earlier = term('terms-e2e-1', 'Term 1', [
    ['s1', '张喆', 60, 'Red'],
    ['s2', 'Ben', 80, 'Blue'],
    ['s3', 'Cai', null, 'Red'],
  ])
  const later = term('terms-e2e-2', 'Term 2', [
    ['s1', '张喆', 72, 'Red'],
    ['s2', 'Ben', 75, 'Red'],
    ['s4', 'Dee', 90, 'Blue'],
  ])
  await restore(page, earlier)
  await restore(page, later)

  await page.click('[data-view="terms"]')
  await page.selectOption('#term-other', '__file__')
  await expect(page.locator('#term-file-field')).toBeVisible()
  await page.selectOption('#term-other', 'terms-e2e-1')
  await expect(page.locator('#term-file-field')).toBeHidden()
  await page.click('#term-form button[type=submit]')

  const roster = page.locator('.term-roster')
  await expect(roster).toContainText('2')
  await expect(page.locator('.term-overview h2')).toBeFocused()
  const score = page.locator('[data-term-metric="score"]')
  await expect(score.locator('.term-changes')).toContainText(
    '2 students have a value in both terms: 1 higher, 1 lower, 0 the same.',
  )
  const house = page.locator('[data-term-metric="house"]')
  await expect(house.locator('.term-changes')).toContainText('1 have a different value, 1 the same')

  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(scan.violations.map((violation) => violation.id)).toEqual([])

  const csv = (await downloadFrom(page, '#term-csv')).toString('utf8')
  expect(csv).toContain('s1,张喆,张喆,60,72,12,Red,Red')
  expect(csv).toContain('s3,Cai,,missing,not-in-term,not-compared,Red,not-in-term')

  await page.fill('#next-term-form input[name=title]', 'Terms E2E Term 3')
  await page.fill('#next-term-form input[name=term]', 'Term 3')
  await page.click('#next-term-form button[type=submit]')
  await expect(page.locator('.workspace-header h1')).toHaveText('Terms E2E Term 3')
  await page.click('[data-view="students"]')
  await expect(page.locator('[data-student-name="s4"]')).toHaveValue('Dee')
})
