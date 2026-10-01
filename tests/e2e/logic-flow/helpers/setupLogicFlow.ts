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

  if (state === 'clean') {
    data.x4_logic_flow_plans_v9 = { version: 3, activeId: null, list: [] }
  }

  await page.evaluate((fixture) => {
    localStorage.setItem('x4_game_version', JSON.stringify({ version: '9.0', beta: false }))
    Object.entries(fixture).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('isTestEnv', 'true')
  }, data)

  await page.reload()
  await expect.poll(() => page.evaluate(() => {
    const store = (window as any).gameDataStore
    return { version: store?.currentVersion, key: store?.getStorageKey('logic_flow') }
  })).toEqual({ version: '9.0', key: 'x4_logic_flow_plans_v9' })
  await page.getByTestId('language-select').selectOption('zh-CN')
  await page.getByTestId('top-view-btn-flow').click()
  await expectLogicFlowReady(page)

  if (state === 'clean') {
    await expect(page.locator('.production-group')).toHaveCount(0)
    await expect(page.locator('.plan-title-text')).toHaveText(/新建方案|New Plan|我的逻辑组网|My Logic Flow/i)
  } else {
    await expect(page.locator('.production-group')).toHaveCount(3)
    await expect(page.locator('.plan-title-text')).toHaveText('Logic Flow 1')
  }
}

async function expectLogicFlowReady(page: Page): Promise<void> {
  await expect(page.getByTestId('top-view-btn-flow')).toHaveClass(/bg-purple-600/)
  await expect(page.locator('.candidate-zone')).toBeVisible()
}
