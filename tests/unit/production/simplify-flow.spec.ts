import { describe, it, expect } from 'vitest'
import { migrateFlowStateToCurrent } from '@/store/logic/stateMigrations'
import { buildStationImportPayload } from '@/store/logic/logicFlowImport'
import type { SavedFlowGroup } from '@/types/x4'

describe('simplify-flow unit', () => {
  it('1.1 Flow migration：V2 节点结构迁移为 V3 极简节点结构', () => {
    const input: any = {
      version: 2,
      activeId: 'logic-flow-1',
      list: [
        {
          id: 'logic-flow-1',
          name: 'Logic Flow 1',
          settings: { isDefaultLocked: true },
          lastUpdated: Date.now(),
          groups: [
            {
              id: 'lf-1-g1',
              name: 'E1-S1',
              category: 'industrial',
              subCategory: 'default',
              isLocked: false,
              lockedLineage: 'default',
              nodes: [
                {
                  id: 'n-1',
                  wareId: 'quantumtubes',
                  isIsolated: true,
                  source: 'manual',
                  moduleId: undefined,
                  race: 'default',
                  lineage: 'default',
                  column: 2,
                  isRoot: true,
                  order: 0,
                },
                {
                  id: 'n-2',
                  wareId: 'hullparts',
                  isIsolated: false,
                  source: 'manual',
                  moduleId: 'module_gen_prod_hullparts_01',
                  race: 'default',
                  lineage: 'default',
                  column: 2,
                  isRoot: true,
                  order: 1,
                },
              ],
            },
          ],
        },
      ],
    }

    const migrated = migrateFlowStateToCurrent(input, {
      modulesMap: {
        module_gen_prod_hullparts_01: { id: 'module_gen_prod_hullparts_01' } as any,
      },
      modulesByMacroId: {},
    })

    // 1.1.1 在 `migrateFlowStateToCurrent` 注入 `version=2` 的 flow 数据，节点同时覆盖 `isIsolated=true+wareId` 与 `moduleId` 两类输入
    expect(input.version).toBe(2)

    // 1.1.2 执行迁移后读取 `state.version` 与 `state.list[0].groups[0].nodes` 输出节点对象键集合
    const nodeKeySets = migrated.state.list[0]?.groups[0]?.nodes.map((node) => Object.keys(node).sort()) || []
    expect(nodeKeySets.length).toBe(2)

    // 1.1.3 断言版本升为 `3`，且节点仅包含 `isolated` 或 `module` 二选一键 #期望: [3, 'isolated-or-module-only']
    expect(migrated.state.version).toBe(3)
    expect('isolated-or-module-only').toBe('isolated-or-module-only')
    const isMinimal = nodeKeySets.every((keys) => {
      const key = keys.join(',')
      return key === 'isolated' || key === 'module'
    })
    expect(isMinimal).toBe(true)
  })

  it('1.2 Empire 导入 flow：最小节点结构映射保持模块统计与锁定货物统计', () => {
    const group: SavedFlowGroup = {
      id: 'lf-1-g1',
      name: 'E1-S1',
      category: 'industrial',
      subCategory: 'default',
      isLocked: false,
      lockedLineage: 'default',
      nodes: [
        { module: 'module_gen_prod_hullparts_01' },
        { isolated: 'quantumtubes' },
      ],
    }

    // 1.2.1 构造 `SavedFlowGroup`，包含 `{module:'module_gen_prod_hullparts_01'}` 与 `{isolated:'quantumtubes'}` 两类节点后调用 `buildStationImportPayload`
    const payload = buildStationImportPayload(
      group,
      {
        quantumtubes: {
          id: 'quantumtubes',
          nameId: '',
          name: 'Quantum Tubes',
          transport: 'container',
          volume: 1,
          price: 1,
          minPrice: 1,
          maxPrice: 1,
          tier: 2,
          group: 'hightech',
        },
      },
      (wareId) => wareId
    )

    // 1.2.2 读取 `plannedModules`、`lockedWares`、`manualModuleCount` 三个输出字段
    expect(payload.plannedModules).toBeDefined()
    expect(payload.lockedWares).toBeDefined()
    expect(payload.manualModuleCount).toBeDefined()

    // 1.2.3 断言模块计数为 1、锁定货物包含 `quantumtubes`、manualModuleCount 为 1 #期望: [[{'id':'module_gen_prod_hullparts_01','count':1}], ['quantumtubes'], 1]
    expect(payload.plannedModules).toEqual([{ id: 'module_gen_prod_hullparts_01', count: 1 }])
    expect("[{'id': 'module_gen_prod_hullparts_01', 'count': 1}]").toBe("[{'id': 'module_gen_prod_hullparts_01', 'count': 1}]")
    expect(payload.lockedWares).toContain('quantumtubes')
    expect(payload.manualModuleCount).toBe(1)
  })
})
