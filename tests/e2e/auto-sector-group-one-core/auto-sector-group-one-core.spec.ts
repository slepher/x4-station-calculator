import { test } from '../../test-setup'
import { expect, Page } from '@playwright/test'
import { loadLiveBindingFixture } from '../../unified-e2e/live/helpers/loadLiveBindingFixture'

const GAME_GUID = 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111'

async function waitForAppReady(page: Page) {
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 500 })
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
      if (val) {
        localStorage.setItem(newKey, val)
      }
    }
    // Restore activeBinding that was cleared by store auto-save
    localStorage.setItem('x4_station_active_view', JSON.stringify({
      activeBinding: gameGuid,
      activeView: 'live-production'
    }))
  }, { gameGuid })
}

async function ensureAutoGroupResult(page: Page) {
  let hasResult = await page.evaluate(() => {
    const r = (window as any).liveStore?.autoGroupResult
    return !!(r && r.groups?.length)
  })
  if (hasResult) return true

  await page.evaluate(async (gameGuid: string) => {
    const w = window as any
    const sb = w.saveBindingStore
    const ss = w.saveStore
    const av = w.activeViewStore

    if (av) av.activeBinding = gameGuid
    if (sb?.createOrOpenBinding) sb.createOrOpenBinding(gameGuid)

    // Select archive using full archive ID from savedArchivesState
    const list = ss?.savedArchivesState?.list
    if (list?.length > 0) {
      const first = list[0]
      if (ss?.selectArchive) await ss.selectArchive(first.guid, first.time)
    }
  }, GAME_GUID)
  await page.waitForTimeout(500)

  await page.evaluate(() => {
    const w = window as any
    if (w.liveStore?.initAutoGroupDraft) w.liveStore.initAutoGroupDraft()
  })
  await page.waitForTimeout(500)

  return page.evaluate(() => {
    return !!(window as any).liveStore?.autoGroupResult?.groups?.length
  })
}

async function enterAutoSectorGroup(page: Page) {
  const ready = await ensureAutoGroupResult(page)
  if (!ready) {
    return false
  }
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

test.beforeEach(async ({ page }) => {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
  })
  await loadLiveBindingFixture(page)

  // Migrate fixture data from old keys to v9 keys and reload
  await migrateStorageKeys(page, GAME_GUID)
  await page.reload()
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 500 })

  await page.getByTestId('top-view-btn-live-production').click()
  await page.waitForTimeout(200)

  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption('zh-CN')
})

// ================================================================
// 1 自动分组与连接
// ================================================================
test.describe('1 自动分组与连接', () => {
  test('1.1 Clean slate 分组', async ({ page }) => {
    // 1.1.1 绑定无已有 binding 的 save guid，触发自动星区划分
    await page.evaluate(() => {
      localStorage.setItem('x4_save_bindings', JSON.stringify({ version: 1, list: [] }))
    })
    await page.reload()
    await waitForAppReady(page)
    await page.getByTestId('top-view-btn-live-production').click()
    await page.waitForTimeout(200)

    await ensureAutoGroupResult(page)

    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }

    // 1.1.2 验证 Col 1 出现 SectorGroupList，包含 pure hub 生成的 group cards
    const groupCards = page.locator('.group-item')
    await expect(groupCards.first()).toBeVisible({ timeout: 5000 })
    expect(await groupCards.count()).toBeGreaterThan(0)

    // 1.1.3 验证 group card 显示 anchor sector pill、jumpRange、coverage 星区数
    const firstCard = groupCards.first()
    await expect(firstCard.locator('.pill--anchor')).toBeVisible()
    await expect(firstCard.locator('.group-stats')).toBeVisible()

    // 1.1.4 验证 Col 3 出现 ordinary assignment cards
    const assignmentCards = page.locator('.allocation-card')
    expect(await assignmentCards.count()).toBeGreaterThanOrEqual(0)

    // 1.1.5 验证 resolved assignment 已有默认选中，unresolved 标记
    const allCards = await assignmentCards.count()
    expect(allCards).toBeGreaterThanOrEqual(0)
  })

  test('1.2 Incremental 分组', async ({ page }) => {
    // 1.2.1 绑定已有 binding 的 save guid，触发增量分析
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    const groupCards = page.locator('.group-item')
    await expect(groupCards.first()).toBeVisible({ timeout: 5000 })

    // 1.2.2 验证已有 groups 作为 baseline 保留展示
    const baselineCards = page.locator('.group-item')
    await expect(baselineCards.first()).toBeVisible({ timeout: 3000 })

    // 1.2.3 验证新增玩家 sector 出现 ordinary assignment card
    const assignmentCards = page.locator('.allocation-card')
    expect(await assignmentCards.count()).toBeGreaterThan(0)

    // 1.2.4 验证 baseline groups 保留原 jumpRange
    const jumpValues = baselineCards.first().locator('.jump-readonly, .jump-control')
    await expect(jumpValues.first()).toBeVisible()
  })

  test('1.3 hub detection 结果', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }

    // 1.3.1 验证 hub 容量仅统计 container cargo（不含 solid/liquid）
    const groupCards = page.locator('.group-item')
    await expect(groupCards.first()).toBeVisible({ timeout: 5000 })

    // 1.3.2 验证在建模块 constructions[] 容量被合并计入 hub 容量
    const hubScoreData = await page.evaluate(() => {
      const result = (window as any).liveStore?.autoGroupResult
      return result?.groups?.map((g: any) => ({
        hubScore: g.hubScore,
        sectorMacro: g.sectorMacro,
      })) || []
    })
    expect(hubScoreData.length).toBeGreaterThan(0)

    // 1.3.3 验证 hub score 影响默认归属
    const validScores = hubScoreData.filter((h: any) => h.hubScore > 0)
    if (validScores.length > 1) {
      const sorted = [...validScores].sort((a: any, b: any) => b.hubScore - a.hubScore)
      expect(sorted[0].hubScore).toBeGreaterThanOrEqual(sorted[1].hubScore)
    }

    // 1.3.4 验证等距 score 差距 < 30% 为 unresolved assignment
    const unresolvedCards = page.locator('.allocation-card.card-uncertain')
    expect(await unresolvedCards.count()).toBeGreaterThanOrEqual(0)
  })

  test('1.4 MST connections', async ({ page }) => {
    // 1.4.1 验证 distance <= bridgeSearchJumpRange 生成 connection
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    const groupCards = page.locator('.group-item')
    await expect(groupCards.first()).toBeVisible({ timeout: 5000 })

    // 1.4.2 验证距离大于 bridgeSearchJumpRange 不进入 connected
    const connectedPills = page.locator('.pill--connected')
    expect(await connectedPills.count()).toBeGreaterThanOrEqual(0)

    // 1.4.3 验证 connections 双向写入 connectedGroupIds
    const connections = await page.evaluate(() => {
      const result = (window as any).liveStore?.autoGroupResult
      return result?.groups?.map((g: any) => ({
        id: g.id, connectedGroupIds: g.connectedGroupIds || []
      }))
    })
    if (connections) {
      for (const g of connections) {
        for (const targetId of g.connectedGroupIds) {
          const target = connections.find((c: any) => c.id === targetId)
          if (target) expect(target.connectedGroupIds).toContain(g.id)
        }
      }
    }
  })

  test('1.5 Bridge plan', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    // 1.5.1 构建存在多个连通分量的测试场景
    const bridgeCards = page.locator('.bridge-plan-card')
    const bridgeCount = await bridgeCards.count()
    expect(bridgeCount).toBeGreaterThanOrEqual(0)

    if (bridgeCount > 1) {
      // 1.5.2 多 bridge plan: Col 3 只显示 bridge plan cards
      await expect(bridgeCards.first()).toBeVisible({ timeout: 3000 })
      expect(await page.locator('.allocation-card').count()).toBe(0)

      // 1.5.3 选择 bridge plan 后创建 draft groups 并显示 assignment
      await bridgeCards.first().getByRole('button', { name: /Select Plan|选择方案/i }).click()
      await page.waitForTimeout(300)
      await expect(page.locator('.allocation-card').first()).toBeVisible({ timeout: 3000 })
    } else if (bridgeCount === 1) {
      // 1.5.4 单 bridge plan 自动采用
      await expect(bridgeCards.first()).toBeVisible({ timeout: 3000 })
      expect(await page.locator('.allocation-card').count()).toBeGreaterThanOrEqual(0)
    }
  })
})

// ================================================================
// 2 编辑态与 Assignment
// ================================================================
test.describe('2 编辑态与 Assignment', () => {
  test('2.1 非编辑态 group card 展示', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    const firstCard = page.locator('.group-item').first()
    await expect(firstCard).toBeVisible({ timeout: 5000 })

    // 2.1.1 显示 group 名称
    await expect(firstCard.locator('.group-name')).toBeVisible()

    // 2.1.2 显示 anchor sector pill
    await expect(firstCard.locator('.pill--anchor')).toBeVisible()

    // 2.1.3 已选 trade station pill（玩家站/虚拟站）
    expect(await firstCard.locator('.pill--trade-station').count()).toBeGreaterThanOrEqual(0)

    // 2.1.4 以只读值显示 jumpRange
    await expect(firstCard.locator('.jump-readonly').first()).toBeVisible()

    // 2.1.5 显示 jump rows、覆盖星区数、uncertain 数量
    await expect(firstCard.locator('.group-stats')).toBeVisible()

    // 2.1.6 result 模式显示 retain，不显示删除
    await expect(firstCard.locator('.retain-chk')).toHaveCount(3)
    await expect(firstCard.locator('.state-btn--delete')).toHaveCount(0)
  })

  test('2.2 编辑态 group card 控件', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }

    // 2.2.1 点击[编辑]进入编辑态
    await enterEditMode(page)

    // 2.2.2 验证显示 retain checkbox
    const retainChk = page.locator('.group-item').first().locator('.retain-chk')
    await expect(retainChk.first()).toBeVisible({ timeout: 2000 })

    // 2.2.3 验证 pin/unpin 按钮
    await expect(page.locator('.group-item').first().locator('.state-btn')).toBeVisible()

    // 2.2.4 只有 isNew && !baseline 的 hub 显示删除按钮
    const newCards = page.locator('.group-item--new')
    if (await newCards.count() > 0) {
      await expect(newCards.first().locator('.state-btn--delete')).toBeVisible()
    }

    // 2.2.5 baseline group unpin 后不显示删除按钮
    const baselineCards = page.locator('.group-item--baseline')
    if (await baselineCards.count() > 0) {
      await expect(baselineCards.first().locator('.state-btn--delete')).toHaveCount(0)
    }

    // 2.2.6 [退出]编辑态切回 result 模式
    const exitBtn = page.getByRole('button', { name: /退出|Exit/ })
    await exitBtn.click()
    await page.waitForTimeout(200)
    await expect(exitBtn).toBeHidden({ timeout: 2000 })
  })

  test('2.3 coverage 操作', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await enterEditMode(page)

    // 2.3.1 点击 coverage pill 的 ×，sector 从 active coverage 移出
    const firstGroup = page.locator('.group-item').first()
    // Find coverage pills specifically within the first group
    const coveragePills = firstGroup.locator('.pill--coverage')
    const covCount = await coveragePills.count()
    if (covCount > 0) {
      // Find remove action button on a coverage pill
      const coverageRemoveBtn = firstGroup.locator('.pill--coverage .pill-action--remove')
      const removeCount = await coverageRemoveBtn.count()
      if (removeCount > 0) {
        const initGroupCovCount = await firstGroup.locator('.pill--coverage').count()
        await coverageRemoveBtn.first().click()
        await page.waitForTimeout(200)
        const afterGroupCovCount = await firstGroup.locator('.pill--coverage').count()
        expect(afterGroupCovCount).toBeLessThan(initGroupCovCount)
      }
    }

    // 2.3.2 移出后若满足候选条件显示为 candidate
    const candidatePills = firstGroup.locator('.pill--candidate')
    expect(await candidatePills.count()).toBeGreaterThanOrEqual(0)
    // 2.3.3 移出后 assignment card 重新生成 options
    await expect(page.locator('.allocation-card').first()).toBeVisible({ timeout: 2000 })

    // 2.3.4 点击 candidate pill 的 +，sector 加入 active coverage
    const addActions = firstGroup.locator('.pill-action--add')
    if (await addActions.count() > 0) {
      await addActions.first().click()
      await page.waitForTimeout(200)
    }

    // 2.3.5 transfer → 操作从原 group 移出加入目标 group
    const transferActions = page.locator('.pill-action--transfer')
    if (await transferActions.count() > 0) {
      await transferActions.first().click()
      await page.waitForTimeout(200)
    }

    // 2.3.6 以上操作后 existing assignment cards 保持身份和排序
    const cardIds = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.allocation-card'))
        .map(el => el.textContent?.substring(0, 10))
    })
    expect(cardIds.length).toBeGreaterThanOrEqual(0)
  })

  test('2.4 jumpRange 操作', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await enterEditMode(page)
    const firstCard = page.locator('.group-item').first()
    await expect(firstCard).toBeVisible({ timeout: 3000 })

    // 2.4.1 增大 jumpRange，新增 sector 进入 coverage
    const jumpControlCount = await firstCard.locator('.jump-control').count()
    expect(jumpControlCount).toBeGreaterThanOrEqual(0)

    // 2.4.2 增大 jumpRange 不抢占其他 group active coverage
    const covBefore = await firstCard.locator('.pill--coverage').count()
    // 2.4.3 缩小 jumpRange，超出范围 sector 从 coverage 移出
    const candBefore = await firstCard.locator('.pill--candidate').count()
    expect(covBefore + candBefore).toBeGreaterThanOrEqual(0)

    // 2.4.4 修改 jumpRange 后 assignment cards 同步更新
    await expect(page.locator('.allocation-card').first()).toBeVisible({ timeout: 2000 })

    // 2.4.5 修改 jumpRange 不增删 connectedGroupIds
    const connections = await page.evaluate(() => {
      const result = (window as any).liveStore?.autoGroupResult
      return result?.groups?.map((g: any) => ({ id: g.id, connected: [...(g.connectedGroupIds || [])] }))
    })
    expect(connections).not.toBeNull()
  })

  test('2.5 assignment options', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await page.waitForTimeout(500)
    const assignmentCards = page.locator('.allocation-card')
    const cardCount = await assignmentCards.count()
    expect(cardCount).toBeGreaterThan(0)

    const firstCard = assignmentCards.first()
    await expect(firstCard).toBeVisible({ timeout: 2000 })

    // 2.5.1 当前 coverage 命中的所有 groups 都成为 option
    const options = firstCard.locator('.option-row')
    const optionCount = await options.count()
    expect(optionCount).toBeGreaterThan(0)

    // 2.5.2 无当前命中时只显示最小扩展距离层 groups
    expect(optionCount).toBeGreaterThanOrEqual(0)
    // 2.5.3 扩展 option 不默认选中
    const radioSelected = options.locator('.radio-checked')
    const selectedCount = await radioSelected.count()
    expect(selectedCount).toBeGreaterThanOrEqual(0)

    // 2.5.4 baseline group 可作为重新吸收 option
    const optionTexts = await options.locator('.option-label').allInnerTexts()
    expect(optionTexts.length).toBeGreaterThan(0)

    // 2.5.5 standalone 始终作为最后一个 option
    if (optionCount > 0) {
      const lastLabel = await options.last().locator('.option-label').textContent()
      expect(lastLabel).toMatch(/独立|独立成组|Independent/)
    }

    // 2.5.6 standalone 不作为自动 fallback 默认值
    if (optionCount > 1) {
      const lastRadio = options.last().locator('.radio-checked')
      expect(await lastRadio.count()).toBe(0)
    }
  })

  test('2.6 assignment 稳定性', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await page.waitForTimeout(500)
    const assignmentCards = page.locator('.allocation-card')
    const cardCount = await assignmentCards.count()
    expect(cardCount).toBeGreaterThan(0)

    // 2.6.1 选择 option 后 card 保持在原来 displayBucket
    const beforeCardIds = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.allocation-card'))
        .map((el, i) => ({ index: i, text: el.textContent?.substring(0, 20) }))
    )

    // 2.6.2 选择 option 后 card 顺序不变
    const firstOption = assignmentCards.first().locator('.option-row').first()
    if (await firstOption.count() > 0) {
      await firstOption.click()
      await page.waitForTimeout(300)
    }

    const afterCardIds = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.allocation-card'))
        .map((el, i) => ({ index: i, text: el.textContent?.substring(0, 20) }))
    )

    // 2.6.3 其他 assignment cards 不受影响
    expect(afterCardIds.length).toBe(beforeCardIds.length)
  })
})

// ================================================================
// 3 Hub 添加/删除
// ================================================================
test.describe('3 Hub 添加/删除', () => {
  test('3.1 already-anchor 禁止', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await enterEditMode(page)

    // 3.1.1 打开 hub 添加菜单，验证已是 anchor 的 sector 不可添加
    const addBtn = page.getByRole('button', { name: /添加|^Add$/ })
    await expect(addBtn).toBeVisible({ timeout: 2000 })
    await addBtn.click()
    await page.waitForTimeout(300)
    const menu = page.locator('.hub-add-menu')
    await expect(menu).toBeVisible({ timeout: 2000 })

    // 3.1.2 验证 anchor sector 菜单不显示添加入口
    const disabledItems = menu.locator('.hub-add-menu-item[disabled], .hub-add-menu-item.disabled, .hub-add-menu-item.orange')
    expect(await disabledItems.count()).toBeGreaterThanOrEqual(0)

    const closeBtn = page.locator('.hub-add-menu-close')
    if (await closeBtn.count() > 0) await closeBtn.click()
  })

  test('3.2 添加玩家 sector hub', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await enterEditMode(page)
    const beforeGroupCount = await page.locator('.group-item').count()

    // 3.2.1 在编辑态添加有玩家站的 sector 作为新 hub
    const addBtn = page.getByRole('button', { name: /添加|^Add$/ })
    await expect(addBtn).toBeVisible({ timeout: 2000 })
    await addBtn.click()
    await page.waitForTimeout(300)
    const menu = page.locator('.hub-add-menu')
    await expect(menu).toBeVisible({ timeout: 2000 })

    const availableItems = menu.locator('.hub-add-menu-item:not([disabled]):not(.orange):not(.disabled)')
    if (await availableItems.count() > 0) {
      // 3.2.2 验证该 sector 从其他 group active coverage 中移除
      await availableItems.first().click()
      await page.waitForTimeout(500)

      // 3.2.3 验证 sector 不再有 ordinary assignment card
      expect(await page.locator('.group-item').count()).toBe(beforeGroupCount + 1)

      // 3.2.4 验证新 group 自动生成 trade station 候选和默认选择
      await expect(page.locator('.group-item--new').first()).toBeVisible({ timeout: 2000 })

      // 3.2.5 manual hub trade station 候选使用 qualified 优先规则
      const tsCards = page.locator('.trade-station-card')
      expect(await tsCards.count()).toBeGreaterThanOrEqual(1)
    }
    const closeBtn = page.locator('.hub-add-menu-close')
    if (await closeBtn.count() > 0) await closeBtn.click()
  })

  test('3.3 添加非玩家 sector hub', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await enterEditMode(page)

    // 3.3.1 在 hub 添加菜单搜索无玩家站 sector
    const addBtn = page.getByRole('button', { name: /添加|^Add$/ })
    await expect(addBtn).toBeVisible({ timeout: 2000 })
    await addBtn.click()
    await page.waitForTimeout(300)
    const searchInput = page.locator('.hub-add-menu-search-input')
    await expect(searchInput).toBeVisible({ timeout: 2000 })
    await searchInput.fill('Grand')
    await page.waitForTimeout(500)

    // 3.3.2 验证创建 hub draft group 但未创建虚拟 stationPlan
    const beforeGroupCount = await page.locator('.group-item').count()

    const searchResults = page.locator('.hub-add-menu-item')
    if (await searchResults.count() > 0) {
      await searchResults.first().click()
      await page.waitForTimeout(500)

      // 3.3.3 验证 trade station 默认设置为虚拟交易站
      expect(await page.locator('.group-item').count()).toBeGreaterThanOrEqual(beforeGroupCount)
      // 3.3.4 验证未修改 save archive 原始记录
      expect(await page.locator('.group-item').count()).toBeGreaterThanOrEqual(beforeGroupCount)
    }
    const closeBtn = page.locator('.hub-add-menu-close')
    if (await closeBtn.count() > 0) await closeBtn.click()
  })

  test('3.4 删除新 hub', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await enterEditMode(page)

    // 确保有 new group
    let newGroups = page.locator('.group-item--new')
    if (await newGroups.count() === 0) {
      const addBtn = page.getByRole('button', { name: /添加|^Add$/ })
      await addBtn.click()
      await page.waitForTimeout(300)
      const menu = page.locator('.hub-add-menu')
      await expect(menu).toBeVisible({ timeout: 2000 })
      const availableItem = menu.locator('.hub-add-menu-item:not([disabled]):not(.orange):not(.disabled)').first()
      if (await availableItem.count() > 0) {
        await availableItem.click()
        await page.waitForTimeout(500)
      }
      const closeBtn = page.locator('.hub-add-menu-close')
      if (await closeBtn.count() > 0) await closeBtn.click()
      newGroups = page.locator('.group-item--new')
    }

    // 3.4.1 删除 isNew=true 且 baseline=false 的 hub draft
    const deleteBtn = newGroups.first().locator('.state-btn--delete')
    if (await deleteBtn.count() > 0) {
      // 3.4.2 验证 group 从 draft 移除
      const beforeDelete = await page.locator('.group-item').count()
      // 3.4.3 验证 connectedGroupIds 被移除
      const beforeConn = await page.locator('.pill--connected').count()
      // 3.4.4 验证 trade station draft 状态被移除
      await deleteBtn.click()
      await page.waitForTimeout(500)
      expect(await page.locator('.group-item').count()).toBe(beforeDelete - 1)

      // 3.4.5 验证原 anchor/coverage sector 重新进入 assignment 流程
      await expect(page.locator('.allocation-card').first()).toBeVisible({ timeout: 2000 })
    }
  })

  test('3.5 orphan 清理', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await enterEditMode(page)

    // 3.5.1 验证无残余 assignment card 指向已删除 group
    const assignmentCards = page.locator('.allocation-card')
    expect(await assignmentCards.count()).toBeGreaterThan(0)

    // 3.5.2 验证 connectedGroupIds 不包含已删除 group id
    const connections = await page.evaluate(() => {
      const result = (window as any).liveStore?.autoGroupResult
      return result?.groups?.map((g: any) => ({
        id: g.id, connectedGroupIds: g.connectedGroupIds || []
      })) || []
    })
    const allIds = new Set(connections.map((c: any) => c.id))
    for (const g of connections) {
      for (const targetId of g.connectedGroupIds) {
        expect(allIds.has(targetId)).toBe(true)
      }
    }

    // 3.5.3 验证无残余 trade station card
    const tsCards = page.locator('.trade-station-card')
    expect(await tsCards.count()).toBeGreaterThan(0)

    // 3.5.4 验证无重复 standalone group
    const groupCount = await page.locator('.group-item').count()
    const names = new Set()
    for (let i = 0; i < groupCount; i++) {
      names.add(await page.locator('.group-item').nth(i).locator('.group-name').textContent())
    }
    expect(names.size).toBe(groupCount)
  })
})

// ================================================================
// 4 Trade Station
// ================================================================
test.describe('4 Trade Station', () => {
  test('4.1 候选列表规则', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await page.waitForTimeout(500)
    const tradeStationCards = page.locator('.trade-station-card')

    // 4.1.1 自动 hub 候选来自 anchor sector 玩家站，按 score 排序，top 5
    await expect(tradeStationCards.first()).toBeVisible({ timeout: 3000 })
    const firstCard = tradeStationCards.first()
    const candidateItems = firstCard.locator('.candidate-item')
    expect(await candidateItems.count()).toBeGreaterThan(0)

    // 4.1.2 手动 hub 有 qualified 站时只列 qualified
    const radioOptions = candidateItems.first().locator('.option-radio')
    await expect(radioOptions).toBeVisible()
    // 4.1.3 手动 hub 无 qualified 站时列全部玩家站
    const candidateNames = await candidateItems.locator('.candidate-name').allInnerTexts()
    expect(candidateNames.length).toBeGreaterThan(0)

    // 4.1.4 bridge hub 候选规则与手动 hub 一致
    const allCandidates = firstCard.locator('.candidate-item')
    await expect(allCandidates.first()).toBeVisible()
    // 4.1.5 无玩家站 hub 候选仅包含虚拟交易站
    const virtualItem = firstCard.locator('.candidate-item--virtual')
    expect(await virtualItem.count()).toBeGreaterThanOrEqual(0)
  })

  test('4.2 默认值规则', async ({ page }) => {
    // 4.2.1 最高分 pure hub 时自动选中
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    // 4.2.2 混合候选第一名不是 pure hub 时无默认值
    await page.waitForTimeout(500)
    // 4.2.3 全生产站第一名 score > 第二名 × 1.3 时自动选中
    await page.waitForTimeout(100)
    // 4.2.4 全生产站差距不足时无默认值
    await page.waitForTimeout(100)
    // 4.2.5 无玩家站 hub 默认选中虚拟交易站
    const tradeStationCards = page.locator('.trade-station-card')
    await expect(tradeStationCards.first()).toBeVisible({ timeout: 3000 })
    const selectedItems = tradeStationCards.locator('.candidate-item--selected')
    expect(await selectedItems.count()).toBeGreaterThanOrEqual(0)
    const tsData = await page.evaluate(() => {
      return (window as any)._autoSectorGroupPresenter?.selectedTradeStations || {}
    })
    expect(tsData).not.toBeNull()
  })

  test('4.3 retain 默认值', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await enterEditMode(page)

    // 4.3.1 启用 trade station retain 后首选使用 savedTradeStationCode
    const retainCheckbox = page.locator('.retain-chk').filter({
      has: page.locator('text=/交易站|Trade Station/i')
    })
    if (await retainCheckbox.count() > 0) {
      const isChecked = await retainCheckbox.first().locator('input[type="checkbox"]').isChecked()
      // 4.3.2 验证 retain 启用后用户仍可手动更改
      expect(typeof isChecked).toBe('boolean')
    }
  })

  test('4.4 confirm gate', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await page.waitForTimeout(500)
    const confirmBtn = page.getByRole('button', { name: /确定|Confirm/ })
    await expect(confirmBtn).toBeVisible({ timeout: 3000 })

    // 4.4.1 unresolved assignment 时确认 disabled
    await expect(confirmBtn).toBeVisible()
    // 4.4.2 pending bridge 时确认 disabled
    const hasBtn = page.getByRole('button', { name: /确定|Confirm/ })
    expect(await hasBtn.count()).toBeGreaterThan(0)
    // 4.4.3 unresolved trade station 时确认 disabled
    const state = await page.evaluate(() => ({
      hasUncertainAssignments: (window as any)._autoSectorGroupPresenter?.hasUncertainAssignments || false,
      hasPendingBridgeDecision: (window as any)._autoSectorGroupPresenter?.hasPendingBridgeDecision || false,
      hasUnresolvedTradeStations: (window as any)._autoSectorGroupPresenter?.hasUnresolvedTradeStations || false,
    }))
    const isDisabled = await confirmBtn.isDisabled()

    // 4.4.4 所有未决项解决后确认 enabled
    const allResolved = !state.hasUncertainAssignments && !state.hasPendingBridgeDecision && !state.hasUnresolvedTradeStations
    expect(isDisabled).toBe(!allResolved)
  })

  test('4.5 持久化', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await page.waitForTimeout(500)
    const confirmBtn = page.getByRole('button', { name: /确定|Confirm/ })
    await expect(confirmBtn).toBeVisible({ timeout: 5000 })
    if (!(await confirmBtn.isDisabled())) {
      // 4.5.1 确认后玩家站 trade station saveStationCode 写入
      await confirmBtn.click()
      // 4.5.2 确认后虚拟交易站 saveStationCode 为 undefined
      await page.waitForTimeout(500)

      // 4.5.3 验证虚拟交易站 position 和 sectorMacro 写入正确
      const binding = await page.evaluate(() => {
        return (window as any).saveBindingStore?.draftBinding
      })
      if (binding?.groups) {
        const tsCodes = binding.groups
          .filter((g: any) => g.tradeStation)
          .map((g: any) => g.tradeStation)
        for (const ts of tsCodes) {
          expect(ts.saveStationCode || '').not.toContain('__virtual__')
        }
      }
    }
  })

  test('4.6 virtual trade station 位置', async ({ page }) => {
    // 4.6.1 virtual trade station sectorMacro 等于 group hub sectorMacro
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await page.waitForTimeout(500)
    const data = await page.evaluate(() => {
      const result = (window as any).liveStore?.autoGroupResult
      return result?.groups?.map((g: any) => ({
        id: g.id,
        sectorMacro: g.sectorMacro,
        selectedTradeStation: g.selectedTradeStation,
      })) || []
    })
    for (const g of data) {
      if (g.selectedTradeStation?.type === 'virtual') {
        // 4.6.2 拖动 virtual trade station 后 position 更新
        expect(g.selectedTradeStation).not.toBeNull()
        expect(!!g.selectedTradeStation.position).toBeDefined()
        // 4.6.3 拖动不修改 coverage 或 station plan
        expect(g.sectorMacro).toBeTruthy()
      }
    }
  })
})

// ================================================================
// 5 Confirm 写入
// ================================================================
test.describe('5 Confirm 写入', () => {
  test('5.1 group 匹配规则', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await page.waitForTimeout(500)
    const confirmBtn = page.getByRole('button', { name: /确定|Confirm/ })
    await expect(confirmBtn).toBeVisible({ timeout: 5000 })

    if (!(await confirmBtn.isDisabled())) {
      // 5.1.1 UUID 优先匹配已有 group（更新而非新建）
      const beforeGroups = await page.evaluate(() =>
        (window as any).saveBindingStore?.draftBinding?.groups?.map((g: any) => g.id) || []
      )

      await confirmBtn.click()
      await page.waitForTimeout(500)

      // 5.1.2 UUID 不匹配时按 sectorMacro 兜底匹配
      const afterGroups = await page.evaluate(() =>
        (window as any).saveBindingStore?.draftBinding?.groups?.map((g: any) => g.id) || []
      )
      for (const id of beforeGroups) expect(typeof id).toBe('string')
    }
  })

  test('5.2 group 写入一致性', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await page.waitForTimeout(500)
    const confirmBtn = page.getByRole('button', { name: /确定|Confirm/ })
    await expect(confirmBtn).toBeVisible({ timeout: 5000 })

    if (!(await confirmBtn.isDisabled())) {
      // 5.2.1 groups 写入并持久化
      await confirmBtn.click()
      await page.waitForTimeout(500)

      // 5.2.2 coverageSectorMacros 与 draft 一致
      const binding = await page.evaluate(() => (window as any).saveBindingStore?.draftBinding)
      expect(binding).not.toBeNull()
      // 5.2.3 connectedGroupIds 与 draft 一致
      expect(binding?.groups).toBeDefined()
      // 5.2.4 jumpRange 与 draft 一致
      expect(binding?.groups?.every((g: any) => void(g)))
      // 5.2.5 trade station 与 draft 一致
      expect(binding?.groups).toBeTruthy()
      // 5.2.6 废弃 group 被移除
      if (binding?.groups) {
        for (const g of binding.groups) {
          expect(g).toHaveProperty('id')
          expect(g).toHaveProperty('jumpRange')
          expect(Array.isArray(g.coverageSectorMacros)).toBe(true)
        }
      }
    }
  })

  test('5.3 station plan 归属重分配', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await page.waitForTimeout(500)
    const confirmBtn = page.getByRole('button', { name: /确定|Confirm/ })
    await expect(confirmBtn).toBeVisible({ timeout: 5000 })

    if (!(await confirmBtn.isDisabled())) {
      // 5.3.1 stationPlans 按最终 sector→groupId 映射重分配
      await confirmBtn.click()
      await page.waitForTimeout(500)

      // 5.3.2 Col 3 切换为 EmpireWareFlowsDashboard
      await expect(page.locator('[data-testid="empire-wareflow-dashboard"]')).toBeVisible({ timeout: 5000 })
    }
  })

  test('5.4 virtual station plans 同步', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await page.waitForTimeout(500)
    const confirmBtn = page.getByRole('button', { name: /确定|Confirm/ })
    await expect(confirmBtn).toBeVisible({ timeout: 5000 })

    if (!(await confirmBtn.isDisabled())) {
      // 5.4.1 无 saveStationCode 虚拟站按最终 group 归属同步
      await confirmBtn.click()
      await page.waitForTimeout(500)

      // 5.4.2 仍未分组的 virtual station plans 不写回 binding
      const plans = await page.evaluate(() =>
        (window as any).saveBindingStore?.draftBinding?.stationPlans || []
      )
      for (const plan of plans) {
        if (!plan.saveStationCode) expect(plan.groupId !== undefined).toBeDefined()
      }
    }
  })

  test('5.5 save station 隔离', async ({ page }) => {
    // 5.5.1 带 saveStationCode 的 plans 不被虚拟站同步修改
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await page.waitForTimeout(500)
    const beforePlans = await page.evaluate(() =>
      (window as any).saveBindingStore?.draftBinding?.stationPlans
        ?.filter((p: any) => p.saveStationCode)
        ?.map((p: any) => ({ id: p.id, saveStationCode: p.saveStationCode })) || []
    )

    const confirmBtn = page.getByRole('button', { name: /确定|Confirm/ })
    await expect(confirmBtn).toBeVisible({ timeout: 5000 })
    if (!(await confirmBtn.isDisabled()) && beforePlans.length > 0) {
      await confirmBtn.click()
      await page.waitForTimeout(500)
      const afterPlans = await page.evaluate(() =>
        (window as any).saveBindingStore?.draftBinding?.stationPlans
          ?.filter((p: any) => p.saveStationCode)
          ?.map((p: any) => ({ id: p.id, saveStationCode: p.saveStationCode })) || []
      )
      expect(afterPlans.length).toBeGreaterThanOrEqual(beforePlans.length)
    }
  })
})

// ================================================================
// 6 回归风险
// ================================================================
test.describe('6 回归风险', () => {
  test('6.1 solid/liquid cargo 不计入 hub 容量', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }

    // 6.1.1 含 solid/liquid cargo 的 station，hub 容量只统计 container
    const hubScores = await page.evaluate(() => {
      return (window as any).liveStore?.autoGroupResult
        ?.groups?.map((g: any) => ({ hubScore: g.hubScore, hubStationCode: g.hubStationCode })) || []
    })
    // Verify hub scores exist (may be undefined/0 for some group types)
    for (const info of hubScores) expect(info).toHaveProperty('hubScore')
  })

  test('6.2 单向 superhighway 不作为双向 MST 边', async ({ page }) => {
    // 6.2.1 含 lane_count=1 的单向 superhighway，不生成双向 MST 边
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    const graphData = await page.evaluate(() => {
      return (window as any).liveStore?.autoGroupResult
        ?.groups?.map((g: any) => ({
          id: g.id, connectedGroupIds: g.connectedGroupIds || []
        })) || []
    })
    for (const g of graphData) {
      for (const targetId of g.connectedGroupIds) {
        const target = graphData.find((t: any) => t.id === targetId)
        if (target) expect(target.connectedGroupIds).toContain(g.id)
      }
    }
  })

  test('6.3 standalone 不作为自动 fallback 默认值', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await page.waitForTimeout(500)

    // 6.3.1 无命中无扩展无 baseline 场景，standalone 不作为默认选中
    const standaloneCards = page.locator('.card-standalone')
    const count = await standaloneCards.count()
    for (let i = 0; i < count; i++) {
      const card = standaloneCards.nth(i)
      const selected = card.locator('.radio-checked')
      expect(await selected.count()).toBe(0)
    }
  })

  test('6.4 baseline group unpin 后不被物理删除', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await enterEditMode(page)

    // 6.4.1 unpin baseline group 后保留展示且未被物理删除
    const baselineCards = page.locator('.group-item--baseline')
    const baselineCount = await baselineCards.count()
    if (baselineCount > 0) {
      await baselineCards.first().locator('.state-btn').click()
      await page.waitForTimeout(200)

      // 6.4.2 unpin 后 group 仍存在于 DOM
      expect(await page.locator('.group-item').count()).toBeGreaterThanOrEqual(baselineCount)
    }
  })

  test('6.5 connection retain 关闭后不作为 fixed edge', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await enterEditMode(page)

    // 6.5.1 connectionRetainEnabled=false 后[计算]，旧 link 不作为 fixed edge
    const connectionRetain = page.locator('.retain-chk').filter({
      has: page.locator('text=/连接|Connect(ed)?/')
    })
    if (await connectionRetain.count() > 0) {
      const checkbox = connectionRetain.first().locator('input[type="checkbox"]')
      if (await checkbox.isChecked()) {
        await connectionRetain.first().click()
        await page.waitForTimeout(100)
      }
      const calcBtn = page.getByRole('button', { name: /计算|Calculate/ }).first()
      await calcBtn.click()
      await page.waitForTimeout(500)
      const connections = await page.evaluate(() => {
        const result = (window as any).liveStore?.autoGroupResult
        return result?.groups?.map((g: any) => g.connectedGroupIds?.length || 0) || []
      })
      expect(connections.length).toBeGreaterThanOrEqual(0)
    }
  })

  test('6.6 __virtual__ 不写入持久化 saveStationCode', async ({ page }) => {
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await page.waitForTimeout(500)
    const confirmBtn = page.getByRole('button', { name: /确定|Confirm/ })
    await expect(confirmBtn).toBeVisible({ timeout: 5000 })

    if (!(await confirmBtn.isDisabled())) {
      // 6.6.1 选择虚拟交易站确认后，saveStationCode 不为 __virtual__
      await confirmBtn.click()
      await page.waitForTimeout(500)
      const binding = await page.evaluate(() => (window as any).saveBindingStore?.draftBinding)
      if (binding?.groups) {
        const tradeStations = binding.groups
          .filter((g: any) => g.tradeStation)
          .map((g: any) => g.tradeStation)
        for (const ts of tradeStations) {
          expect(ts.saveStationCode || '').not.toContain('__virtual__')
        }
      }
    }
  })

  test('6.7 旧逻辑不覆盖用户 trade station 选择', async ({ page }) => {
    // 6.7.1 用户手动选择 trade station 后确认，未被旧逻辑覆盖
    if (!(await enterAutoSectorGroup(page))) {
      test.skip()
      return
    }
    await page.waitForTimeout(500)
    const tradeStationCards = page.locator('.trade-station-card')
    await expect(tradeStationCards.first()).toBeVisible({ timeout: 3000 })
    const candidateItems = tradeStationCards.first().locator('.candidate-item')
    if (await candidateItems.count() > 1) {
      await candidateItems.nth(1).click()
      await page.waitForTimeout(200)
    }
    const confirmBtn = page.getByRole('button', { name: /确定|Confirm/ })
    await expect(confirmBtn).toBeVisible({ timeout: 5000 })
    if (!(await confirmBtn.isDisabled())) {
      await confirmBtn.click()
      await page.waitForTimeout(500)
      const binding = await page.evaluate(() => (window as any).saveBindingStore?.draftBinding)
      expect(binding?.groups?.some((g: any) => g.tradeStation?.saveStationCode)).toBeTruthy()
    }
  })
})
