/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  buildSectorResourceFill,
  buildDefaultResourceFilters,
  buildYieldRanksByWare,
  type RegionYieldEntry,
  type ResourceFilterMap
} from '@/store/logic/mapResourceFilter'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useGameDataStore } from '@/store/useGameDataStore'

// ============================================================
// Mocks
// ============================================================

vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/regionyields.json', () => ({
  default: [
    { ware: 'ore', color: '#ff9900', yields: [{ name: 'lowest' }, { name: 'medium' }, { name: 'high' }] },
    { ware: 'silicon', color: '#00bbff', yields: [{ name: 'lowest' }, { name: 'medium' }, { name: 'high' }] },
    { ware: 'methane', color: '#34d399', yields: [{ name: 'lowest' }, { name: 'medium' }, { name: 'high' }] },
    { ware: 'hydrogen', color: '#60a5fa', yields: [{ name: 'lowest' }, { name: 'medium' }, { name: 'high' }] },
    { ware: 'helium', color: '#f472b6', yields: [{ name: 'lowest' }, { name: 'medium' }, { name: 'high' }] }
  ]
}))

vi.mock('@/assets/x4_game_data/8.0-Diplomacy/data/maps.json', () => ({
  default: {
    clusters: {
      cluster_01: {
        sectors: {
          sector_alpha: {
            id: 'sector_alpha',
            resources: [
              { ware: 'ore', yield: 'high', level: 12 },
              { ware: 'silicon', yield: 'high', level: 11 }
            ],
            area: { sunlight: 1.5 }
          }
        }
      }
    }
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'en' },
    t: (key: string) => {
      const dict: Record<string, string> = {
        'res.ore': 'OreShort',
        'res.energycells': 'EC',
        'res.silicon': 'Si',
      }
      return dict[key] || key
    }
  })
}))

vi.mock('@/i18n', () => ({
  loadLanguageAsync: vi.fn(async () => {})
}))

vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateModule: (item: { id: string }) => item.id,
    translateModuleGroup: (item: { id: string }) => item.id,
    translateWare: (item: { id: string }) => item.id
  })
}))

import MapResourceFilterPanel from '@/components/empire/MapResourceFilterPanel.vue'
import MapSvgCanvas from '@/components/empire/MapSvgCanvas.vue'

// ============================================================
// Test Data
// ============================================================

const regionYields: RegionYieldEntry[] = [
  { ware: 'ore', yields: [{ name: 'lowest' }, { name: 'medium' }, { name: 'high' }] },
  { ware: 'silicon', yields: [{ name: 'lowest' }, { name: 'medium' }, { name: 'high' }] },
  { ware: 'ice', yields: [{ name: 'lowest' }, { name: 'medium' }, { name: 'high' }] }
]

const makeFilters = (patch: Partial<ResourceFilterMap> = {}) => ({
  ...buildDefaultResourceFilters(regionYields),
  ...patch
})

// ============================================================
// Chapter 1: Unit Tests
// ============================================================

describe('resource-pie', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const gameData = useGameDataStore()
    gameData.localizedWaresMap = {
      ore: { id: 'ore', localeName: 'Ore Full' },
      silicon: { id: 'silicon', localeName: 'Silicon Full' }
    }
  })

  // 1.1 buildSectorResourceFill 饼图切片份额计算
  it('1.1 buildSectorResourceFill 饼图切片份额计算', () => {
    // 1.1.1 在 `tests/unit/map-resource-filter/map-resource-filter.spec.ts` 中对 `buildSectorResourceFill` 函数传入两个资源（ore level=14, silicon level=2）并执行份额计算，断言返回 `mode: 'pie'` 且切片数量为 2 #期望: [mode='pie', slices.length=2]
    const fill = buildSectorResourceFill({
      sector: {
        sectorId: 'sector-a',
        name: 'Alpha',
        displayName: 'Alpha',
        resources: [
          { ware: 'ore', yield: 'high', level: 14 },
          { ware: 'silicon', yield: 'high', level: 2 }
        ],
        sunlight: 180
      },
      selectedWareIds: ['ore', 'silicon'],
      sunlightFilterEnabled: true,
      resourceColors: {
        ore: '#ff9900',
        silicon: '#00bbff',
        sunlight: '#f7d24b'
      }
    })

    // #期望: [mode='pie', slices.length=2]
    expect(fill?.mode).toBe('pie')
    if (fill?.mode === 'pie') {
      expect(fill.slices).toHaveLength(2)
    }

    // 1.1.2 对上述返回结果断言每个切片 `share >= 0.05` #期望: [所有切片 share >= 0.05]
    // #期望: [所有切片 share >= 0.05]
    if (fill?.mode === 'pie') {
      expect(fill.slices.every((slice) => slice.share >= 0.05)).toBe(true)
    }

    // 1.1.3 对上述返回结果断言所有切片 `share` 总和接近 1 #期望: [sum(share) ≈ 1]
    // #期望: [sum(share) ≈ 1]
    if (fill?.mode === 'pie') {
      expect(fill.slices.reduce((sum, slice) => sum + slice.share, 0)).toBeCloseTo(1, 6)
    }
  })

  // 1.2 buildSectorResourceFill 零 level 归一化处理
  it('1.2 buildSectorResourceFill 零 level 归一化处理', () => {
    // 1.2.1 在 `tests/unit/map-resource-filter/map-resource-filter.spec.ts` 中对 `buildSectorResourceFill` 函数传入三个资源（ore/silicon/ice level 均为 0）并执行份额计算，断言返回 `mode: 'pie'` 且切片数量为 3 #期望: [mode='pie', slices.length=3]
    const fill = buildSectorResourceFill({
      sector: {
        sectorId: 'sector-z',
        name: 'Zero',
        displayName: 'Zero',
        resources: [
          { ware: 'ore', yield: 'lowest', level: 0 },
          { ware: 'silicon', yield: 'lowest', level: 0 },
          { ware: 'ice', yield: 'lowest', level: 0 }
        ],
        sunlight: 0
      },
      selectedWareIds: ['ore', 'silicon', 'ice'],
      sunlightFilterEnabled: false,
      resourceColors: {
        ore: '#ff9900',
        silicon: '#00bbff',
        ice: '#ddeeff',
        sunlight: '#f7d24b'
      }
    })

    // #期望: [mode='pie', slices.length=3]
    expect(fill?.mode).toBe('pie')
    if (fill?.mode === 'pie') {
      expect(fill.slices).toHaveLength(3)
    }

    // 1.2.2 对上述返回结果断言每个切片 `share >= 0.05` #期望: [所有切片 share >= 0.05]
    // #期望: [所有切片 share >= 0.05]
    if (fill?.mode === 'pie') {
      expect(fill.slices.every((slice) => slice.share >= 0.05)).toBe(true)
    }

    // 1.2.3 对上述返回结果断言所有切片 `share` 总和接近 1 #期望: [sum(share) ≈ 1]
    // #期望: [sum(share) ≈ 1]
    if (fill?.mode === 'pie') {
      expect(fill.slices.reduce((sum, slice) => sum + slice.share, 0)).toBeCloseTo(1, 6)
    }
  })

  // 1.3 buildSectorResourceFill 日光回退逻辑
  it('1.3 buildSectorResourceFill 日光回退逻辑', () => {
    // 1.3.1 在 `tests/unit/map-resource-filter/map-resource-filter.spec.ts` 中对 `buildSectorResourceFill` 函数传入空资源列表且 `sunlightFilterEnabled=true`，断言返回 `mode: 'solid'` 且 `ware='sunlight'` #期望: [mode='solid', ware='sunlight']
    const fill = buildSectorResourceFill({
      sector: {
        sectorId: 'sector-s',
        name: 'Sun',
        displayName: 'Sun',
        resources: [],
        sunlight: 150
      },
      selectedWareIds: [],
      sunlightFilterEnabled: true,
      resourceColors: {
        sunlight: '#f7d24b'
      }
    })

    // #期望: [mode='solid', ware='sunlight']
    expect(fill).toEqual({
      mode: 'solid',
      ware: 'sunlight',
      color: '#f7d24b'
    })
  })

  // 1.4 MapResourceFilterPanel 多资源选择事件输出
  it('1.4 MapResourceFilterPanel 多资源选择事件输出', async () => {
    const wrapper = mount(MapResourceFilterPanel, {
      props: {
        sectorLayouts: [
          {
            sectorId: 'sector_alpha',
            clusterId: 'cluster_01',
            name: 'Alpha',
            displayName: 'Alpha',
            centerX: 0,
            centerY: 0
          }
        ],
        mode: 'sidebar'
      }
    })

    // 1.4.1 在 `tests/unit/map-resource-filter/map-resource-filter-panel.spec.ts` 中挂载组件并依次点击 ore 和 silicon 两个资源 tag
    await wrapper.get('[data-testid="map-resource-tag-ore"]').trigger('click')
    await wrapper.get('[data-testid="map-resource-tag-silicon"]').trigger('click')

    const payload = wrapper.emitted('resource-visual-change')?.at(-1)?.[0] as any

    // 1.4.2 对组件发出的 `resource-visual-change` 事件断言 payload 包含 `highlightedSectorIds` 和 `sectorFills` #期望: [包含 highlightedSectorIds 和 sectorFills]
    // #期望: [包含 highlightedSectorIds 和 sectorFills]
    expect(payload.highlightedSectorIds).toEqual(['sector_alpha'])
    expect(payload.sectorFills).toBeDefined()

    // 1.4.3 对 `sectorFills[sectorId].mode` 断言值为 `'pie'` #期望: [mode='pie']
    // #期望: [mode='pie']
    expect(payload.sectorFills.sector_alpha.mode).toBe('pie')

    // 1.4.4 对 `sectorFills[sectorId].slices` 断言切片按资源 tag 固定顺序排列 #期望: [slices 顺序为 ore, silicon]
    // #期望: [slices 顺序为 ore, silicon]
    expect(payload.sectorFills.sector_alpha.slices.map((slice: any) => slice.ware)).toEqual(['ore', 'silicon'])
  })

  // 1.5 MapSvgCanvas 饼图切片渲染
  it('1.5 MapSvgCanvas 饼图切片渲染', () => {
    // 1.5.1 在 `tests/unit/map-resource-filter/map-svg-canvas.spec.ts` 中挂载组件并传入 `resourceSectorFills` 包含 `mode: 'pie'` 和两个切片
    const wrapper = mount(MapSvgCanvas, {
      props: {
        resourceHighlightedSectorIds: ['sector_alpha'],
        resourceSectorFills: {
          sector_alpha: {
            mode: 'pie',
            slices: [
              { ware: 'ore', color: '#ff9900', share: 0.65 },
              { ware: 'silicon', color: '#00bbff', share: 0.35 }
            ]
          }
        }
      }
    })

    // 1.5.2 对组件渲染结果断言存在两个 `data-testid="resource-pie-slice"` 元素 #期望: [slices.length=2]
    const slices = wrapper.findAll('[data-testid="resource-pie-slice"]')
    // #期望: [slices.length=2]
    expect(slices).toHaveLength(2)

    // 1.5.3 对每个切片元素断言 `fill` 属性与传入颜色一致 #期望: [fill 属性匹配]
    // #期望: [fill 属性匹配]
    expect(slices[0]?.attributes('fill')).toBe('#ff9900')
    expect(slices[1]?.attributes('fill')).toBe('#00bbff')
  })
})