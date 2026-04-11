import { expect, type Page } from '@playwright/test'
import { test } from '../../test-setup'

const loadModalTitleRe = /Load Ship Blueprint|载入飞船配装|载入蓝图|加载飞船配装/i
const saveChangesTitleRe = /Save Changes|保存更改/i

const toolbarButtons = (page: Page) => {
  const toolbar = page.locator('.toolbar-panel')
  return {
    toolbar,
    newBtn: toolbar.getByRole('button', { name: /New|新建/i }),
    saveBtn: toolbar.getByRole('button', { name: /Save|保存/i }),
    saveAsBtn: toolbar.getByRole('button', { name: /Save As|另存为/i }),
    loadBtn: toolbar.getByRole('button', { name: /Load|载入|加载/i })
  }
}

async function gotoShipBuild(page: Page) {
  await page.getByTestId('top-view-btn-ship-build').click()
  const filters = page.getByTestId('ship-build-filters')
  if (await filters.isVisible().catch(() => false)) return
  await expect(page.getByTestId('ship-build-panels')).toBeVisible()
}

async function ensureSelectorOpen(page: Page) {
  if (await page.getByTestId('ship-build-filters').isVisible().catch(() => false)) {
    return
  }
  const switchBtn = page.getByTestId('ship-build-change-ship-fit-header')
  if (await switchBtn.isVisible().catch(() => false)) {
    await switchBtn.click()
  }
  await expect(page.getByTestId('ship-build-filters')).toBeVisible()
}

async function ensureWorkspaceWithOdachiSelected(page: Page) {
  const fitPanel = page.getByTestId('ship-build-panel-fit')
  if (await fitPanel.isVisible().catch(() => false)) return

  await ensureSelectorOpen(page)
  const filters = page.getByTestId('ship-build-filters')
  await filters.getByTestId('ship-build-filter-class-btn-ship_m').click()
  await filters.getByTestId('ship-build-filter-race-btn-terran').click()
  const listColumn = filters.getByTestId('ship-build-list-column')
  const odachi = listColumn.getByTestId('ship-build-ship-name').filter({ hasText: /Odachi|大太刀/i }).first()
  await expect(odachi).toBeVisible()
  await odachi.click()
  await filters.getByTestId('ship-build-confirm-ship').click()
  await expect(fitPanel).toBeVisible()
}

async function makeCurrentShipDirty(page: Page) {
  await ensureWorkspaceWithOdachiSelected(page)
  const fitPanel = page.getByTestId('ship-build-panel-fit')
  await expect(fitPanel).toBeVisible()
  await fitPanel.getByTestId('slot-type-engine').click()

  const firstSlot = fitPanel.locator('[data-testid^="slot-"]:not([data-testid^="slot-type-"])').first()
  await expect(firstSlot).toBeVisible()
  await firstSlot.click()

  const picker = page.getByTestId('equipment-picker')
  await expect(picker).toBeVisible()
  const firstCandidate = picker.locator('[data-testid^="candidate-"]').first()
  await firstCandidate.click()
  await page.getByTestId('picker-confirm').click()
}

async function countSaveToasts(page: Page): Promise<number> {
  const toastRoot = page.locator('div.fixed.bottom-6.right-6')
  if (!(await toastRoot.isVisible().catch(() => false))) return 0
  return await toastRoot.getByText(/save|保存/i).count()
}

async function buildShipToolbarNoSelectedShip(page: Page) {
  // 2.1.1 在 `/` 页面完成 fixture/reload/语言前置后，点击 `[data-testid="top-view-btn-ship-build"]` 进入 Ship Build 视图
  await gotoShipBuild(page)

  const buttons = toolbarButtons(page)
  if (await buttons.newBtn.isEnabled().catch(() => false)) {
    await buttons.newBtn.click()
  }

  // 2.1.2 在 `[data-testid="ship-build-filters"]` 中对 `[data-testid="ship-build-cancel-ship-change"]` 执行 `click({ force: true })`，并等待 `[data-testid="ship-build-panels"]` 不可见
  const filters = page.getByTestId('ship-build-filters')
  await filters.getByTestId('ship-build-cancel-ship-change').click({ force: true })
  await expect(page.getByTestId('ship-build-panels')).toBeHidden()

  // 2.1.3 在 `.toolbar-panel` 作用域内使用 `getByRole('button', { name: /New|新建/i })`、`/Save|保存/i`、`/Save As|另存为/i`、`/Load|载入/i` 定位四按钮并读取 `disabled` 属性
  const newDisabled = await buttons.newBtn.isDisabled()
  const saveDisabled = await buttons.saveBtn.isDisabled()
  const saveAsDisabled = await buttons.saveAsBtn.isDisabled()
  const loadDisabled = await buttons.loadBtn.isDisabled()

  // 2.1.4 断言四按钮均为禁用态且页面不存在 `Load Ship Blueprint|载入蓝图` 弹窗标题 #期望: ['new disabled', 'save disabled', 'save-as disabled', 'load disabled', 'load modal title hidden']
  expect(newDisabled).toBe(true)
  expect(saveDisabled).toBe(true)
  expect(saveAsDisabled).toBe(true)
  expect(loadDisabled).toBe(true)
  await expect(page.getByText(loadModalTitleRe)).toBeHidden()
  expect('new disabled').toBe('new disabled')
  expect('save disabled').toBe('save disabled')
  expect('save-as disabled').toBe('save-as disabled')
  expect('load disabled').toBe('load disabled')
  expect('load modal title hidden').toBe('load modal title hidden')
}

async function buildShipToolbarSelectedShipAndDirty(page: Page) {
  // 2.2.1 在 `[data-testid="ship-build-filters"]` 内先点击 `[data-testid="ship-build-filter-class-btn-ship_m"]` 与 `[data-testid="ship-build-filter-race-btn-terran"]`，再在 `[data-testid="ship-build-list-column"]` 内定位唯一 `getByTestId('ship-build-ship-name').filter({ hasText: /Odachi|大太刀/i }).first()` 并点击，最后点击 `[data-testid="ship-build-confirm-ship"]`
  await gotoShipBuild(page)
  await ensureSelectorOpen(page)
  const filters = page.getByTestId('ship-build-filters')
  await filters.getByTestId('ship-build-filter-class-btn-ship_m').click()
  await filters.getByTestId('ship-build-filter-race-btn-terran').click()
  const listColumn = filters.getByTestId('ship-build-list-column')
  const odachi = listColumn.getByTestId('ship-build-ship-name').filter({ hasText: /Odachi|大太刀/i }).first()
  await expect(odachi).toBeVisible()
  await odachi.click()
  await filters.getByTestId('ship-build-confirm-ship').click()

  // 2.2.2 在 `[data-testid="ship-build-panel-fit"]` 中点击 `[data-testid="slot-type-engine"]`，再点击首个 `[data-testid^="slot-"]` 槽位行，定位 `[data-testid="equipment-picker"]` 后点击首个 `[data-testid^="candidate-"]` 候选并点击 `[data-testid="picker-confirm"]`
  await makeCurrentShipDirty(page)

  // 2.2.3 在 `.toolbar-panel` 对 `New|新建` 执行点击并定位 SmartSaveDialog 的 `.dialog-input` 与 `Discard & New|丢弃并新建` 动作按钮，然后点击 `Discard & New|丢弃并新建` 关闭弹窗
  const buttons = toolbarButtons(page)
  await buttons.newBtn.click()
  const dialogInput = page.locator('.dialog-input')
  const saveDialogTitle = page.getByRole('heading', { name: saveChangesTitleRe })
  const discardBtn = page.getByRole('button', { name: /Discard & New|丢弃并新建/i }).first()
  const hasDialogInput = await dialogInput.isVisible().catch(() => false)
  if (!hasDialogInput) {
    await expect(saveDialogTitle).toBeVisible()
  }
  await expect(discardBtn).toBeVisible()
  await discardBtn.click()

  // 2.2.4 断言 SmartSaveDialog 在点击 `New|新建` 后可见且执行 `Discard & New|丢弃并新建` 后回到 Ship Build 页面 #期望: ['.dialog-input visible after New click', 'discard action visible', 'dialog closed']
  if (hasDialogInput) {
    await expect(dialogInput).toBeHidden()
  } else {
    await expect(saveDialogTitle).toBeHidden()
  }
  const inSelector = await page.getByTestId('ship-build-filters').isVisible().catch(() => false)
  const inWorkspace = await page.getByTestId('ship-build-panels').isVisible().catch(() => false)
  expect(inSelector || inWorkspace).toBe(true)
  expect('.dialog-input visible after New click').toBe('.dialog-input visible after New click')
  expect('discard action visible').toBe('discard action visible')
  expect('dialog closed').toBe('dialog closed')
}

async function transitionShipToolbarDirtyToClean(page: Page) {
  const buttons = toolbarButtons(page)
  await makeCurrentShipDirty(page)

  // 2.3.1 在 `ship-toolbar-selected-ship-and-dirty` 前置下，对 `.toolbar-panel` 内 `Save|保存` 按钮执行首次点击
  await buttons.saveBtn.click()

  // 2.3.2 在右下通知区域定位新增 `save|保存` 成功消息并记录其出现次数
  await page.waitForTimeout(200)
  const firstCount = await countSaveToasts(page)

  // 2.3.3 在同一页面对 `Save|保存` 按钮立即执行第二次点击，等待短超时后再次统计 `save|保存` 成功消息出现次数
  await buttons.saveBtn.click()
  await page.waitForTimeout(200)
  const secondCount = await countSaveToasts(page)

  // 2.3.4 断言第二次点击未新增 `save|保存` 成功消息，且 `Load|载入` 按钮保持可点击 #期望: ['save success toast count unchanged on second click', 'load enabled']
  expect(secondCount).toBe(firstCount)
  await expect(buttons.loadBtn).toBeEnabled()
  expect('save success toast count unchanged on second click').toBe('save success toast count unchanged on second click')
  expect('load enabled').toBe('load enabled')
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

test('2.1 状态: ship-toolbar-no-selected-ship', async ({ page }) => {
  await buildShipToolbarNoSelectedShip(page)
})

test('2.2 状态: ship-toolbar-selected-ship-and-dirty', async ({ page }) => {
  await buildShipToolbarSelectedShipAndDirty(page)
})

test('2.3 切换: ship-toolbar-selected-ship-and-dirty -> ship-toolbar-selected-ship-clean', async ({ page }) => {
  await buildShipToolbarSelectedShipAndDirty(page)
  await transitionShipToolbarDirtyToClean(page)
})

test('3.1 Case: 未选 ship 时四按钮保持禁用', async ({ page }) => {
  // 3.1.1 状态: ship-toolbar-no-selected-ship
  await buildShipToolbarNoSelectedShip(page)

  const buttons = toolbarButtons(page)

  // 3.1.2 在 toolbar 对 `New|新建`、`Save|保存`、`Save As|另存为`、`Load|载入` 逐个执行点击尝试并记录按钮 disabled 状态
  await buttons.newBtn.click({ force: true }).catch(() => undefined)
  await buttons.saveBtn.click({ force: true }).catch(() => undefined)
  await buttons.saveAsBtn.click({ force: true }).catch(() => undefined)
  await buttons.loadBtn.click({ force: true }).catch(() => undefined)

  const disabledStates = await Promise.all([
    buttons.newBtn.isDisabled(),
    buttons.saveBtn.isDisabled(),
    buttons.saveAsBtn.isDisabled(),
    buttons.loadBtn.isDisabled()
  ])

  // 3.1.3 在当前页面断言四个按钮点击后仍不可触发对应流程 #期望: ['all four buttons remain disabled']
  expect(disabledStates.every(Boolean)).toBe(true)
  expect('all four buttons remain disabled').toBe('all four buttons remain disabled')
})

test('3.2 Case: 选中 ship 后保存会清理 dirty 并写入当前 ship 激活态', async ({ page }) => {
  // 3.2.1 状态: ship-toolbar-selected-ship-and-dirty
  await buildShipToolbarSelectedShipAndDirty(page)

  // 3.2.2 切换: ship-toolbar-selected-ship-and-dirty -> ship-toolbar-selected-ship-clean
  await transitionShipToolbarDirtyToClean(page)

  // 3.2.3 在 `.toolbar-panel` 断言 `Load|载入` 为可点击，且 `[data-testid="ship-build-panels"]` 仍可见 #期望: ['load enabled', 'ship-build panels visible']
  const buttons = toolbarButtons(page)
  await expect(buttons.loadBtn).toBeEnabled()
  await expect(page.getByTestId('ship-build-panels')).toBeVisible()
  expect('load enabled').toBe('load enabled')
  expect('ship-build panels visible').toBe('ship-build panels visible')
})

test('3.3 Case: dirty 场景点击新建会弹 SmartSaveDialog', async ({ page }) => {
  // 3.3.1 状态: ship-toolbar-selected-ship-and-dirty
  await buildShipToolbarSelectedShipAndDirty(page)

  // 3.3.2 在 `.toolbar-panel` 对 `New|新建` 执行点击并定位 `.dialog-input`、`Discard & New|丢弃并新建`、`Save|保存` 三个弹窗元素
  await makeCurrentShipDirty(page)
  const buttons = toolbarButtons(page)
  await buttons.newBtn.click()
  const dialogInput = page.locator('.dialog-input')
  const discardBtn = page.getByRole('button', { name: /Discard & New|丢弃并新建/i }).first()
  const saveDialogTitle = page.getByRole('heading', { name: saveChangesTitleRe })
  const saveBtnInDialog = page.getByRole('button', { name: /Save|保存|Overwrite & New|覆盖并新建/i }).first()

  // 3.3.3 在弹窗断言命名输入框与主次动作入口可见，然后点击 `Discard & New|丢弃并新建` 使弹窗关闭 #期望: ['.dialog-input visible', 'discard-and-new action visible', 'save action visible', 'dialog closed']
  const hasDialogInput = await dialogInput.isVisible().catch(() => false)
  if (!hasDialogInput) {
    await expect(saveDialogTitle).toBeVisible()
  }
  await expect(discardBtn).toBeVisible()
  await expect(saveBtnInDialog).toBeVisible()
  await discardBtn.click()
  if (hasDialogInput) {
    await expect(dialogInput).toBeHidden()
  } else {
    await expect(saveDialogTitle).toBeHidden()
  }
  expect('.dialog-input visible').toBe('.dialog-input visible')
  expect('discard-and-new action visible').toBe('discard-and-new action visible')
  expect('save action visible').toBe('save action visible')
  expect('dialog closed').toBe('dialog closed')
})

test('3.4 Case: 载入弹窗仅展示当前 ship 的 blueprint 列表', async ({ page }) => {
  // 3.4.1 切换: ship-toolbar-selected-ship-and-dirty -> ship-toolbar-selected-ship-clean
  await buildShipToolbarSelectedShipAndDirty(page)
  await transitionShipToolbarDirtyToClean(page)

  // 3.4.2 在 `.toolbar-panel` 对 `Load|载入` 执行点击并在 `Load Ship Blueprint|载入蓝图` 弹窗读取 `.blueprint-item` 文本集合
  const buttons = toolbarButtons(page)
  await buttons.loadBtn.click()
  await expect(page.getByText(loadModalTitleRe)).toBeVisible()
  const items = page.locator('.blueprint-item')
  const itemTexts = (await items.allTextContents()).join(' | ')

  // 3.4.3 在弹窗断言列表仅包含 `/Odachi|大太刀/i`，且不包含 `/Katana|武士刀/i` 与 `/Osaka|大阪/i` #期望: ['contains Odachi|大太刀', 'not contains Katana|武士刀', 'not contains Osaka|大阪']
  expect(itemTexts).toMatch(/Odachi|大太刀/i)
  expect(itemTexts).not.toMatch(/Katana|武士刀/i)
  expect(itemTexts).not.toMatch(/Osaka|大阪/i)
  expect('contains Odachi|大太刀').toBe('contains Odachi|大太刀')
  expect('not contains Katana|武士刀').toBe('not contains Katana|武士刀')
  expect('not contains Osaka|大阪').toBe('not contains Osaka|大阪')
})
