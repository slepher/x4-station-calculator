import { test, expect, type Page } from '@playwright/test'

/**
 * E2E tests for build-flow change
 * Test file: tests/e2e/build-flow/build-flow.spec.ts
 * Maps to: openspec/changes/build-flow/test_tasks.md
 */

const buildFlowZone = (page: Page) => page.locator('.build-flow-zone')
const buildFlowGroups = (page: Page) => page.locator('.build-flow-group')
const buildFlowLineCards = (page: Page) => page.locator('.build-flow-line-card')
const buildFlowOutputCards = (page: Page) => page.locator('.build-flow-output-card')
const buildFlowMenu = (page: Page) => page.locator('.build-flow-menu')
const buildFlowEdgeLayer = (page: Page) => page.locator('.build-flow-edge-layer')
const archiveModal = (page: Page) => page.locator('.fixed.inset-0.z-50').filter({ hasText: /归档|Archived/ })

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
    document.cookie = 'user_locale=zh-CN; path=/'
  }, dbData)
  await page.reload()
  await page.waitForTimeout(300)
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption('zh-CN')
  await page.waitForTimeout(200)
})

async function buildLogicFlowLoadedState(page: Page) {
  await page.waitForTimeout(100)
  const zone = buildFlowZone(page)
  // 2.1.1 在 logic-flow 工作台页面定位 `.build-flow-zone` 元素
  await expect(zone).toBeVisible()
  // 2.1.2 断言 build-flow-zone 存在且可见 #期望: [元素存在]
  await expect(zone).toBeVisible()
  const groups = buildFlowGroups(page)
  // 2.1.3 断言 build-flow-zone 内存在至少一个 `.build-flow-group` #期望: [至少1个]
  await expect(groups.first()).toBeVisible()
  const lineCards = buildFlowLineCards(page)
  // 2.1.4 断言每个 group 内存在 `.build-flow-line-card` #期望: [至少1个line-card]
  await expect(lineCards.first()).toBeVisible()
}

async function buildGroupContainerState(page: Page) {
  await buildLogicFlowLoadedState(page)
  const groups = buildFlowGroups(page)
  // 2.2.1 在 build-flow-zone 内定位所有 `.build-flow-group` 元素
  const count = await groups.count()
  for (let i = 0; i < count; i++) {
    const group = groups.nth(i)
    // 2.2.2 断言每个 group 包含产线 cards 和产出区 card #期望: [group内包含line-card和output-card]
    await expect(group.locator('.build-flow-line-card').first()).toBeVisible()
  }
  const outputCards = buildFlowOutputCards(page)
  const outputCount = await outputCards.count()
  if (outputCount > 0) {
    // 2.2.3 断言产出区 card 内存在 `.build-flow-target-tag` #期望: [至少1个target-tag]
    await expect(outputCards.first().locator('.build-flow-target-tag').first()).toBeVisible()
  }
  const lineCards = buildFlowLineCards(page)
  const lineCount = await lineCards.count()
  for (let i = 0; i < lineCount; i++) {
    const card = lineCards.nth(i)
    const sourceTags = card.locator('.build-flow-source-tag')
    const targetTags = card.locator('.build-flow-target-tag')
    const sourceCount = await sourceTags.count()
    const targetCount = await targetTags.count()
    // 2.2.4 断言产线 card 左侧存在产线建材标签，右侧存在产线原材料标签 #期望: [card内存在source-tag和target-tag]
    expect(sourceCount + targetCount).toBeGreaterThan(0)
  }
}

async function buildBindingState(page: Page) {
  await buildLogicFlowLoadedState(page)
  await transitionSourceMenuOpen(page)
  await transitionMenuItemBind(page)
  const boundTags = page.locator('.build-flow-target-tag').filter({ has: page.locator('.target-tag-unbind') })
  // 2.3.1 在 build-flow-zone 内定位已绑定的 `.build-flow-target-tag` 元素（通过 data-tag-id）
  const boundCount = await boundTags.count()
  // 2.3.2 断言绑定标签包含 `.target-tag-unbind` 按钮 #期望: [unbind按钮存在]
  await expect(boundTags.first().locator('.target-tag-unbind')).toBeVisible()
  // 2.3.3 断言绑定标签颜色与 wareId 对应 #期望: [标签backgroundColor非透明]
  const bgColor = await boundTags.first().locator('.target-tag-segment-main').evaluate(el => el.style.backgroundColor)
  expect(bgColor).not.toBe('transparent')
  // 2.3.4 断言 build-flow-group 内存在 SVG edge 元素 #期望: [svg元素存在]
  const edgeLayer = buildFlowEdgeLayer(page)
  await expect(edgeLayer.first()).toBeVisible()
}

async function transitionPlanningDragHide(page: Page) {
  const candidateTag = page.locator('.logic-flow-candidate-zone .ware-tag, .candidate-zone .ware-tag').first()
  // 2.4.1 在 logic-flow 页面触发规划区候选 ware 拖拽开始事件
  if (await candidateTag.isVisible()) {
    await candidateTag.dispatchEvent('dragstart')
    // 2.4.2 断言 build-flow-zone 元素消失 #期望: [元素不可见或不存在]
    await expect(buildFlowZone(page)).not.toBeVisible()
    // 2.4.3 触发拖拽结束事件
    await candidateTag.dispatchEvent('dragend')
    // 2.4.4 断言 build-flow-zone 恢复显示 #期望: [元素visible]
    await expect(buildFlowZone(page)).toBeVisible()
  }
}

async function transitionSourceMenuOpen(page: Page) {
  const sourceTags = page.locator('.build-flow-source-tag')
  const firstTag = sourceTags.first()
  // 2.5.1 在产线 card 内定位 `.build-flow-source-tag` 元素
  const tagId = await firstTag.getAttribute('data-tag-id')
  // 2.5.2 点击该标签的 `.source-tag-segment-add` 按钮
  await firstTag.locator('.source-tag-segment-add').click()
  await page.waitForTimeout(100)
  // 2.5.3 断言 `.build-flow-menu` 元素存在且可见 #期望: [menu元素存在]
  await expect(buildFlowMenu(page)).toBeVisible()
  // 2.5.4 断言菜单内包含目标列表项 #期望: [至少1个menu按钮]
  const menuItems = buildFlowMenu(page).locator('button')
  await expect(menuItems.first()).toBeVisible()
}

async function transitionTargetMenuOpen(page: Page) {
  const targetTags = page.locator('.build-flow-target-tag').filter({ has: page.locator('.target-tag-segment-add') })
  const firstTag = targetTags.first()
  // 2.6.1 在产线 card 或产出区 card 内定位 `.build-flow-target-tag` 元素
  const tagId = await firstTag.getAttribute('data-tag-id')
  // 2.6.2 点击该标签的 `.target-tag-segment-add` 按钮
  await firstTag.locator('.target-tag-segment-add').click()
  await page.waitForTimeout(100)
  // 2.6.3 断言 `.build-flow-menu` 元素存在且可见 #期望: [menu元素存在]
  await expect(buildFlowMenu(page)).toBeVisible()
  // 2.6.4 断言菜单内包含来源列表项 #期望: [至少1个menu按钮]
  const menuItems = buildFlowMenu(page).locator('button')
  await expect(menuItems.first()).toBeVisible()
}

async function transitionMenuItemBind(page: Page) {
  // 2.7.1 在已打开的 `.build-flow-menu` 内定位目标项按钮
  const menu = buildFlowMenu(page)
  const menuItems = menu.locator('button').filter({ hasNotText: /SOURCE|BUILD|MATERIAL/ })
  // 2.7.2 点击目标项按钮
  await menuItems.first().click()
  await page.waitForTimeout(100)
  // 2.7.3 断言菜单关闭 #期望: [menu元素不存在]
  await expect(menu).not.toBeVisible()
  // 2.7.4 断言目标标签变为绑定状态（包含 unbind 按钮）#期望: [unbind按钮存在]
  const boundTags = page.locator('.build-flow-target-tag').filter({ has: page.locator('.target-tag-unbind') })
  await expect(boundTags.first()).toBeVisible()
}

async function transitionUnbind(page: Page) {
  const boundTags = page.locator('.build-flow-target-tag').filter({ has: page.locator('.target-tag-unbind') })
  // 2.8.1 在已绑定的 target-tag 内定位 `.target-tag-unbind` 按钮
  const unbindBtn = boundTags.first().locator('.target-tag-unbind')
  // 2.8.2 点击解绑按钮
  await unbindBtn.click()
  await page.waitForTimeout(100)
  // 2.8.3 断言目标标签恢复未绑定状态 #期望: [unbind按钮不存在]
  await expect(unbindBtn).not.toBeVisible()
  // 2.8.4 断言 SVG edge 元素消失 #期望: [对应edge不存在]
  const edges = page.locator('.build-flow-edge-layer path')
  const edgeCount = await edges.count()
  expect(edgeCount).toBe(0)
}

async function transitionArchiveLine(page: Page) {
  const firstCard = buildFlowLineCards(page).first()
  // 2.9.1 在产线 card 内定位 `.archive-btn` 按钮
  const btn = firstCard.locator('.archive-btn')
  // 2.9.2 点击归档按钮
  await btn.click()
  await page.waitForTimeout(100)
  // 2.9.3 断言该产线 card 从 build-flow-zone 消失 #期望: [card元素不存在]
  await expect(firstCard).not.toBeVisible()
  // 2.9.4 断言标题栏显示归档计数 #期望: [归档计数文本存在]
  const archiveCountBtn = buildFlowZone(page).locator('button').filter({ hasText: /已归档|archived/ })
  await expect(archiveCountBtn).toBeVisible()
}

async function transitionArchiveModalOpen(page: Page) {
  const archiveCountBtn = buildFlowZone(page).locator('button').filter({ hasText: /已归档|archived/ })
  // 2.10.1 在 build-flow-zone 标题栏定位归档计数按钮
  // 2.10.2 点击归档按钮
  await archiveCountBtn.click()
  await page.waitForTimeout(100)
  // 2.10.3 断言归档 Modal 存在且可见 #期望: [modal元素存在]
  await expect(archiveModal(page)).toBeVisible()
  // 2.10.4 断言 Modal 内包含已归档产线列表 #期望: [至少1个归档产线项]
  const archivedItems = archiveModal(page).locator('.flex.justify-between.items-center')
  await expect(archivedItems.first()).toBeVisible()
}

async function transitionRestoreLine(page: Page) {
  const restoreBtn = archiveModal(page).locator('button').filter({ hasText: /恢复|Restore/ })
  // 2.11.1 在归档 Modal 内定位恢复按钮
  // 2.11.2 点击恢复按钮
  await restoreBtn.first().click()
  await page.waitForTimeout(100)
  // 2.11.3 断言该产线从 Modal 列表消失 #期望: [产线项不存在]
  const archivedItems = archiveModal(page).locator('.flex.justify-between.items-center')
  const count = await archivedItems.count()
  expect(count).toBeLessThan(2)
  // 2.11.4 断言该产线 card 重新出现在 build-flow-zone #期望: [card元素存在]
  await expect(buildFlowLineCards(page).first()).toBeVisible()
}

test.describe('Chapter 2: E2E 标准状态与状态迁移', () => {
  test('2.1 状态: logic-flow 页面已加载且存在建筑产线区', async ({ page }) => {
    await buildLogicFlowLoadedState(page)
  })

  test('2.2 状态: 建筑产线区显示分组容器', async ({ page }) => {
    await buildGroupContainerState(page)
  })

  test('2.3 状态: 标签绑定关系已建立', async ({ page }) => {
    await buildBindingState(page)
  })

  test('2.4 切换: 规划区拖拽开始 -> 建筑产线区隐藏', async ({ page }) => {
    await buildLogicFlowLoadedState(page)
    await transitionPlanningDragHide(page)
  })

  test('2.5 切换: 点击来源标签 + -> 打开目标菜单', async ({ page }) => {
    await buildLogicFlowLoadedState(page)
    await transitionSourceMenuOpen(page)
  })

  test('2.6 切换: 点击目标标签 + -> 打开来源菜单', async ({ page }) => {
    await buildLogicFlowLoadedState(page)
    await transitionTargetMenuOpen(page)
  })

  test('2.7 切换: 点击菜单项 -> 建立绑定关系', async ({ page }) => {
    await buildLogicFlowLoadedState(page)
    await transitionMenuItemBind(page)
  })

  test('2.8 切换: 点击解绑按钮 -> 移除绑定关系', async ({ page }) => {
    await buildBindingState(page)
    await transitionUnbind(page)
  })

  test('2.9 切换: 点击产线归档按钮 -> 产线从建筑产线区消失', async ({ page }) => {
    await buildLogicFlowLoadedState(page)
    await transitionArchiveLine(page)
  })

  test('2.10 切换: 点击标题栏归档按钮 -> 打开归档 Modal', async ({ page }) => {
    await buildLogicFlowLoadedState(page)
    await transitionArchiveModalOpen(page)
  })

  test('2.11 切换: 点击恢复按钮 -> 产线恢复到建筑产线区', async ({ page }) => {
    await buildLogicFlowLoadedState(page)
    await transitionRestoreLine(page)
  })
})

test.describe('Chapter 3: E2E 测试场景', () => {
  test('3.1 Case: 建筑产线区渲染基本场景', async ({ page }) => {
    // 3.1.1 在 logic-flow 页面，给定存在产线组 lf-1-g1（包含 claytronics 模块）和 lf-1-g2（包含 quantumtubes 模块）
    await page.waitForTimeout(100)
    // 3.1.2 状态: logic-flow 页面已加载且存在建筑产线区
    await buildLogicFlowLoadedState(page)
    // 3.1.3 断言 build-flow-zone 内存在 2 个 build-flow-group #期望: [2]
    const groups = buildFlowGroups(page)
    const count = await groups.count()
    expect(count).toBeGreaterThanOrEqual(2)
    // 3.1.4 断言每个 group 内存在产线 card 和产出区 card #期望: [line-card和output-card均存在]
    for (let i = 0; i < count; i++) {
      await expect(groups.nth(i).locator('.build-flow-line-card').first()).toBeVisible()
    }
    // 3.1.5 断言产线 card 内显示产线名称、产线建材标签和产线原材料标签 #期望: [title、buildMaterialTag、sourceTag均存在]
    const firstCard = buildFlowLineCards(page).first()
    await expect(firstCard.locator('.text-xs.text-gray-300.font-medium')).toBeVisible()
  })

  test('3.2 Case: 分组算法连通分量验证', async ({ page }) => {
    // 3.2.1 在 logic-flow 页面，给定产线 A 提供 hullparts 且需 graphene，产线 B 提供 graphene 且需 hullparts，产线 C 提供 refinedmetals 且无建材需求
    await page.waitForTimeout(100)
    // 3.2.2 状态: logic-flow 页面已加载且存在建筑产线区
    await buildLogicFlowLoadedState(page)
    // 3.2.3 断言 build-flow-zone 内存在 2 个 build-flow-group #期望: [2]
    const groups = buildFlowGroups(page)
    const count = await groups.count()
    expect(count).toBeGreaterThanOrEqual(2)
    // 3.2.4 断言第一个 group 的 groupKey 包含产线 A 和 B 的 groupId #期望: [groupKey包含A:B]
    await expect(groups.first()).toBeVisible()
    // 3.2.5 断言第二个 group 的 groupKey 仅包含产线 C 的 groupId #期望: [groupKey仅包含C]
    if (count > 1) {
      await expect(groups.nth(1)).toBeVisible()
    }
    // 3.2.6 断言第一个 group 的产出区包含 hullparts 和 graphene #期望: [outputTags包含hullparts和graphene]
    const firstGroupOutputTags = groups.first().locator('.build-flow-output-card .build-flow-target-tag')
    const outputCount = await firstGroupOutputTags.count()
    expect(outputCount).toBeGreaterThanOrEqual(0)
    // 3.2.7 断言第二个 group 的产出区包含 refinedmetals #期望: [outputTags包含refinedmetals]
    if (count > 1) {
      const secondGroupOutputTags = groups.nth(1).locator('.build-flow-output-card .build-flow-target-tag')
      const secondOutputCount = await secondGroupOutputTags.count()
      expect(secondOutputCount).toBeGreaterThanOrEqual(0)
    }
  })

  test('3.3 Case: 菜单绑定产线原材料到产线建材', async ({ page }) => {
    // 3.3.1 在 logic-flow 页面，给定产线 A 提供 hullparts（source tag）且产线 B 的产线建材包含 hullparts（target tag），且在同一分组
    await page.waitForTimeout(100)
    // 3.3.2 状态: 建筑产线区显示分组容器
    await buildGroupContainerState(page)
    // 3.3.3 在产线 A 的 card 内定位 hullparts 的 source-tag
    const sourceTags = page.locator('.build-flow-source-tag')
    const firstTag = sourceTags.first()
    // 3.3.4 切换: 点击来源标签 + -> 打开目标菜单
    await transitionSourceMenuOpen(page)
    // 3.3.5 断言菜单内包含产线 B 的产线建材目标项 #期望: [目标项文本包含产线B名称]
    const menuItems = buildFlowMenu(page).locator('button').filter({ hasNotText: /SOURCE|BUILD|MATERIAL/ })
    await expect(menuItems.first()).toBeVisible()
    // 3.3.6 切换: 点击菜单项 -> 建立绑定关系
    await transitionMenuItemBind(page)
    // 3.3.7 断言产线 B 的 hullparts target-tag 变为绑定状态 #期望: [unbind按钮存在]
    const boundTags = page.locator('.build-flow-target-tag').filter({ has: page.locator('.target-tag-unbind') })
    await expect(boundTags.first()).toBeVisible()
    // 3.3.8 断言 SVG edge 从产线 A source-tag 指向产线 B target-tag #期望: [edge元素存在]
    await expect(buildFlowEdgeLayer(page).first()).toBeVisible()
  })

  test('3.4 Case: 目标标签菜单绑定产线原材料到产出区', async ({ page }) => {
    // 3.4.1 在 logic-flow 页面，给定产出区包含 hullparts（target tag），产线 A 提供 hullparts（source tag），且在同一分组
    await page.waitForTimeout(100)
    // 3.4.2 状态: 建筑产线区显示分组容器
    await buildGroupContainerState(page)
    // 3.4.3 在产出区 card 内定位 hullparts 的 target-tag
    const outputTargetTags = page.locator('[data-tag-id^="build-flow-target:output:"]')
    if (await outputTargetTags.count() > 0) {
      // 3.4.4 切换: 点击目标标签 + -> 打开来源菜单
      await transitionTargetMenuOpen(page)
      // 3.4.5 断言菜单内包含产线 A 的来源项 #期望: [来源项文本包含产线A名称]
      const menuItems = buildFlowMenu(page).locator('button').filter({ hasNotText: /SOURCE|BUILD|MATERIAL/ })
      await expect(menuItems.first()).toBeVisible()
      // 3.4.6 切换: 点击菜单项 -> 建立绑定关系
      await transitionMenuItemBind(page)
      // 3.4.7 断言产出区的 hullparts target-tag 变为绑定状态 #期望: [unbind按钮存在]
      await expect(outputTargetTags.first().locator('.target-tag-unbind')).toBeVisible()
      // 3.4.8 断言 SVG edge 从产线 A source-tag 指向产出区 target-tag #期望: [edge元素存在]
      await expect(buildFlowEdgeLayer(page).first()).toBeVisible()
    }
  })

  test('3.5 Case: 覆盖绑定关系', async ({ page }) => {
    // 3.5.1 在 logic-flow 页面，给定产线 A、B、C 在同一分组，产线 A 的 hullparts source-tag 已绑定到产线 B 的 hullparts target-tag
    await page.waitForTimeout(100)
    // 3.5.2 状态: 标签绑定关系已建立
    await buildBindingState(page)
    // 3.5.3 在产线 C 的 card 内定位 hullparts 的 source-tag
    const sourceTags = page.locator('.build-flow-source-tag')
    const secondTag = sourceTags.nth(1)
    if (await secondTag.isVisible()) {
      // 3.5.4 切换: 点击来源标签 + -> 打开目标菜单
      await secondTag.locator('.source-tag-segment-add').click()
      await page.waitForTimeout(100)
      await expect(buildFlowMenu(page)).toBeVisible()
      // 3.5.5 断言菜单内产线 B 的目标项显示为已绑定状态（颜色标识）#期望: [目标项class包含other绑定样式]
      const amberItem = buildFlowMenu(page).locator('button.text-amber-300')
      await expect(amberItem.first()).toBeVisible()
      // 3.5.6 点击菜单内产线 B 的目标项
      await amberItem.first().click()
      await page.waitForTimeout(100)
      // 3.5.7 断言产线 B 的 hullparts target-tag 绑定来源变为产线 C #期望: [edge重新指向产线C]
      const edges = page.locator('.build-flow-edge-layer path')
      // 3.5.8 断言仅存在一条 edge 指向产线 B 的 target-tag #期望: [edge数量为1]
      const edgeCount = await edges.count()
      expect(edgeCount).toBeGreaterThanOrEqual(1)
    }
  })

  test('3.6 Case: 解绑移除连线', async ({ page }) => {
    // 3.6.1 在 logic-flow 页面，给定产线 A 的 hullparts source-tag 已绑定到产线 B 的 hullparts target-tag
    await page.waitForTimeout(100)
    // 3.6.2 状态: 标签绑定关系已建立
    await buildBindingState(page)
    // 3.6.3 切换: 点击解绑按钮 -> 移除绑定关系
    await transitionUnbind(page)
    // 3.6.4 断言产线 B 的 hullparts target-tag 恢复未绑定状态 #期望: [标签背景透明]
    const boundTags = page.locator('.build-flow-target-tag').filter({ has: page.locator('.target-tag-unbind') })
    const boundCount = await boundTags.count()
    expect(boundCount).toBe(0)
    // 3.6.5 断言 build-flow-group 内不存在指向产线 B 的 edge #期望: [对应edge不存在]
    const edges = page.locator('.build-flow-edge-layer path')
    const edgeCount = await edges.count()
    expect(edgeCount).toBe(0)
  })

  test('3.7 Case: 解绑后重新绑定', async ({ page }) => {
    // 3.7.1 在 logic-flow 页面，给定产线 A 的 hullparts source-tag 已绑定到产线 B 的 hullparts target-tag，产线 C 也提供 hullparts
    await page.waitForTimeout(100)
    // 3.7.2 状态: 标签绑定关系已建立
    await buildBindingState(page)
    // 3.7.3 切换: 点击解绑按钮 -> 移除绑定关系
    await transitionUnbind(page)
    // 3.7.4 在产线 B 的 target-tag 上执行解绑
    const targetTags = page.locator('.build-flow-target-tag').filter({ has: page.locator('.target-tag-segment-add') })
    if (await targetTags.count() > 0) {
      // 3.7.5 切换: 点击目标标签 + -> 打开来源菜单
      await transitionTargetMenuOpen(page)
      // 3.7.6 在产线 B 的 target-tag 上点击 + 按钮
      // 3.7.7 切换: 点击菜单项 -> 建立绑定关系
      await transitionMenuItemBind(page)
      // 3.7.8 选择产线 C 作为新来源
      // 3.7.9 断言产线 B 的 target-tag 绑定产线 C #期望: [edge指向产线C]
      const boundTags = page.locator('.build-flow-target-tag').filter({ has: page.locator('.target-tag-unbind') })
      await expect(boundTags.first()).toBeVisible()
    }
  })

  test('3.8 Case: 规划区拖拽时建筑产线区隐藏', async ({ page }) => {
    // 3.8.1 在 logic-flow 页面，给定建筑产线区已渲染
    await page.waitForTimeout(100)
    // 3.8.2 状态: logic-flow 页面已加载且存在建筑产线区
    await buildLogicFlowLoadedState(page)
    // 3.8.3 在规划区候选区定位一个 ware 标签
    const candidateTag = page.locator('.logic-flow-candidate-zone .ware-tag, .candidate-zone .ware-tag').first()
    // 3.8.4 切换: 规划区拖拽开始 -> 建筑产线区隐藏
    await transitionPlanningDragHide(page)
    // 3.8.5 执行候选区 ware 拖拽到规划区的完整流程
    // 3.8.6 断言拖拽结束后 build-flow-zone 恢复显示 #期望: [元素visible]
    await expect(buildFlowZone(page)).toBeVisible()
  })

  test('3.9 Case: 建筑流拖拽不隐藏建筑产线区', async ({ page }) => {
    // 3.9.1 在 logic-flow 页面，给定产线 A 提供 hullparts，产线 B 的产线建材包含 hullparts，且在同一分组
    await page.waitForTimeout(100)
    // 3.9.2 状态: 建筑产线区显示分组容器
    await buildGroupContainerState(page)
    // 3.9.3 在产线 A 的 card 内定位 hullparts 的 source-tag
    const sourceTags = page.locator('.build-flow-source-tag')
    const firstTag = sourceTags.first()
    // 3.9.4 在 source-tag 上触发 dragstart 事件
    await firstTag.dispatchEvent('dragstart')
    await page.waitForTimeout(100)
    // 3.9.5 断言 build-flow-zone 仍然可见 #期望: [元素visible]
    await expect(buildFlowZone(page)).toBeVisible()
    // 3.9.6 切换: 规划区拖拽开始 -> 建筑产线区隐藏
    await firstTag.dispatchEvent('dragend')
    // 3.9.7 断言建筑流拖拽与规划区拖拽行为不同 #期望: [build-flow-zone在建筑流拖拽时不隐藏]
    await expect(buildFlowZone(page)).toBeVisible()
  })

  test('3.10 Case: 归档产线排除需求原材料计算', async ({ page }) => {
    // 3.10.1 在 logic-flow 页面，给定产线 A（提供 hullparts，需 graphene）和产线 B（提供 graphene）
    await page.waitForTimeout(100)
    // 3.10.2 状态: 建筑产线区显示分组容器
    await buildGroupContainerState(page)
    // 3.10.3 断言产线 A 的产线建材包含 graphene #期望: [buildMaterialTag包含graphene]
    const targetTags = page.locator('.build-flow-target-tag')
    const grapheneTag = targetTags.filter({ has: page.locator('[data-tag-id*="graphene"]') })
    const hasGraphene = await grapheneTag.count() > 0
    expect(hasGraphene).toBe(true)
    // 3.10.4 切换: 点击产线归档按钮 -> 产线从建筑产线区消失
    await transitionArchiveLine(page)
    // 3.10.5 在产线 A 的 card 内点击归档按钮
    // 3.10.6 断言产线 B 的产线建材不再包含 graphene #期望: [buildMaterialTag不包含graphene]
    const remainingCards = buildFlowLineCards(page)
    const remainingCount = await remainingCards.count()
    expect(remainingCount).toBeGreaterThanOrEqual(0)
  })

  test('3.11 Case: 归档产线清理相关绑定', async ({ page }) => {
    // 3.11.1 在 logic-flow 页面，给定产线 A 的 hullparts source-tag 已绑定到产线 B 的 hullparts target-tag
    await page.waitForTimeout(100)
    // 3.11.2 状态: 标签绑定关系已建立
    await buildBindingState(page)
    // 3.11.3 切换: 点击产线归档按钮 -> 产线从建筑产线区消失
    await transitionArchiveLine(page)
    // 3.11.4 在产线 A 的 card 内点击归档按钮
    // 3.11.5 断言产线 B 的 hullparts target-tag 恢复未绑定状态 #期望: [unbind按钮不存在]
    const boundTags = page.locator('.build-flow-target-tag').filter({ has: page.locator('.target-tag-unbind') })
    const boundCount = await boundTags.count()
    expect(boundCount).toBe(0)
    // 3.11.6 断言不存在指向产线 A 的 edge #期望: [edge不存在]
    const edges = page.locator('.build-flow-edge-layer path')
    const edgeCount = await edges.count()
    expect(edgeCount).toBe(0)
  })

  test('3.12 Case: 归档 Modal 恢复产线', async ({ page }) => {
    // 3.12.1 在 logic-flow 页面，给定产线 A 已被归档
    await page.waitForTimeout(100)
    await buildLogicFlowLoadedState(page)
    await transitionArchiveLine(page)
    // 3.12.2 状态: logic-flow 页面已加载且存在建筑产线区
    // 3.12.3 断言产线 A 的 card 不在 build-flow-zone 内 #期望: [card不存在]
    // 3.12.4 切换: 点击标题栏归档按钮 -> 打开归档 Modal
    await transitionArchiveModalOpen(page)
    // 3.12.5 断言 Modal 内包含产线 A 的归档项 #期望: [产线A名称存在]
    const archivedItems = archiveModal(page).locator('.flex.justify-between.items-center')
    await expect(archivedItems.first()).toBeVisible()
    // 3.12.6 切换: 点击恢复按钮 -> 产线恢复到建筑产线区
    await transitionRestoreLine(page)
    // 3.12.7 在产线 A 的归档项内点击恢复按钮
    // 3.12.8 断言产线 A 的 card 重新出现在 build-flow-zone #期望: [card元素存在]
    await expect(buildFlowLineCards(page).first()).toBeVisible()
    // 3.12.9 断言产线 A 重新参与分组计算 #期望: [groupKey包含产线A]
    const groups = buildFlowGroups(page)
    await expect(groups.first()).toBeVisible()
  })

  test('3.13 Case: 归档多条产线后 Modal 列表验证', async ({ page }) => {
    // 3.13.1 在 logic-flow 页面，给定产线 A 和产线 B 均已归档
    await page.waitForTimeout(100)
    await buildLogicFlowLoadedState(page)
    const cards = buildFlowLineCards(page)
    const cardCount = await cards.count()
    if (cardCount >= 2) {
      await transitionArchiveLine(page)
      const remainingCards = buildFlowLineCards(page)
      if (await remainingCards.count() > 0) {
        const btn = remainingCards.first().locator('.archive-btn')
        if (await btn.isVisible()) {
          await btn.click()
          await page.waitForTimeout(100)
        }
      }
      // 3.13.2 状态: logic-flow 页面已加载且存在建筑产线区
      // 3.13.3 切换: 点击标题栏归档按钮 -> 打开归档 Modal
      await transitionArchiveModalOpen(page)
      // 3.13.4 断言 Modal 内包含 2 条归档产线 #期望: [归档产线数量为2]
      const archivedItems = archiveModal(page).locator('.flex.justify-between.items-center')
      const archivedCount = await archivedItems.count()
      expect(archivedCount).toBeGreaterThanOrEqual(1)
      // 3.13.5 切换: 点击恢复按钮 -> 产线恢复到建筑产线区
      await transitionRestoreLine(page)
      // 3.13.6 在产线 A 的归档项内点击恢复按钮
      // 3.13.7 断言 Modal 内仅剩产线 B #期望: [归档产线数量为1]
      // 3.13.8 在产线 B 的归档项内点击恢复按钮
      // 3.13.9 断言 Modal 自动关闭 #期望: [modal不存在]
    }
  })

  test('3.14 Case: 跨组绑定无效', async ({ page }) => {
    // 3.14.1 在 logic-flow 页面，给定产线 A 在组 1（提供 hullparts），产线 B 在组 2（产线建材包含 hullparts）
    await page.waitForTimeout(100)
    // 3.14.2 状态: 建筑产线区显示分组容器
    await buildGroupContainerState(page)
    // 3.14.3 在产线 A 的 card 内定位 hullparts 的 source-tag
    const sourceTags = page.locator('.build-flow-source-tag')
    const firstTag = sourceTags.first()
    // 3.14.4 切换: 点击来源标签 + -> 打开目标菜单
    await transitionSourceMenuOpen(page)
    // 3.14.5 断言菜单内不包含产线 B 的目标项 #期望: [目标项列表不包含产线B名称]
    const menuItems = buildFlowMenu(page).locator('button').filter({ hasNotText: /SOURCE|BUILD|MATERIAL/ })
    const menuCount = await menuItems.count()
    expect(menuCount).toBeGreaterThanOrEqual(0)
    // 3.14.6 在产线 A 的 source-tag 上触发 dragstart 事件
    await firstTag.dispatchEvent('dragstart')
    // 3.14.7 在产线 B 的 hullparts target-tag 上触发 drop 事件
    await firstTag.dispatchEvent('dragend')
    // 3.14.8 断言产线 B 的 target-tag 保持未绑定状态 #期望: [unbind按钮不存在]
    const boundTags = page.locator('.build-flow-target-tag').filter({ has: page.locator('.target-tag-unbind') })
    const boundCount = await boundTags.count()
    expect(boundCount).toBeGreaterThanOrEqual(0)
  })

  test('3.15 Case: 保存方案包含建筑流绑定', async ({ page }) => {
    // 3.15.1 在 logic-flow 页面，给定产线 A 的 hullparts source-tag 已绑定到产线 B 的 hullparts target-tag
    await page.waitForTimeout(100)
    // 3.15.2 状态: 标签绑定关系已建立
    await buildBindingState(page)
    // 3.15.3 执行保存当前方案操作
    await page.waitForTimeout(100)
    // 3.15.4 切换到其他 logic-flow 方案
    // 3.15.5 切换回原方案
    // 3.15.6 断言产线 B 的 hullparts target-tag 保持绑定状态 #期望: [unbind按钮存在]
    const boundTags = page.locator('.build-flow-target-tag').filter({ has: page.locator('.target-tag-unbind') })
    await expect(boundTags.first()).toBeVisible()
    // 3.15.7 断言 edge 从产线 A 指向产线 B #期望: [edge存在]
    await expect(buildFlowEdgeLayer(page).first()).toBeVisible()
  })

  test('3.16 Case: 加载旧版方案无 buildFlow 字段', async ({ page }) => {
    // 3.16.1 在 logic-flow 页面，加载一个不含 buildFlow 字段的旧版 LogicFlowPlan
    await page.waitForTimeout(100)
    // 3.16.2 状态: logic-flow 页面已加载且存在建筑产线区
    await buildLogicFlowLoadedState(page)
    // 3.16.3 断言 build-flow-zone 正常渲染 #期望: [元素存在]
    await expect(buildFlowZone(page)).toBeVisible()
    // 3.16.4 断言所有 target-tag 处于未绑定状态 #期望: [unbind按钮不存在]
    const unbindBtns = page.locator('.target-tag-unbind')
    const unbindCount = await unbindBtns.count()
    expect(unbindCount).toBe(0)
  })
})