import { expect, test } from '@playwright/test'

test('creates a task, opens Monaco, and completes a mock execution', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')
  await expect(page.getByText('Workflow Definitions')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Add Task' })).toBeVisible()

  await page.getByRole('button', { name: /HTTP Task/ }).first().click()
  await expect(page.getByRole('heading', { name: 'http_task' })).toBeVisible()

  await page.getByRole('button', { name: 'Code', exact: true }).click()
  await expect(page.locator('.monaco-editor')).toHaveCount(1, { timeout: 10_000 })

  await page.getByRole('button', { name: 'Execute', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Execute workflow' })).toBeVisible()
  await page.getByRole('button', { name: 'Start execution', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Execution completed', exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('workflow.completed', { exact: false })).toBeVisible()
})

test('adds a task from a node plus connector', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')
  await page.locator('.loop-node .node-add-connector').click()
  await expect(page.getByText('AGENTIC ORCHESTRATION')).toBeVisible()
  await page.locator('.quick-add-menu button').filter({ hasText: /^HTTP$/ }).click()
  await expect(page.locator('.quick-add-menu')).toHaveCount(0)
  await expect(page.locator('.canvas-ribbon')).toContainText('13 connections')
  await expect(page.locator('.task-node').filter({ hasText: 'http_task' })).toHaveCount(1)
  await page.getByRole('button', { name: 'Add task inside Do While' }).click()
  await page.locator('.quick-add-menu button').filter({ hasText: /^HTTP$/ }).click()
  await expect(page.locator('.loop-node .group-slot')).toContainText('http_task')
  await page.getByRole('button', { name: 'Delete nested task http_task' }).click()
  await expect(page.locator('.loop-node .group-slot').filter({ hasText: 'http_task' })).toHaveCount(0)
})

test('deletes a task from its node close button', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')
  await page.getByRole('button', { name: /HTTP Task/ }).first().click()
  const task = page.locator('.task-node').filter({ hasText: 'http_task' })
  await expect(task).toHaveCount(1)
  await task.locator('.node-remove').click()
  await expect(task).toHaveCount(0)
})

test('configures a Worker Task from the Orkes task reference fields', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')
  await page.getByRole('button', { name: /Worker Task \(Simple\)/ }).first().click()
  await expect(page.getByText('Worker task options')).toBeVisible()
  await page.locator('input[placeholder="sayHello"]').fill('sayHello')
  await page.locator('.worker-section input[type="checkbox"]').nth(0).check()
  await expect(page.getByText('TTL (seconds)')).toBeVisible()
  await page.locator('.worker-section input[placeholder="${workflow.input.jobId}"]').fill('${workflow.input.firstName}')
  await page.locator('.worker-section input[type="checkbox"]').nth(1).check()
  await expect(page.getByText('Input schema')).toBeVisible()
})

test('shows the Orkes operator catalog in Add Task', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Dynamic Fork/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Exclusive Join/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Get Workflow/ })).toBeVisible()
})

test('shows dedicated polling controls for an HTTP Poll task', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')
  await page.getByRole('button', { name: /HTTP Poll Task/ }).first().click()
  await expect(page.getByText('Polling', { exact: true })).toBeVisible()
  await expect(page.getByText('Poll interval (sec)', { exact: true })).toBeVisible()
  await expect(page.getByText('Poll condition', { exact: true })).toBeVisible()
})

test('shows dedicated official forms for advanced task types', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')
  await page.getByRole('button', { name: /Get Signed JWT/ }).first().click()
  await expect(page.getByText('Private key ID', { exact: true })).toBeVisible()
  await expect(page.getByText('Algorithm', { exact: true })).toBeVisible()
})

test('undo and redo restore task nodes together with their connections', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')
  await page.getByTestId('rf__node-submit-job').click()
  await page.getByRole('button', { name: /Add another task/ }).click()
  await page.getByRole('button', { name: /HTTP Task/ }).first().click()
  await expect(page.locator('.canvas-ribbon')).toContainText('13 connections')
  const newTask = page.locator('.react-flow__node').filter({ hasText: 'http_task' }).first()
  await expect(newTask).toHaveCount(1)
  const pollLoop = page.getByTestId('rf__node-poll-loop')
  const yPosition = async (locator: typeof newTask) => (await locator.getAttribute('style'))?.match(/translate\([^,]+,\s*([^)]*)\)/)?.[1]
  expect(await yPosition(newTask)).toBe(await yPosition(pollLoop))

  await page.getByRole('button', { name: /Undo/ }).click()
  await expect(page.locator('.task-node').filter({ hasText: 'http_task' })).toHaveCount(0)
  await expect(page.locator('.canvas-ribbon')).toContainText('12 connections')

  await page.getByRole('button', { name: /Redo/ }).click()
  await expect(page.locator('.task-node').filter({ hasText: 'http_task' })).toHaveCount(1)
  await expect(page.locator('.canvas-ribbon')).toContainText('13 connections')
})

test('copies, pastes, and duplicates a node with a conflict-safe reference', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')
  const source = page.getByTestId('rf__node-submit-job')
  await source.click()
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await expect(page.locator('.task-node').filter({ hasText: 'submit_job_2' })).toHaveCount(1)

  await source.click({ button: 'right' })
  await expect(page.getByRole('button', { name: 'Copy node' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'View JSON' })).toBeVisible()
  await page.getByRole('button', { name: 'View JSON' }).click()
  await expect(page.getByRole('button', { name: 'Code', exact: true })).toHaveClass(/active/)
})

test('pauses, resumes, and terminates a running execution', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')
  await page.getByRole('button', { name: 'Execute', exact: true }).click()
  await page.getByRole('button', { name: 'Start execution', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({ timeout: 2_000 })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Workflow is paused' })).toBeVisible()
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Terminate', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Terminate', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Execution terminated' })).toBeVisible()
})
