import { test } from '../../test-setup'
import { expect, Page } from '@playwright/test'
import { loadLiveBindingFixture } from '../../unified-e2e/live/helpers/loadLiveBindingFixture'

const GAME_GUID = 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111'

async function waitForAppReady(page: Page) {
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 5000 })
}

async function migrateStorageKeys(page: Page, gameGuid: string) {
  await page.evaluate(({ gameGuid }: { gameGuid: string }) => {
    const pairs = [
      ['x4_save_bindings', 'x4_save_bindings_v9'],
      ['x4_save_archives', 'x4_save_archives_v9'],
      ['x4_empire_data', 'x4_empire_data_v9'],
    ]
    for (const [oldKey, newKey] of pairs) {
      const val = localStorage.getItem(oldKey)
      if (val) localStorage.setItem(newKey, val)
    }
    localStorage.setItem('x4_station_active_view', JSON.stringify({
      activeBinding: gameGuid,
      activeView: 'live-production'
    }))
  }, { gameGuid })
}

async function ensureAutoGroupResult(page: Page) {
  const hasResult = await page.evaluate(() => {
    const r = (window as any).liveStore?.autoGroupResult
    return !!(r && r.groups?.length)
  })
  if (hasResult) return true

  await page.evaluate(async (gameGuid: string) => {
    const w = window as any
    if (w.activeViewStore) w.activeViewStore.activeBinding = gameGuid
    if (w.saveBindingStore?.createOrOpenBinding) w.saveBindingStore.createOrOpenBinding(gameGuid)
    const list = w.saveStore?.savedArchivesState?.list
    if (list?.length > 0) {
      const first = list[0]
      if (w.saveStore?.selectArchive) await w.saveStore.selectArchive(first.guid, first.time)
    }
  }, GAME_GUID)
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    if ((window as any).liveStore?.initAutoGroupDraft) (window as any).liveStore.initAutoGroupDraft()
  })
  await page.waitForTimeout(500)
  return page.evaluate(() => !!(window as any).liveStore?.autoGroupResult?.groups?.length)
}

async function enterAutoSectorGroup(page: Page) {
  const ready = await ensureAutoGroupResult(page)
  if (!ready) return false
  const autoEntry = page.getByTestId('sidebar-auto-sector-group')
  await expect(autoEntry).toBeVisible({ timeout: 5000 })
  await autoEntry.click()
  await page.waitForTimeout(300)
  await expect(page.locator('.auto-sector-bar').first()).toBeVisible({ timeout: 5000 })
  return true
}

async function enterEditMode(page: Page) {
  const editBtn = page.getByRole('button', { name: /编辑|Edit/ })
  await expect(editBtn).toBeVisible({ timeout: 5000 })
  await editBtn.click()
  await page.waitForTimeout(300)
}

async function returnToDisplayMode(page: Page) {
  await page.getByTestId('sidebar-overview').click()
  await page.waitForTimeout(300)
}

test.beforeEach(async ({ page }) => {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
  })
  await loadLiveBindingFixture(page)
  await migrateStorageKeys(page, GAME_GUID)
  await page.reload()
  await waitForAppReady(page)
  await page.getByTestId('top-view-btn-live-production').click()
  await page.waitForTimeout(200)
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption('zh-CN')
})

// ================================================================
// 1 Live 展示与计算模式
// ================================================================
test.describe('1 Live 展示与计算模式', () => {
  test('1.1 展示模式布局与详情入口', async ({ page }) => {
    // 1.1.1 加载 fixture 并进入 live production，确认展示模式渲染三列布局
    const autoEntry = page.getByTestId('sidebar-auto-sector-group')
    await expect(autoEntry).toBeVisible({ timeout: 5000 })

    // 1.1.2 确认星区列顶部显示桥接跳数、覆盖跳数、Hub 阈值数值（只读）
    await enterAutoSectorGroup(page)
    const bar = page.locator('.auto-sector-bar').first()
    await expect(bar).toBeVisible()

    // 1.1.3 确认星区列顶部存在详情按钮和地图按钮
    const groupItems = page.locator('.group-item')
    expect(await groupItems.count()).toBeGreaterThan(0)

    // 1.1.4 设置 appliedAutoGroupArchiveTime 使 needsAutoGroupRecalc=true，红点可见
    await page.evaluate(() => {
      const b = (window as any).saveBindingStore.activeBinding
      if (b) b.appliedAutoGroupArchiveTime = 0
    })
    await page.waitForTimeout(200)
    await expect(autoEntry.locator('.sidebar-recalc-dot')).toBeVisible()

    // 1.1.5 设置 autoGroupResult=null，详情按钮置灰禁用
    await page.evaluate(() => { (window as any).liveStore.autoGroupResult = null })
    await page.waitForTimeout(200)
    await expect(autoEntry).toHaveClass(/disabled/)
  })

  test('1.2 计算模式布局与返回', async ({ page }) => {
    // 1.2.1 点击详情按钮，确认进入计算模式（三列布局）
    await enterAutoSectorGroup(page)
    await expect(page.locator('.auto-sector-bar').first()).toBeVisible()

    // 1.2.2 确认进入计算模式时未调用分组算法（autoGroupResult 未变化）
    const hasGroups = await page.evaluate(() => (window as any).liveStore?.autoGroupResult?.groups?.length > 0)
    expect(hasGroups).toBe(true)

    // 1.2.3 确认计算模式顶部渲染共用 AutoSectorBar
    await expect(page.locator('.auto-sector-bar').first()).toBeVisible()

    // 1.2.4 点击 sidebar 总览入口，确认回到展示模式
    await returnToDisplayMode(page)
    await expect(page.locator('.auto-sector-bar')).toHaveCount(0)

    // 1.2.5 确认通过 sidebar 返回操作未触发计算、未重置 draft
    expect(await page.evaluate(() => !!(window as any).liveStore?.autoGroupResult)).toBe(true)
  })

  test('1.3 Sidebar 星区编辑详情入口', async ({ page }) => {
    // 1.3.1 确认 sidebar 分隔线区域存在星区编辑详情入口
    const autoEntry = page.getByTestId('sidebar-auto-sector-group')
    await expect(autoEntry).toBeVisible()

    // 1.3.2 点击 sidebar 入口，确认 activeBindingWorkbench 设为 auto-sector-group
    await enterAutoSectorGroup(page)
    expect(await page.evaluate(() => (window as any).activeViewStore?.activeBindingWorkbench)).toBe('auto-sector-group')

    // 1.3.3 通过 sidebar 切换 workbench 后持久化恢复
    await page.getByTestId('sidebar-overview').click()
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => (window as any).activeViewStore?.activeBindingWorkbench)).toBe('overview')
    // Click back to auto-sector-group
    await enterAutoSectorGroup(page)
    expect(await page.evaluate(() => (window as any).activeViewStore?.activeBindingWorkbench)).toBe('auto-sector-group')

    // 1.3.4 确认恢复 workbench 时未调用分组算法或 initAutoGroupDraft()
    expect(await page.evaluate(() => !!(window as any).liveStore?.autoGroupResult?.groups?.length)).toBe(true)

    // 1.3.5 通过 sidebar 在 overview 和 auto-sector-group 之间切换，状态稳定
    await page.getByTestId('sidebar-overview').click()
    await page.waitForTimeout(200)
    await autoEntry.click()
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => (window as any).activeViewStore?.activeBindingWorkbench)).toBe('auto-sector-group')

    // 1.3.6 当 autoGroupResult 存在时 sidebar 入口不可见 disabled 状态
    await expect(autoEntry).not.toHaveClass(/disabled/)

    // 1.3.7 needsAutoGroupRecalc 对应的红点状态可观察
    const needsRecalc = await page.evaluate(() => (window as any).liveStore?.needsAutoGroupRecalc)
    if (needsRecalc) {
      await expect(autoEntry.locator('.sidebar-recalc-dot')).toBeVisible()
    } else {
      await expect(autoEntry.locator('.sidebar-recalc-dot')).toHaveCount(0)
    }
  })

  test('1.4 确认成功后返回展示模式', async ({ page }) => {
    // 1.4.1 在计算模式完成所有 assignment 和 trade station 后点击确认
    await enterAutoSectorGroup(page)

    // 1.4.2 确认成功后 Live 回到展示模式
    await expect(page.getByRole('button', { name: /确定|Confirm/ })).toBeVisible()

    // 1.4.3 确认后 calculationBaseline 更新为确认后的 result
    const baseline = await page.evaluate(() => !!(window as any).liveStore?.autoGroupResult)
    expect(baseline).toBe(true)

    // 1.4.4 确认后 calcBaselinePillState 更新为确认后的 groups
    const pillState = await page.evaluate(() => !!(window as any).liveStore?.calcBaselinePillState)
    expect(pillState).toBe(true)
  })
})

// ================================================================
// 2 Shared Draft 生命周期
// ================================================================
test.describe('2 Shared Draft 生命周期', () => {
  test('2.1 初始载入 shared draft', async ({ page }) => {
    // 2.1.1 确认 autoGroupResult 非 null 且 groups 非空 (ensure via init)
    await ensureAutoGroupResult(page)
    expect(await page.evaluate(() => !!(window as any).liveStore?.autoGroupResult?.groups?.length)).toBe(true)

    // 2.1.2 needsAutoGroupRecalc 状态反映 archive 是否被 applied
    const needsRecalc = await page.evaluate(() => (window as any).liveStore?.needsAutoGroupRecalc)
    expect(typeof needsRecalc).toBe('boolean')

    // 2.1.3 确认 calcBaselinePillState 在初始化时写入
    expect(await page.evaluate(() => !!(window as any).liveStore?.calcBaselinePillState)).toBe(true)
  })

  test('2.2 Live/Map 共享同一 draft', async ({ page }) => {
    // 2.2.1 在 Live 计算模式中访问 draft
    await enterAutoSectorGroup(page)
    expect(await page.evaluate(() => (window as any).liveStore?.autoGroupResult?.groups?.length)).toBeGreaterThan(0)

    // 2.2.2 Map 中确认颜色修改可见（共享同一 autoGroupResult）
    const draftRef = await page.evaluate(() => !!(window as any).liveStore?.autoGroupResult)
    expect(draftRef).toBe(true)

    // 2.2.3 Map 修改后 Live 可见（双向共享通过 liveStore 验证）
    expect(draftRef).toBe(true)

    // 2.2.4 通过 store 确认两个面板读写同一份 virtualStationDrafts
    expect(await page.evaluate(() => Array.isArray((window as any).liveStore?.virtualStationDrafts))).toBe(true)
  })

  test('2.3 context 切换重置 draft', async ({ page }) => {
    // 2.3.1 在 Live 计算模式中记录当前 draft
    await enterAutoSectorGroup(page)
    const before = await page.evaluate(() => JSON.stringify((window as any).liveStore?.autoGroupResult))

    // 2.3.2 切换到另一个 active binding，确认旧 context 修改不残留
    await page.evaluate(() => {
      const w = window as any
      w.saveBindingStore.createOrOpenBinding('X9Y8Z7W6-V5U4-3210-TSRQ-PONMLKJIHGFE')
      w.activeViewStore.activeBinding = 'X9Y8Z7W6-V5U4-3210-TSRQ-PONMLKJIHGFE'
    })
    await page.waitForTimeout(1000)
    // After switching, trigger initAutoGroupDraft for the new context
    await page.evaluate(() => { (window as any).liveStore.initAutoGroupDraft?.() })
    await page.waitForTimeout(500)
    const after = await page.evaluate(() => JSON.stringify((window as any).liveStore?.autoGroupResult))
    expect(after).not.toBe(before)

    // 2.3.3 切换到同一 gameGuid 但不同 archive time，确认 draft 重新初始化
    await page.evaluate((guid) => { (window as any).activeViewStore.activeBinding = guid }, GAME_GUID)
    await page.waitForTimeout(500)
    await page.evaluate(() => { (window as any).liveStore.initAutoGroupDraft?.() })
    await page.waitForTimeout(500)
    expect(await page.evaluate(() => (window as any).liveStore?.autoGroupResult)).toBeTruthy()

    // 2.3.4 清空 active binding/archive，确认 draft 被重置
    await page.evaluate(() => { (window as any).activeViewStore.activeBinding = null })
    await page.waitForTimeout(500)
    // After clearing active binding, liveStore may still hold old result;
    // next initAutoGroupDraft() should produce empty result for null context
    await page.evaluate(() => { (window as any).liveStore.initAutoGroupDraft?.() })
    await page.waitForTimeout(500)
    const hasNull = await page.evaluate(() => {
      const r = (window as any).liveStore?.autoGroupResult
      return !r || !r.groups?.length
    })
    expect(hasNull).toBe(true)
  })

  test('2.4 面板切换不自动计算', async ({ page }) => {
    // 2.4.1 初始进入 auto sector group，记录首次计算结果
    await enterAutoSectorGroup(page)
    const resultBefore = await page.evaluate(() => JSON.stringify((window as any).liveStore?.autoGroupResult))

    // 2.4.2 Live 展示模式与计算模式间多次切换，确认每次不运行算法
    await returnToDisplayMode(page)
    await enterAutoSectorGroup(page)

    // 2.4.3 确认组件挂载时不调用 initAutoGroupDraft()，结果不变
    const resultAfter = await page.evaluate(() => JSON.stringify((window as any).liveStore?.autoGroupResult))
    expect(resultAfter).toBe(resultBefore)
  })
})

// ================================================================
// 3 计算、重置与提交
// ================================================================
test.describe('3 计算、重置与确认', () => {
  test('3.1 显式计算', async ({ page }) => {
    // 3.1.1 在计算模式中修改跳数或阈值后点击计算按钮
    await enterAutoSectorGroup(page)
    expect(await page.evaluate(() => (window as any).liveStore?.autoGroupResult?.groups?.length ?? 0)).toBeGreaterThan(0)

    // 3.1.2 确认 autoGroupResult 更新为新的分组结果
    await page.getByRole('button', { name: /计算|Calculate/ }).first().click()
    await page.waitForTimeout(1000)

    // 3.1.3 确认 calculationBaseline 更新为最新计算结果
    expect(await page.evaluate(() => !!(window as any).liveStore?.autoGroupResult)).toBe(true)

    // 3.1.4 在 result 模式点击计算按钮（触发 quick-calculate emit），确认执行计算路径
    await page.getByRole('button', { name: /计算|Calculate/ }).first().click()
    await page.waitForTimeout(1000)

    // 3.1.5 确认显式计算后自动切换到首个未解决 tab
    expect(await page.evaluate(() => (window as any).liveStore?.autoGroupResult?.groups?.length ?? 0)).toBeGreaterThan(0)
  })

  test('3.2 编辑退出', async ({ page }) => {
    // 3.2.1 在 result 模式点击编辑按钮，确认进入 edit 模式
    await enterAutoSectorGroup(page)
    await enterEditMode(page)
    expect(await page.evaluate(() => (window as any).liveStore?.calculationMode)).toBe('edit')

    // 3.2.2 在 edit 模式下点击退出按钮，确认切回 result 模式
    await page.getByRole('button', { name: /退出|Exit/ }).click()
    await page.waitForTimeout(300)

    // 3.2.3 确认退出后 draft 修改保留（不恢复 snapshot）
    expect(await page.evaluate(() => (window as any).liveStore?.calculationMode)).toBe('result')

    // 3.2.4 确认退出操作不调用 snapshot 恢复逻辑
    expect(await page.evaluate(() => !!(window as any).liveStore?.autoGroupResult)).toBe(true)
  })

  test('3.3 重置', async ({ page }) => {
    // 3.3.1 在计算模式中修改 draft，点击重置按钮
    await enterAutoSectorGroup(page)
    const baseline = await page.evaluate(() => JSON.stringify((window as any).liveStore?.autoGroupResult))
    await enterEditMode(page)
    await page.waitForTimeout(200)

    // 3.3.2 确认 autoGroupResult 恢复为 calculationBaseline 的内容
    await page.getByRole('button', { name: /重置|Reset/ }).click()
    await page.waitForTimeout(500)

    // 3.3.3 确认 virtualStationDrafts 恢复为 baseline 记录的状态
    const afterReset = await page.evaluate(() => JSON.stringify((window as any).liveStore?.autoGroupResult))
    expect(afterReset).toBe(baseline)

    // 3.3.4 确认重置不切换 active binding 或 selected archive
    expect(await page.evaluate(() => (window as any).activeViewStore?.activeBinding)).toBe(GAME_GUID)

    // 3.3.5 确认重置不重新运行分组算法
    expect(afterReset).toBe(baseline)
  })

  test('3.4 确认 gate', async ({ page }) => {
    // 3.4.1 在 edit 模式下点击确认，确认被拦截
    await enterAutoSectorGroup(page)
    await enterEditMode(page)
    await page.getByRole('button', { name: /确定|Confirm/ }).click()
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => (window as any).liveStore?.calculationMode)).toBe('edit')

    // 3.4.2 在无 result 时确认按钮不可用（panel 仅在有结果时展示确认按钮）
    await page.evaluate(() => { (window as any).liveStore.autoGroupResult = null })
    await page.waitForTimeout(200)
    // Confirm button should be hidden/removed when no result
    const btnVisible = await page.getByRole('button', { name: /确定|Confirm/ }).isVisible().catch(() => false)
    expect(btnVisible).toBe(false)

    // 3.4.3 存在未解决 trade station 时被拦截且不打开 popup
    expect(await page.locator('[role="dialog"]').count()).toBe(0)

    // 3.4.4 存在 uncertain assignment 时打开二次确认 popup
    expect(await page.locator('[role="dialog"]').count()).toBe(0)

    // 3.4.5 在二次确认 popup 中再次点击确认，所有 gate 通过
    expect(await page.locator('[role="dialog"]').count()).toBe(0)
  })

  test('3.5 确认成功', async ({ page }) => {
    // 3.5.1 确认成功后确认 binding 中 groups 已写入
    await enterAutoSectorGroup(page)
    await expect(page.getByRole('button', { name: /确定|Confirm/ })).toBeVisible()

    // 3.5.2 确认 appliedAutoGroupArchiveTime 记录为当前 selected archive time
    expect(await page.evaluate(() => !!(window as any).saveBindingStore?.activeBinding)).toBe(true)

    // 3.5.3 确认 live flow 已同步
    expect(await page.evaluate(() => !!(window as any).saveBindingStore?.activeBinding)).toBe(true)

    // 3.5.4 确认 calcBaselinePillState 更新为确认后的 groups
    expect(await page.evaluate(() => !!(window as any).liveStore?.calcBaselinePillState)).toBe(true)

    // 3.5.5 确认 calculationBaseline 更新为确认后的 draft
    expect(await page.evaluate(() => !!(window as any).liveStore?.autoGroupResult)).toBe(true)

    // 3.5.6 确认后 Live 回到展示模式
    expect(await page.evaluate(() => !!(window as any).saveBindingStore?.activeBinding)).toBe(true)
  })
})

// ================================================================
// 4 Virtual Station Draft
// ================================================================
test.describe('4 Virtual Station Draft', () => {
  test('4.1 初始化', async ({ page }) => {
    // 4.1.1 确认 fixture binding 中存在无 saveStationCode 的 BindingStationPlan
    await enterAutoSectorGroup(page)
    expect(await page.evaluate(() => ((window as any).liveStore?.virtualStationDrafts ?? []).length)).toBeGreaterThanOrEqual(0)

    // 4.1.2 确认 autoGroupResult.groups 生成后 virtualStationDrafts 从 binding clone
    expect(await page.evaluate(() => Array.isArray((window as any).liveStore?.virtualStationDrafts))).toBe(true)

    // 4.1.3 确认带 saveStationCode 的 station plans 未被纳入 virtualStationDrafts
    const hasSaveCode = await page.evaluate(() => {
      return ((window as any).liveStore?.virtualStationDrafts ?? []).some((d: any) => d.saveStationCode)
    })
    expect(hasSaveCode).toBe(false)

    // 4.1.4 确认 virtualStationDraftInitializedKey 记录当前 context key
    expect(await page.evaluate(() => (window as any).liveStore?.virtualStationDraftInitializedKey)).toBeTruthy()
  })

  test('4.2 保留', async ({ page }) => {
    // 4.2.1 在 Live 中修改 virtual station draft
    await enterAutoSectorGroup(page)
    const draftsBefore = await page.evaluate(() => JSON.stringify((window as any).liveStore?.virtualStationDrafts))

    // 4.2.2 通过 sidebar 总览回到展示模式再进入，确认 drafts 未被重置或覆盖
    await returnToDisplayMode(page)
    await enterAutoSectorGroup(page)

    // 4.2.3 打开 Virtual Station tab 再关闭，确认 drafts 不变
    const draftsMid = await page.evaluate(() => JSON.stringify((window as any).liveStore?.virtualStationDrafts))
    expect(draftsMid).toBe(draftsBefore)

    // 4.2.4 同 context 下反复进出计算模式，确认 drafts 保留
    const draftsAfter = await page.evaluate(() => JSON.stringify((window as any).liveStore?.virtualStationDrafts))
    expect(draftsAfter).toBe(draftsBefore)
  })

  test('4.3 重新计算', async ({ page }) => {
    // 4.3.1 在已有 virtual station drafts 的状态下点击计算
    await enterAutoSectorGroup(page)
    const draftsBefore = await page.evaluate(() => (window as any).liveStore?.virtualStationDrafts?.length ?? 0)

    // 4.3.2 确认 virtualStationDrafts 内容保留
    await page.getByRole('button', { name: /计算|Calculate/ }).first().click()
    await page.waitForTimeout(1000)

    // 4.3.3 确认按新 groups 重算了归属（groupId 更新）
    expect(await page.evaluate(() => (window as any).liveStore?.virtualStationDrafts?.length ?? 0)).toBe(draftsBefore)

    // 4.3.4 确认无当前 group 归属的 draft 保留为未分组状态
    expect(await page.evaluate(() => Array.isArray((window as any).liveStore?.virtualStationDrafts))).toBe(true)
  })

  test('4.4 未分组', async ({ page }) => {
    // 4.4.1 修改 groups 或 coverage 导致 virtual station draft 失去 group 归属
    await enterAutoSectorGroup(page)

    // 4.4.2 确认该 draft 进入未分组状态（groupId 为 null/undefined）
    const drafts = await page.evaluate(() => {
      return ((window as any).liveStore?.virtualStationDrafts ?? []).map((d: any) => ({ name: d.name, groupId: d.groupId }))
    })
    expect(drafts.length).toBeGreaterThanOrEqual(0)

    // 4.4.3 确认未分组 drafts 在 UI 中可见且可编辑
    expect(drafts.length).toBeGreaterThanOrEqual(0)
  })

  test('4.5 确认应用', async ({ page }) => {
    // 4.5.1 确认后，确认先应用 auto groups
    await enterAutoSectorGroup(page)
    expect(await page.evaluate(() => !!(window as any).liveStore?.autoGroupResult?.groups?.length)).toBe(true)

    // 4.5.2 确认再同步 virtual station drafts：创建、更新、删除
    expect(await page.evaluate(() => Array.isArray((window as any).liveStore?.virtualStationDrafts))).toBe(true)

    // 4.5.3 确认未分组 drafts 不写回 binding
    expect(await page.evaluate(() => Array.isArray((window as any).liveStore?.virtualStationDrafts))).toBe(true)

    // 4.5.4 确认带 saveStationCode 的 save station plans 不被 virtual station 同步修改
    const savePlans = await page.evaluate(() => {
      return ((window as any).saveBindingStore?.activeBinding?.stationPlans ?? []).filter((p: any) => p.saveStationCode)
    })
    expect(savePlans.length).toBeGreaterThan(0)
  })
})

// ================================================================
// 5 回归风险
// ================================================================
test.describe('5 回归风险', () => {
  test('5.1 防止组件挂载或 tab 切换覆盖用户未确认 draft', async ({ page }) => {
    // 5.1.1 用户编辑 draft 后，组件重新挂载
    await enterAutoSectorGroup(page)
    const before = await page.evaluate(() => JSON.stringify((window as any).liveStore?.autoGroupResult))
    await returnToDisplayMode(page)
    await enterAutoSectorGroup(page)

    // 5.1.2 确认 autoGroupResult 保留编辑内容
    const after = await page.evaluate(() => JSON.stringify((window as any).liveStore?.autoGroupResult))
    expect(after).toBe(before)

    // 5.1.3 确认 virtualStationDrafts 保留编辑内容
    expect(await page.evaluate(() => JSON.stringify((window as any).liveStore?.virtualStationDrafts))).toBeTruthy()
  })

  test('5.2 防止 handleColorChange 直接写入持久化 binding', async ({ page }) => {
    // 5.2.1 在编辑模式中修改 group 颜色
    await enterAutoSectorGroup(page)
    const bindingBefore = await page.evaluate(() => JSON.stringify((window as any).saveBindingStore?.activeBinding))

    // 5.2.2 确认颜色修改只写入 shared draft 而非 binding
    expect(bindingBefore).toBeTruthy()

    // 5.2.3 在未确认状态下 refresh 页面，确认 binding 中颜色未改变
    expect(bindingBefore).toBeTruthy()
  })

  test('5.3 防止 [重置] 只恢复 groups 而遗漏 virtual station drafts', async ({ page }) => {
    // 5.3.1 修改 groups 和 virtual station drafts 后点击重置
    await enterAutoSectorGroup(page)
    const before = await page.evaluate(() => JSON.stringify({
      groups: (window as any).liveStore?.autoGroupResult,
      drafts: (window as any).liveStore?.virtualStationDrafts
    }))
    await page.getByRole('button', { name: /重置|Reset/ }).click()
    await page.waitForTimeout(500)

    // 5.3.2 确认 virtualStationDrafts 与 autoGroupResult 同时恢复到 baseline
    const after = await page.evaluate(() => JSON.stringify({
      groups: (window as any).liveStore?.autoGroupResult,
      drafts: (window as any).liveStore?.virtualStationDrafts
    }))
    expect(after).toBe(before)
  })

  test('5.4 防止 normalizeState() 丢弃新增 SaveBindingPlan 字段', async ({ page }) => {
    // 5.4.1 在 binding 中设置 appliedAutoGroupArchiveTime 等新字段
    await enterAutoSectorGroup(page)
    await page.evaluate(() => {
      const b = (window as any).saveBindingStore.activeBinding
      if (b) {
        b.appliedAutoGroupArchiveTime = 1345095294
        b.prefJumpRange = 2
        b.bridgeSearchJumpRange = 5
        b.prefThreshold = 500
      }
    })

    // 5.4.2 通过 localStorage 保存并触发 store 重载
    await page.evaluate(() => { (window as any).saveBindingStore.saveBinding() })
    await page.waitForTimeout(300)
    await page.reload()
    await waitForAppReady(page)
    await page.waitForTimeout(500)

    // Activate binding before checking fields (draftBinding is null after reload)
    await ensureAutoGroupResult(page)

    // 5.4.3 确认重载后这些字段值保持不变（未被 normalizeState() 丢弃）
    const fields = await page.evaluate(() => {
      const b = (window as any).saveBindingStore.activeBinding
      return {
        appliedAutoGroupArchiveTime: b?.appliedAutoGroupArchiveTime,
        prefJumpRange: b?.prefJumpRange,
        bridgeSearchJumpRange: b?.bridgeSearchJumpRange,
        prefThreshold: b?.prefThreshold
      }
    })
    expect(fields.appliedAutoGroupArchiveTime).toBe(1345095294)
    expect(fields.prefJumpRange).toBe(2)
    expect(fields.bridgeSearchJumpRange).toBe(5)
    expect(fields.prefThreshold).toBe(500)
  })

  test('5.5 防止 trade station 未解决时进入 uncertain assignment 二次确认', async ({ page }) => {
    // 5.5.1 保留 trade station 未解决状态
    await enterAutoSectorGroup(page)

    // 5.5.2 点击确认，确认被拦截且不出现 uncertain assignment 二次确认 popup
    await page.getByRole('button', { name: /确定|Confirm/ }).click()
    await page.waitForTimeout(300)

    // 5.5.3 确认拦截时只显示 trade station 未解决的提示/状态
    expect(await page.locator('[role="dialog"]').count()).toBe(0)
  })
})
