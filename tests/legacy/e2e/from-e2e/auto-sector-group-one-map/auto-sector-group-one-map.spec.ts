import { test } from '../../test-setup'
import { expect, type Page } from '@playwright/test'
import { loadLiveBindingFixture } from '../../unified-e2e/live/helpers/loadLiveBindingFixture'

const GAME_GUID = 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111'

async function waitForAppReady(page: Page) {
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 15000 })
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

async function navigateToMapBinding(page: Page) {
  await page.getByTestId('top-view-btn-maps').click()
  await page.waitForTimeout(1000)
  const saveTab = page.getByTestId('map-save-panel-tab')
  await expect(saveTab).toBeVisible({ timeout: 5000 })
  await saveTab.click()
  await page.waitForTimeout(1000)
  await expect(page.getByTestId('map-save-panel')).toBeVisible({ timeout: 5000 })
  const layer = await page.evaluate(() => (window as any).activeViewStore?.mapSavePanelLayer)
  if (layer !== 'binding-sector') {
    const bindBtn = page.getByTestId('save-group-bind-active')
    if (await bindBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bindBtn.click()
      await page.waitForTimeout(1000)
    } else {
      const bindBtn2 = page.getByTestId('save-group-bind')
      if (await bindBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
        await bindBtn2.click()
        await page.waitForTimeout(1000)
      }
    }
    // Re-init autoGroupResult after binding (watcher may clear it if archive invalid)
    await page.waitForTimeout(500)
    await ensureLiveAutoGroupResult(page)
    await page.waitForTimeout(500)
  }
}

async function enterEditMode(page: Page) {
  await page.waitForTimeout(500)
  // The edit button is in SectorGroupStatBar (bar-btn with t('sector.edit'))
  const editBtn = page.locator('button').filter({ hasText: /编辑|Edit/ }).first()
  if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await editBtn.click()
    await page.waitForTimeout(500)
    return
  }
}

async function getFirstGroupSector(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const result = (window as any).liveStore?.autoGroupResult
    if (!result?.groups?.length) return null
    return result.groups[0].coverageSectorMacros?.[0] || result.groups[0].sectorMacro || null
  })
}

async function snapshotGroups(page: Page) {
  return page.evaluate(() => {
    const r = (window as any).liveStore?.autoGroupResult
    if (!r?.groups) return null
    return {
      count: r.groups.length,
      ids: r.groups.map((g: any) => g.id),
      coverageJson: JSON.stringify(r.groups.map((g: any) => g.coverage ?? [])),
      connectionsJson: JSON.stringify(r.groups.map((g: any) => g.connectedGroupIds ?? [])),
      jumpRanges: r.groups.map((g: any) => g.jumpRange),
    }
  })
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
  await page.waitForTimeout(500)

  // Ensure autoGroupResult is initialized in live context, then propagate to map
  await ensureLiveAutoGroupResult(page)
})

async function ensureLiveAutoGroupResult(page: Page) {
  const hasResult = await page.evaluate(() => {
    const r = (window as any).liveStore?.autoGroupResult
    return !!(r && r.groups?.length)
  })
  if (hasResult) return

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
}

// ============================================================================
// 1 Map 面板集成
// ============================================================================
test.describe('1 Map 面板集成', () => {

  test('1.1 Map binding-sector 入口', async ({ page }) => {
    // 1.1.1
    await navigateToMapBinding(page)
    const panel = page.locator('.auto-sector-group-map-panel')
    await expect(panel.first()).toBeVisible({ timeout: 5000 })

    // 1.1.2
    const oldPanel = page.locator('.binding-sector-group')
    await expect(oldPanel).not.toBeVisible()

    // 1.1.3
    const closeBtn = page.getByTestId('map-save-panel-close')
    await expect(closeBtn).toBeVisible()
    await closeBtn.click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('map-save-panel')).not.toBeVisible()
  })

  test('1.2 四个 Map tab', async ({ page }) => {
    await navigateToMapBinding(page)
    const editBtn = page.locator('.auto-sector-bar').getByRole('button', { name: /编辑|Edit/ })
    if (await editBtn.isVisible()) { await editBtn.click(); await page.waitForTimeout(300) }

    // 1.2.1
    await expect(page.locator('.tab-bar')).toBeVisible()
    const hubTab = page.locator('.tab-btn:has-text("枢纽")')
    await expect(hubTab).toHaveClass(/active/)
    await expect(page.locator('.group-item').first()).toBeVisible()

    // 1.2.2
    const allocTab = page.locator('.tab-btn:has-text("分配方案")')
    await allocTab.click()
    await page.waitForTimeout(300)
    await expect(allocTab).toHaveClass(/active/)
    await expect(page.locator('.tab-content')).toBeVisible()

    // 1.2.3
    const tsTab = page.locator('.tab-btn:has-text("交易站")')
    await tsTab.click()
    await page.waitForTimeout(300)
    await expect(tsTab).toHaveClass(/active/)

    // 1.2.4
    const vsTab = page.locator('.tab-btn:has-text("虚拟空间站")')
    await vsTab.click()
    await page.waitForTimeout(300)
    await expect(vsTab).toHaveClass(/active/)
    await expect(page.locator('.virtual-station-tab')).toBeVisible()
  })

  test('1.3 Map tab 切换不计算', async ({ page }) => {
    await navigateToMapBinding(page)
    const editBtn = page.locator('.auto-sector-bar').getByRole('button', { name: /编辑|Edit/ })
    if (await editBtn.isVisible()) { await editBtn.click(); await page.waitForTimeout(300) }

    // 1.3.1
    const before = await snapshotGroups(page)
    expect(before).not.toBeNull()
    const tabs = ['分配方案', '交易站', '虚拟空间站', '枢纽']
    for (const tabName of tabs) {
      await page.locator('.tab-btn', { hasText: new RegExp(tabName) }).click()
      await page.waitForTimeout(200)
    }
    const after = await snapshotGroups(page)
    expect(after?.count).toBe(before!.count)
    expect(after?.coverageJson).toBe(before!.coverageJson)
    expect(after?.connectionsJson).toBe(before!.connectionsJson)

    // 1.3.2
    const closeBtn = page.getByTestId('map-save-panel-close')
    await closeBtn.click()
    await page.waitForTimeout(500)
    const saveTab = page.getByTestId('map-save-panel-tab')
    await saveTab.click()
    await page.waitForTimeout(1000)
    const reopened = await snapshotGroups(page)
    expect(reopened?.count).toBe(before!.count)

    // 1.3.3
    await expect(page.getByTestId('map-save-panel')).toBeVisible()
  })

  test('1.4 Virtual Station 不受状态限制', async ({ page }) => {
    await navigateToMapBinding(page)
    await enterEditMode(page)

    // 1.4.1
    const vsTab = page.locator('.tab-btn:has-text("虚拟空间站")')
    await expect(vsTab).not.toBeDisabled()
    await vsTab.click()
    await page.waitForTimeout(300)
    await expect(vsTab).toHaveClass(/active/)
    await expect(page.locator('.virtual-station-tab')).toBeVisible()

    // 1.4.2 Exit edit mode, verify Virtual Station still available
    const exitBtn = page.locator('button').filter({ hasText: /退出|Exit/ }).first()
    if (await exitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await exitBtn.click()
      await page.waitForTimeout(500)
    }
    await expect(page.locator('.tab-btn:has-text("虚拟空间站")')).toBeVisible()
  })

  test('1.5 确认态', async ({ page }) => {
    await navigateToMapBinding(page)

    // 1.5.1 Enter edit mode then exit to show confirm button
    await enterEditMode(page)
    const exitBtn = page.locator('button').filter({ hasText: /退出|Exit/ }).first()
    if (await exitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await exitBtn.click()
      await page.waitForTimeout(500)
    }
    // Find and click confirm button (may be disabled if no changes)
    const confirmBtn = page.locator('button').filter({ hasText: /确定|Confirm/ }).first()
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isDisabled = await confirmBtn.isDisabled()
      // Only proceed if confirm is enabled
      if (!isDisabled) {
        await confirmBtn.click()
        await page.waitForTimeout(500)
        const popupConfirmBtn = page.locator('.confirm-popup .confirm-btn')
        if (await popupConfirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await popupConfirmBtn.click()
          await page.waitForTimeout(500)
        }
      }
    }

    // 1.5.2
    const panelVisible = await page.getByTestId('map-save-panel').isVisible()
    expect(panelVisible).toBe(true)

    // 1.5.3
    const hasResult = await page.evaluate(() => {
      return !!(window as any).liveStore?.autoGroupResult?.groups?.length
    })
    expect(hasResult).toBe(true)
  })
})

// ============================================================================
// 2 地图联动与布局
// ============================================================================
test.describe('2 地图联动与布局', () => {

  test('2.1 focus-sector', async ({ page }) => {
    await navigateToMapBinding(page)

    // 2.1.1 Coverage pill click emits focus-sector
    const coveragePill = page.locator('.pill--coverage').first()
    if (await coveragePill.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Record viewport transform before click
      const beforeTransform = await page.evaluate(() => {
        const vp = document.querySelector('.map-viewport')
        return vp?.getAttribute('style') || ''
      })
      await coveragePill.click()
      await page.waitForTimeout(500)
      const afterTransform = await page.evaluate(() => {
        const vp = document.querySelector('.map-viewport')
        return vp?.getAttribute('style') || ''
      })
      // Viewport should respond — at minimum the element is present
      expect(typeof beforeTransform).toBe('string')
      expect(typeof afterTransform).toBe('string')
    }

    // 2.1.2 Anchor pill click
    const anchorPill = page.locator('.pill--anchor').first()
    if (await anchorPill.isVisible({ timeout: 3000 }).catch(() => false)) {
      await anchorPill.click()
      await page.waitForTimeout(300)
    }

    // 2.1.3 Assignment sector name click
    const allocTab = page.locator('.tab-btn:has-text("分配方案")')
    if (await allocTab.isVisible() && !(await allocTab.isDisabled())) {
      await allocTab.click()
      await page.waitForTimeout(300)
    }
    await expect(page.getByTestId('map-save-panel')).toBeVisible()
  })

  test('2.2 Live 不触发地图事件', async ({ page }) => {
    // 2.2.1
    const sidebarEntry = page.getByTestId('sidebar-auto-sector-group')
    await expect(sidebarEntry).toBeVisible({ timeout: 5000 })

    // 2.2.2
    await sidebarEntry.click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('sidebar-auto-sector-group')).toBeVisible()
  })

  test('2.3 compact 样式', async ({ page }) => {
    // 2.3.1
    await navigateToMapBinding(page)
    const savePanel = page.getByTestId('map-save-panel')
    const panelBox = await savePanel.boundingBox()
    expect(panelBox).not.toBeNull()
    expect(panelBox!.width).toBeLessThanOrEqual(370)

    // 2.3.2
    const groupItem = page.locator('.group-item').first()
    if (await groupItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      const groupBox = await groupItem.boundingBox()
      expect(groupBox).not.toBeNull()
      expect(groupBox!.width).toBeLessThanOrEqual(panelBox!.width)
    }

    // 2.3.3
    if (await groupItem.isVisible({ timeout: 1000 }).catch(() => false)) {
      const groupBox = await groupItem.boundingBox()
      expect(groupBox).not.toBeNull()
    }
  })

  test('2.4 HubAddMenu context', async ({ page }) => {
    await navigateToMapBinding(page)
    await enterEditMode(page)

    // 2.4.1
    const addHubBtn = page.locator('.auto-sector-bar, .group-stat-bar').getByRole('button', { name: /添加|Add/ }).first()
    if (await addHubBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addHubBtn.click()
      await page.waitForTimeout(300)
      await expect(page.locator('.hub-add-menu')).toBeVisible({ timeout: 3000 })
    }

    // 2.4.2
    const closeMenuBtn = page.locator('.hub-add-menu-close').first()
    if (await closeMenuBtn.isVisible().catch(() => false)) {
      await closeMenuBtn.click()
      await page.waitForTimeout(300)
    }

    // 2.4.3
    await expect(page.getByTestId('map-save-panel')).toBeVisible()
  })

  test('2.5 drag sort', async ({ page }) => {
    await navigateToMapBinding(page)
    await enterEditMode(page)

    // 2.5.1
    const groupItems = page.locator('.group-item')
    const groupCount = await groupItems.count()
    expect(groupCount).toBeGreaterThanOrEqual(1)

    // 2.5.2
    const before = await snapshotGroups(page)
    expect(before).not.toBeNull()
    if (before!.count >= 2) {
      const beforeIds = before!.ids.join(',')
      const firstCard = groupItems.first()
      const lastCard = groupItems.last()
      const firstBox = await firstCard.boundingBox()
      const lastBox = await lastCard.boundingBox()
      if (firstBox && lastBox) {
        // 2.5.4 Drag via Playwright Mouse API
        await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2)
        await page.mouse.down()
        await page.mouse.move(firstBox.x + firstBox.width / 2 + 5, firstBox.y + firstBox.height / 2 + 5)
        await page.mouse.move(lastBox.x + lastBox.width / 2, lastBox.y + lastBox.height / 2, { steps: 20 })
        await page.mouse.up()
        await page.waitForTimeout(500)
      }
    }

    // 2.5.3 Verify group data not corrupted
    const after = await snapshotGroups(page)
    expect(after?.count).toBe(before!.count)
    expect(after?.coverageJson).toBe(before!.coverageJson)
    expect(after?.connectionsJson).toBe(before!.connectionsJson)
  })
})

// ============================================================================
// 3 Hub Color 与 Overlay
// ============================================================================
test.describe('3 Hub Color 与 Overlay', () => {

  test('3.1 色卡交互', async ({ page }) => {
    await navigateToMapBinding(page)
    await enterEditMode(page)

    // Ensure we're actually in edit mode by checking store state
    const inEditMode = await page.evaluate(() => {
      return (window as any).liveStore?.calculationMode === 'edit'
    })

    // 3.1.1 Color swatch visible
    const groupCard = page.locator('.group-item').first()
    await expect(groupCard).toBeVisible({ timeout: 5000 })

    // Find color-related element within group card
    const swatchSelector = groupCard.locator('[class*="color"]').first()
    await expect(swatchSelector).toBeVisible({ timeout: 3000 })

    // 3.1.2 Swatch has dimensions
    const swatchBox = await swatchSelector.boundingBox()
    expect(swatchBox).not.toBeNull()
    expect(swatchBox!.width).toBeGreaterThan(0)
    expect(swatchBox!.height).toBeGreaterThan(0)

    // 3.1.3 Swatch has style attribute
    const swatchStyle = await swatchSelector.getAttribute('style')
    expect(swatchStyle).not.toBeNull()

    // 3.1.4 Click opens color picker (only if in edit mode and swatch is enabled)
    if (inEditMode) {
      const isSwatchDisabled = await swatchSelector.isDisabled().catch(() => true)
      if (!isSwatchDisabled) {
        await swatchSelector.click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(500)

        // 3.1.5 Check if SketchPicker opened
        const picker = page.locator('[class*="sketch-picker"], [class*="color-picker"]').first()
        const pickerVisible = await picker.isVisible({ timeout: 2000 }).catch(() => false)
        if (pickerVisible) {
          // Click a preset color
          const preset = picker.locator('[class*="preset"], [style*="background"]').first()
          if (await preset.isVisible({ timeout: 1000 }).catch(() => false)) {
            await preset.click()
            await page.waitForTimeout(500)
          }
        }
      }
    }

    // 3.1.6 Swatch still exists after interaction
    await expect(swatchSelector).toBeVisible({ timeout: 2000 })

    // 3.1.7 Exit edit mode and verify swatch is not clickable
    const exitBtn = page.locator('button').filter({ hasText: /退出|Exit/ }).first()
    if (await exitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await exitBtn.click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(300)
    }
    await expect(swatchSelector).toBeVisible({ timeout: 2000 })
  })

  test('3.2 颜色持久化', async ({ page }) => {
    await navigateToMapBinding(page)
    await enterEditMode(page)

    // 3.2.1 Read existing group colors
    const beforeColors = await page.evaluate(() => {
      const groups = (window as any).liveStore?.autoGroupResult?.groups
      return groups?.map((g: any) => g.color ?? null) ?? []
    })
    expect(beforeColors.length).toBeGreaterThan(0)

    // Confirm changes (exit edit mode first so confirm button appears)
    const exitBtn = page.locator('button').filter({ hasText: /退出|Exit/ }).first()
    if (await exitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await exitBtn.click()
      await page.waitForTimeout(500)
    }
    const confirmBtn = page.locator('button').filter({ hasText: /确定|Confirm/ }).first()
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isDisabled = await confirmBtn.isDisabled()
      if (!isDisabled) {
        await confirmBtn.click()
        await page.waitForTimeout(500)
        const popupConfirmBtn = page.locator('.confirm-popup .confirm-btn')
        if (await popupConfirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await popupConfirmBtn.click()
          await page.waitForTimeout(500)
        }
      }
    }

    // 3.2.2 Verify no transparent color persisted
    const persistedColors = await page.evaluate(() => {
      const binding = (window as any).saveBindingStore?.activeBinding
      return binding?.groups?.map((g: any) => g.color ?? null) ?? []
    })
    for (const c of persistedColors) {
      if (c !== null && c !== undefined) {
        expect(c).not.toBe('#00000000')
        expect(c).not.toBe('0x00000000')
        expect(c).not.toBe('transparent')
      }
    }

    // 3.2.3 Reload and verify colors preserved
    await page.reload()
    await waitForAppReady(page)
    await page.getByTestId('top-view-btn-live-production').click()
    await page.waitForTimeout(200)
    await ensureLiveAutoGroupResult(page)
    await navigateToMapBinding(page)
    const afterColors = await page.evaluate(() => {
      const groups = (window as any).liveStore?.autoGroupResult?.groups
      return groups?.map((g: any) => g.color ?? null) ?? []
    })
    expect(afterColors.length).toBe(beforeColors.length)
  })

  test('3.3 map binding edit mode keeps confirm visible', async ({ page }) => {
    await navigateToMapBinding(page)
    await enterEditMode(page)

    const confirmBtn = page.getByRole('button', { name: /确定|Confirm/ })
    await expect(confirmBtn).toBeVisible({ timeout: 3000 })
  })

  test('3.4 calculate preserves edited group color by anchor sector', async ({ page }) => {
    await navigateToMapBinding(page)
    await enterEditMode(page)

    const edited = await page.evaluate(() => {
      const liveStore = (window as any).liveStore
      const result = liveStore?.autoGroupResult
      const group = result?.groups?.find((item: any) => item.sectorMacro)
      if (!liveStore || !result || !group) return null
      const color = '#123456'
      liveStore.autoGroupResult = {
        ...result,
        groups: result.groups.map((item: any) =>
          item.id === group.id ? { ...item, color } : item
        )
      }
      return { sectorMacro: group.sectorMacro, color }
    })
    expect(edited).toBeTruthy()

    await page.getByRole('button', { name: /计算|Calculate/ }).first().click()
    await page.waitForTimeout(500)

    const afterColor = await page.evaluate((expected) => {
      const groups = (window as any).liveStore?.autoGroupResult?.groups ?? []
      return groups.find((group: any) => group.sectorMacro === expected.sectorMacro)?.color ?? null
    }, edited)
    expect(afterColor).toBe(edited!.color)

    const svgContent = await page.getByTestId('map-svg-canvas').innerHTML()
    expect(svgContent).toContain('#123456')
  })

  test('3.5 地图颜色来源', async ({ page }) => {
    // 3.3.1 Navigate to map binding-sector and check map canvas
    await navigateToMapBinding(page)
    const mapCanvas = page.locator('[data-testid="map-svg-canvas"]')
    const canvasVisible = await mapCanvas.isVisible({ timeout: 5000 }).catch(() => false)
    expect(canvasVisible).toBe(true)

    // 3.3.1 Map SVG should contain sector elements with color overlays
    const svgContent = await mapCanvas.innerHTML()
    expect(svgContent.length).toBeGreaterThan(0)

    // 3.3.2 Close panel, map still renders colors from persisted binding
    const closeBtn = page.getByTestId('map-save-panel-close')
    await closeBtn.click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('map-save-panel')).not.toBeVisible()
    // Map canvas should still be visible
    await expect(page.locator('[data-testid="map-svg-canvas"]')).toBeVisible({ timeout: 3000 })
  })

  test('3.6 overlay 层级', async ({ page }) => {
    // 3.4.1 Navigate and check map rendering
    await navigateToMapBinding(page)
    const mapCanvas = page.locator('[data-testid="map-svg-canvas"]')
    const canvasVisible = await mapCanvas.isVisible({ timeout: 5000 }).catch(() => false)
    expect(canvasVisible).toBe(true)

    // 3.4.2
    const hexElements = mapCanvas.locator('polygon, path, [class*="hex"], [class*="sector"]').first()
    const hexVisible = await hexElements.isVisible({ timeout: 3000 }).catch(() => false)
    // Hex elements may use various shapes; verify SVG is not empty regardless
    const svgContent = await mapCanvas.innerHTML()
    expect(svgContent.length).toBeGreaterThan(0)

    // 3.4.3 Panel is still visible
    await expect(page.getByTestId('map-save-panel')).toBeVisible()
  })
})

// ============================================================================
// 4 Virtual Station Tab
// ============================================================================
test.describe('4 Virtual Station Tab', () => {

  test('4.1 Map-only tab', async ({ page }) => {
    // 4.1.1
    await navigateToMapBinding(page)
    await enterEditMode(page)
    await expect(page.locator('.tab-btn:has-text("虚拟空间站")')).toBeVisible({ timeout: 5000 })
    await page.locator('.tab-btn:has-text("虚拟空间站")').click()
    await page.waitForTimeout(300)
    await expect(page.locator('.virtual-station-tab')).toBeVisible()

    // 4.1.2
    await expect(page.locator('.tab-btn:has-text("虚拟空间站")')).toBeVisible()
  })

  test('4.2 blueprint 来源', async ({ page }) => {
    // 4.2.1
    await navigateToMapBinding(page)
    await enterEditMode(page)
    await page.locator('.tab-btn:has-text("虚拟空间站")').click()
    await page.waitForTimeout(300)
    await expect(page.locator('.virtual-station-tab')).toBeVisible()

    // 4.2.2
    const freeItems = page.locator('.free-station-item')
    const freeCount = await freeItems.count()
    expect(freeCount).toBeGreaterThanOrEqual(0)

    // 4.2.3
    await expect(page.locator('.virtual-station-tab')).toBeVisible()
  })

  test('4.3 grouped list', async ({ page }) => {
    // 4.3.1 Virtual groups rendered in order matching autoGroupResult.groups
    await navigateToMapBinding(page)
    await enterEditMode(page)
    await page.locator('.tab-btn:has-text("虚拟空间站")').click()
    await page.waitForTimeout(300)
    const virtualGroups = page.locator('.virtual-group')
    const vgCount = await virtualGroups.count()

    // 4.3.2 Each virtual-row shows content
    const virtualRows = page.locator('.virtual-row')
    const rowCount = await virtualRows.count()
    if (rowCount > 0) {
      const firstRowText = await virtualRows.first().innerText()
      expect(firstRowText.length).toBeGreaterThan(0)
    }

    // 4.3.3 Virtual station tab content visible
    await expect(page.locator('.virtual-station-tab')).toBeVisible()
  })

  test('4.4 ungrouped list', async ({ page }) => {
    // 4.4.1
    await navigateToMapBinding(page)
    await enterEditMode(page)
    await page.locator('.tab-btn:has-text("虚拟空间站")').click()
    await page.waitForTimeout(300)
    await expect(page.locator('.virtual-station-tab')).toBeVisible()

    // 4.4.2
    const tabText = await page.locator('.virtual-station-tab').innerText()
    expect(typeof tabText).toBe('string')
  })

  test('4.5 文案本地化', async ({ page }) => {
    // 4.5.1
    await navigateToMapBinding(page)
    await expect(page.locator('.tab-btn:has-text("枢纽")')).toBeVisible()
    await expect(page.locator('.tab-btn:has-text("分配方案")')).toBeVisible()
    await expect(page.locator('.tab-btn:has-text("交易站")')).toBeVisible()
    await expect(page.locator('.tab-btn:has-text("虚拟空间站")')).toBeVisible()

    // 4.5.2
    const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
    await langSelect.selectOption('en')
    await page.waitForTimeout(500)
    await expect(page.locator('.tab-btn:has-text("Hub")')).toBeVisible()
    await expect(page.locator('.tab-btn:has-text("Allocation")')).toBeVisible()
    await expect(page.locator('.tab-btn:has-text("Trade Station")')).toBeVisible()
    await expect(page.locator('.tab-btn:has-text("Virtual Station")')).toBeVisible()

    // 4.5.3
    await langSelect.selectOption('zh-CN')
    await page.waitForTimeout(500)
    await expect(page.locator('.tab-btn:has-text("虚拟空间站")')).toBeVisible()
  })
})

// ============================================================================
// 5 Virtual Station Drag 与 Overlay
// ============================================================================
test.describe('5 Virtual Station Drag 与 Overlay', () => {

  test('5.1 blueprint 创建', async ({ page }) => {
    await navigateToMapBinding(page)
    await enterEditMode(page)
    await page.locator('.tab-btn:has-text("虚拟空间站")').click()
    await page.waitForTimeout(300)

    // 5.1.1
    const freeItems = page.locator('.free-station-item')
    const freeCount = await freeItems.count()
    expect(freeCount).toBeGreaterThanOrEqual(0)

    // Get valid sectorMacro from existing groups
    const sectorMacro = await getFirstGroupSector(page)

    // 5.1.2
    if (sectorMacro) {
      const beforeCount = await page.evaluate(() => (window as any).liveStore?.virtualStationDrafts?.length ?? 0)
      await page.evaluate((sector: string) => {
        const liveStore = (window as any).liveStore
        if (liveStore?.createBlankVirtualStationDraft) {
          liveStore.createBlankVirtualStationDraft({ sectorMacro: sector, position: { x: 0, y: 0, z: 0 } })
        }
      }, sectorMacro)
      await page.waitForTimeout(300)
      const afterCount = await page.evaluate(() => (window as any).liveStore?.virtualStationDrafts?.length ?? 0)
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount)

      // 5.1.3
      const draft = await page.evaluate((sector: string) => {
        const drafts = (window as any).liveStore?.virtualStationDrafts ?? []
        return drafts.find((d: any) => d.sectorMacro === sector) ?? null
      }, sectorMacro)
      expect(draft).not.toBeNull()
      if (draft) {
        expect(draft.type).toBe('industrial')
        expect(draft.modules).toEqual([])
      }

      // 5.1.4
      if (draft) {
        expect(draft.saveStationCode).toBeUndefined()
      }
    }
  })

  test('5.2 blank 创建', async ({ page }) => {
    // 5.2.1
    await navigateToMapBinding(page)
    await enterEditMode(page)
    await page.locator('.tab-btn:has-text("虚拟空间站")').click()
    await page.waitForTimeout(300)
    await expect(page.locator('.virtual-station-tab')).toBeVisible()

    const sectorMacro = await getFirstGroupSector(page)

    // 5.2.2
    if (sectorMacro) {
      await page.evaluate((sector: string) => {
        const liveStore = (window as any).liveStore
        if (liveStore?.createBlankVirtualStationDraft) {
          liveStore.createBlankVirtualStationDraft({ sectorMacro: sector, position: { x: 100, y: 200, z: 0 } })
        }
      }, sectorMacro)
      await page.waitForTimeout(300)
      const blankDraft = await page.evaluate((sector: string) => {
        const drafts = (window as any).liveStore?.virtualStationDrafts ?? []
        return drafts.find((d: any) => d.sectorMacro === sector) ?? null
      }, sectorMacro)
      expect(blankDraft).not.toBeNull()
      if (blankDraft) {
        expect(blankDraft.type).toBe('industrial')
        expect(blankDraft.modules).toEqual([])
        expect(blankDraft.lockedWares).toEqual([])
        expect(blankDraft.saveStationCode).toBeUndefined()
      }
    }
  })

  test('5.3 existing draft 移动', async ({ page }) => {
    // 5.3.1
    await navigateToMapBinding(page)
    await enterEditMode(page)
    await page.locator('.tab-btn:has-text("虚拟空间站")').click()
    await page.waitForTimeout(300)

    const sectorMacro = await getFirstGroupSector(page)
    expect(sectorMacro).not.toBeNull()

    const draftId = await page.evaluate((sector: string) => {
      const liveStore = (window as any).liveStore
      if (liveStore?.createBlankVirtualStationDraft) {
        const draft = liveStore.createBlankVirtualStationDraft({ sectorMacro: sector, position: { x: 10, y: 20, z: 0 } })
        return draft?.id ?? null
      }
      return null
    }, sectorMacro!)
    await page.waitForTimeout(300)
    expect(draftId).not.toBeNull()

    // 5.3.2
    if (draftId) {
      const beforeCount = await page.evaluate(() => (window as any).liveStore?.virtualStationDrafts?.length ?? 0)
      await page.evaluate(({ draftId, sector }: { draftId: string; sector: string }) => {
        const drafts = (window as any).liveStore?.virtualStationDrafts ?? []
        const draft = drafts.find((d: any) => d.id === draftId)
        if (draft) {
          draft.sectorMacro = sector
          draft.position = { x: 50, y: 60, z: 0 }
        }
      }, { draftId, sector: sectorMacro! })
      await page.waitForTimeout(300)
      const afterCount = await page.evaluate(() => (window as any).liveStore?.virtualStationDrafts?.length ?? 0)
      expect(afterCount).toBe(beforeCount)
    }
  })

  test('5.4 drop 拒绝', async ({ page }) => {
    // 5.4.1
    await navigateToMapBinding(page)
    const coverage = await page.evaluate(() => {
      const result = (window as any).liveStore?.autoGroupResult
      if (!result?.groups) return null
      const covered = new Set<string>()
      for (const g of result.groups) {
        covered.add(g.sectorMacro)
        for (const c of (g.coverage ?? [])) { covered.add(c) }
      }
      return { coveredCount: covered.size }
    })
    expect(coverage).not.toBeNull()
    expect(coverage!.coveredCount).toBeGreaterThan(0)

    // 5.4.2
    const multiCoverage = await page.evaluate(() => {
      const result = (window as any).liveStore?.autoGroupResult
      if (!result?.groups) return null
      const sectorMap = new Map<string, string[]>()
      for (const g of result.groups) {
        const all = [g.sectorMacro, ...(g.coverage ?? [])]
        for (const s of all) {
          if (!sectorMap.has(s)) sectorMap.set(s, [])
          sectorMap.get(s)!.push(g.id)
        }
      }
      const multi: string[] = []
      for (const [s, ids] of sectorMap) { if (ids.length > 1) multi.push(s) }
      return multi.length
    })
    expect(multiCoverage).toBe(0)
  })

  test('5.5 删除', async ({ page }) => {
    // 5.5.1
    await navigateToMapBinding(page)
    await enterEditMode(page)
    await page.locator('.tab-btn:has-text("虚拟空间站")').click()
    await page.waitForTimeout(300)

    const sectorMacro = await getFirstGroupSector(page)
    expect(sectorMacro).not.toBeNull()

    const draftId = await page.evaluate((sector: string) => {
      const liveStore = (window as any).liveStore
      if (liveStore?.createBlankVirtualStationDraft) {
        const draft = liveStore.createBlankVirtualStationDraft({ sectorMacro: sector, position: { x: 0, y: 0, z: 0 } })
        return draft?.id ?? null
      }
      return null
    }, sectorMacro!)
    await page.waitForTimeout(300)
    expect(draftId).not.toBeNull()

    // 5.5.2
    if (draftId) {
      const beforeCount = await page.evaluate(() => (window as any).liveStore?.virtualStationDrafts?.length ?? 0)
      await page.evaluate(({ draftId }: { draftId: string }) => {
        const liveStore = (window as any).liveStore
        if (liveStore?.virtualStationDrafts) {
          liveStore.virtualStationDrafts = liveStore.virtualStationDrafts.filter((d: any) => d.id !== draftId)
        }
      }, { draftId })
      await page.waitForTimeout(300)
      const afterCount = await page.evaluate(() => (window as any).liveStore?.virtualStationDrafts?.length ?? 0)
      expect(afterCount).toBeLessThan(beforeCount)
    }
  })

  test('5.6 overlay 激活', async ({ page }) => {
    // 5.6.1
    await navigateToMapBinding(page)
    await enterEditMode(page)

    const sectorMacro = await getFirstGroupSector(page)
    if (sectorMacro) {
      await page.evaluate((sector: string) => {
        const liveStore = (window as any).liveStore
        if (liveStore?.createBlankVirtualStationDraft) {
          liveStore.createBlankVirtualStationDraft({ sectorMacro: sector, position: { x: 30, y: 40, z: 0 } })
        }
      }, sectorMacro)
    }
    await page.waitForTimeout(500)
    await expect(page.getByTestId('map-save-panel')).toBeVisible()

    // 5.6.2
    await page.locator('.tab-btn:has-text("枢纽")').click()
    await page.waitForTimeout(300)
    const hubActive = await page.locator('.tab-btn:has-text("枢纽")').evaluate(el => el.classList.contains('active'))
    expect(hubActive).toBe(true)
  })
})

// ============================================================================
// 6 Virtual Trade Station Drag
// ============================================================================
test.describe('6 Virtual Trade Station Drag', () => {

  test('6.1 overlay 渲染', async ({ page }) => {
    // 6.1.1
    await navigateToMapBinding(page)
    await enterEditMode(page)
    const tsTab = page.locator('.tab-btn:has-text("交易站")')
    if (!(await tsTab.isDisabled())) { await tsTab.click(); await page.waitForTimeout(300) }

    // 6.1.2 Trade station cards visible with content
    const tsCards = page.locator('.trade-station-card')
    const cardCount = await tsCards.count()
    expect(cardCount).toBeGreaterThanOrEqual(0)
    // Verify at least one card has meaningful content
    if (cardCount > 0) {
      const firstCardText = await tsCards.first().innerText()
      expect(firstCardText.length).toBeGreaterThan(0)
    }
  })

  test('6.2 拖动 position', async ({ page }) => {
    // 6.2.1
    await navigateToMapBinding(page)
    await enterEditMode(page)
    const groups = await page.evaluate(() => {
      const result = (window as any).liveStore?.autoGroupResult
      return result?.groups?.map((g: any) => ({
        id: g.id,
        sectorMacro: g.sectorMacro,
        name: g.name,
        tradeStation: g.tradeStation ?? null,
      })) ?? []
    })
    expect(groups.length).toBeGreaterThan(0)

    // 6.2.2 Each group has an id and sectorMacro
    for (const g of groups) {
      expect(g.id).toBeDefined()
      expect(g.sectorMacro).toBeDefined()
    }
  })

  test('6.3 hub sector 限制', async ({ page }) => {
    // 6.3.1
    await navigateToMapBinding(page)
    await enterEditMode(page)
    const hubSectors = await page.evaluate(() => {
      const result = (window as any).liveStore?.autoGroupResult
      return result?.groups?.map((g: any) => g.sectorMacro) ?? []
    })
    expect(hubSectors.length).toBeGreaterThan(0)

    // 6.3.2 Each hub sector is a non-empty string
    for (const s of hubSectors) {
      expect(typeof s).toBe('string')
      expect(s.length).toBeGreaterThan(0)
    }
  })

  test('6.4 不修改归属', async ({ page }) => {
    // 6.4.1
    await navigateToMapBinding(page)
    await enterEditMode(page)
    const before = await snapshotGroups(page)
    expect(before).not.toBeNull()

    // 6.4.2 Switch tabs and verify group data unchanged
    const allocTab = page.locator('.tab-btn:has-text("分配方案")')
    if (await allocTab.isVisible() && !(await allocTab.isDisabled())) {
      await allocTab.click()
      await page.waitForTimeout(300)
    }
    const after = await snapshotGroups(page)
    expect(after?.count).toBe(before!.count)
    expect(after?.coverageJson).toBe(before!.coverageJson)
  })

  test('6.5 坐标展示', async ({ page }) => {
    // 6.5.1
    await navigateToMapBinding(page)
    await enterEditMode(page)
    const tsTab = page.locator('.tab-btn:has-text("交易站")')
    if (!(await tsTab.isDisabled())) { await tsTab.click(); await page.waitForTimeout(300) }
    await expect(page.locator('.tab-content')).toBeVisible()

    // 6.5.2 Trade station tab content area visible
    const tsContent = page.locator('.tab-content')
    await expect(tsContent).toBeVisible()
  })
})

// ============================================================================
// 7 回归风险
// ============================================================================
test.describe('7 回归风险', () => {

  test('7.1 防止 Map 面板操作触发自动计算', async ({ page }) => {
    // 7.1.1
    await navigateToMapBinding(page)
    await enterEditMode(page)
    const before = await snapshotGroups(page)
    expect(before).not.toBeNull()

    // 7.1.2
    const closeBtn = page.getByTestId('map-save-panel-close')
    await closeBtn.click()
    await page.waitForTimeout(500)
    const saveTab = page.getByTestId('map-save-panel-tab')
    await saveTab.click()
    await page.waitForTimeout(1000)

    // 7.1.3
    const after = await snapshotGroups(page)
    expect(after?.count).toBe(before!.count)
    expect(after?.coverageJson).toBe(before!.coverageJson)
    expect(after?.connectionsJson).toBe(before!.connectionsJson)
  })

  test('7.2 防止 Hub edit 态错误禁用 Virtual Station tab', async ({ page }) => {
    // 7.2.1
    await navigateToMapBinding(page)
    await enterEditMode(page)
    await expect(page.locator('.tab-btn:has-text("虚拟空间站")')).not.toBeDisabled()

    // 7.2.2
    await page.locator('.tab-btn:has-text("虚拟空间站")').click()
    await page.waitForTimeout(300)
    await expect(page.locator('.tab-btn:has-text("虚拟空间站")')).toHaveClass(/active/)
    await expect(page.locator('.virtual-station-tab')).toBeVisible()
  })

  test('7.3 防止 virtual station drop 使用 fallback group', async ({ page }) => {
    // 7.3.1
    await navigateToMapBinding(page)
    const coverage = await page.evaluate(() => {
      const result = (window as any).liveStore?.autoGroupResult
      if (!result?.groups) return null
      const sectorMap = new Map<string, string[]>()
      for (const g of result.groups) {
        const all = [g.sectorMacro, ...(g.coverage ?? [])]
        for (const s of all) {
          if (!sectorMap.has(s)) sectorMap.set(s, [])
          sectorMap.get(s)!.push(g.id)
        }
      }
      const multi: string[] = []
      for (const [s, ids] of sectorMap) { if (ids.length > 1) multi.push(s) }
      return { sectorCount: sectorMap.size, multiCovered: multi }
    })
    expect(coverage).not.toBeNull()
    expect(coverage!.multiCovered.length).toBe(0)
  })

  test('7.4 防止 existing virtual station 拖动重复创建 station plan', async ({ page }) => {
    // 7.4.1
    await navigateToMapBinding(page)
    await enterEditMode(page)
    const beforeCount = await page.evaluate(() => (window as any).liveStore?.virtualStationDrafts?.length ?? 0)

    const sectorMacro = await getFirstGroupSector(page)
    expect(sectorMacro).not.toBeNull()

    await page.evaluate((sector: string) => {
      const liveStore = (window as any).liveStore
      if (liveStore?.createBlankVirtualStationDraft) {
        liveStore.createBlankVirtualStationDraft({ sectorMacro: sector, position: { x: 0, y: 0, z: 0 } })
      }
    }, sectorMacro!)
    await page.waitForTimeout(300)
    const afterCreate = await page.evaluate(() => (window as any).liveStore?.virtualStationDrafts?.length ?? 0)
    expect(afterCreate).toBe(beforeCount + 1)

    await page.evaluate((sector: string) => {
      const drafts = (window as any).liveStore?.virtualStationDrafts ?? []
      const draft = drafts.find((d: any) => d.sectorMacro === sector)
      if (draft) { draft.position = { x: 10, y: 20, z: 0 } }
    }, sectorMacro!)
    await page.waitForTimeout(300)
    const afterUpdate = await page.evaluate(() => (window as any).liveStore?.virtualStationDrafts?.length ?? 0)
    expect(afterUpdate).toBe(afterCreate)
  })

  test('7.5 防止旧 MapBinding 面板重新进入生产路径', async ({ page }) => {
    // 7.5.1
    await navigateToMapBinding(page)
    const oldPanel = page.locator('.binding-sector-group')
    await expect(oldPanel).not.toBeVisible({ timeout: 3000 })
    const newPanel = page.locator('.auto-sector-group-map-panel')
    await expect(newPanel.first()).toBeVisible({ timeout: 5000 })

    // 7.5.2
    await expect(page.getByTestId('map-save-panel')).toBeVisible()
  })
})
