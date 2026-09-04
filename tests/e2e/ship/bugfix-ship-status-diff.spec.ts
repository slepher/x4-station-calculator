import { expect } from '@playwright/test'
import { test } from '../../test-setup'

const enterOdachiEmpty = async (page: any) => {
  await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
  await expect(page.getByTestId('ship-build-filters')).toBeVisible()

  await page.getByTestId('ship-build-change-ship').click()
  await expect(page.getByTestId('ship-build-list')).toBeVisible()

  await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'M', exact: true }).click()
  await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /terran/i }).click()

  const odachi = page.locator('.list-item').filter({ hasText: /Odachi|大太刀/i }).first()
  await expect(odachi).toBeVisible()
  await odachi.click()
  await page.waitForTimeout(300)
}

const openTurretPickerOnOdachi = async (page: any) => {
  await page.getByTestId('slot-type-turret').click()
  const turretSlot = page.locator('[data-testid^="slot-"][data-testid*="::turret::"]').first()
  await expect(turretSlot).toBeVisible({ timeout: 10000 })
  await turretSlot.click()
  await expect(page.getByTestId('equipment-picker')).toBeVisible({ timeout: 10000 })
}

const switchToGroupMode = async (page: any) => {
  const groupBtn = page.locator('button.mode-tab').filter({ hasText: /简化|Group/i }).first()
  await expect(groupBtn).toBeVisible({ timeout: 10000 })
  await groupBtn.click()
}

const clickFirstTurretCandidateInCurrentPicker = async (page: any) => {
  const candidates = page.locator('[data-testid^="candidate-"]')
  const count = await candidates.count()
  const seen: string[] = []
  for (let i = 0; i < count; i++) {
    const tid = await candidates.nth(i).getAttribute('data-testid')
    if (tid) seen.push(tid)
    if (tid && !/candidate-empty/i.test(tid)) {
      await candidates.nth(i).click()
      return
    }
  }
  throw new Error(`No non-empty turret candidate found in current picker. seen=${Array.from(new Set(seen)).slice(0, 30).join(',')}`)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')

  const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const dbData = JSON.parse(JSON.stringify(dbFixture.default))
  delete dbData.vsn

  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('isTestEnv', 'true')
  }, dbData)

  await page.reload()

  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption('zh-CN')
})

test('4.1 BUG-001: 空炮塔槽高亮首个候选炮塔时炮塔平均输出出现大于 0 的 diff - 修复后', async ({ page }) => {
  await enterOdachiEmpty(page)
  await openTurretPickerOnOdachi(page)
  await switchToGroupMode(page)
  await clickFirstTurretCandidateInCurrentPicker(page)

  const turretAvg = page.getByTestId('ship-build-panel-stats').getByTestId('metric-value-turret_avg').first()
  await expect(turretAvg).toBeVisible({ timeout: 10000 })
  const text = ((await turretAvg.textContent()) || '').replace(/\s+/g, '')

  expect(text.includes('(')).toBe(true)
  const diffMatch = text.match(/\(([+-]?\d+(?:\.\d+)?)\)/)
  expect(diffMatch).toBeTruthy()
  const diff = Number(diffMatch?.[1] || '0')
  expect(diff).toBeGreaterThan(0)
})
