import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import dbFixture from '../../../fixtures/db.json' with { type: 'json' }

type LogicFlowState = 'seeded' | 'clean'

export async function setupLogicFlow(
  page: Page,
  state: LogicFlowState = 'clean'
): Promise<void> {
  await page.goto('/')

  const data = JSON.parse(JSON.stringify(dbFixture))
  delete data.vsn

  await page.evaluate((fixture) => {
    localStorage.setItem('x4_game_version', JSON.stringify({ version: '8.0', beta: false }))
    Object.entries(fixture).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('isTestEnv', 'true')
  }, data)

  await page.reload()
  await expect.poll(() => page.evaluate(() => {
    const store = (window as any).gameDataStore
    return { version: store.currentVersion, key: store.getStorageKey('logic_flow') }
  })).toEqual({ version: '8.0', key: 'x4_logic_flow_plans' })
  await page.getByTestId('language-select').selectOption('zh-CN')
  await page.getByTestId('top-view-btn-flow').click()
  await expectLogicFlowReady(page)

  if (state === 'clean') {
    await page.evaluate(() => (window as any).logicFlowStore.clearAllGroups())
    await page.waitForFunction(() => (window as any).logicFlowStore.groups.length === 0)
  } else {
    await page.waitForFunction(() => (window as any).logicFlowStore.groups.length === 3)
  }
}

async function expectLogicFlowReady(page: Page): Promise<void> {
  await expect(page.getByTestId('top-view-btn-flow')).toHaveClass(/bg-purple-600/)
  await expect(page.locator('.candidate-zone')).toBeVisible()
}
