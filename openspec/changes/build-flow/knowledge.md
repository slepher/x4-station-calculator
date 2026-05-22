# Build Flow - Test Knowledge

## UI 锚点定位

### 建筑产线区容器

| UI 元素 | Locator | 说明 |
|---|---|---|
| 建筑产线区主容器 | `.build-flow-zone` | 包含分组容器和标题栏 |
| 分组容器 | `.build-flow-group` | 每个分组独立的带边框容器 |
| 产线卡片 | `.build-flow-line-card` | 单条产线的卡片 |
| 产出区卡片 | `.build-flow-output-card` | 分组的产出区卡片 |
| 标题栏归档按钮 | `.build-flow-zone header button` (contains archive count text) | 仅当存在归档产线时显示 |

### 标签元素

| UI 元素 | Locator | 说明 |
|---|---|---|
| 产线原材料标签（来源） | `.build-flow-source-tag` | 可拖拽，右侧有 + 按钮 |
| 产线建材标签（目标） | `.build-flow-target-tag` (in line-card) | 可接收拖拽，左侧有 + 按钮 |
| 产出建材标签（目标） | `.build-flow-target-tag` (in output-card) | 可接收拖拽，左侧有 + 按钮 |
| 标签稳定锚点 | `[data-tag-id="<tagId>"]` | 用于精确定位特定 ware 的标签 |
| 来源 + 按钮 | `.source-tag-segment-add` | 点击打开目标菜单 |
| 目标 + 按钮 | `.target-tag-segment-add` | 点击打开来源菜单 |
| 解绑按钮 | `.target-tag-unbind` | 仅绑定状态下显示 |

### 交互元素

| UI 元素 | Locator | 说明 |
|---|---|---|
| 目标/来源菜单 | `.build-flow-menu` | Teleport 到 body，fixed 定位 |
| 菜单项按钮 | `.build-flow-menu button` (menu item) | 点击执行绑定 |
| 归档按钮（产线卡片） | `.archive-btn` | 位于产线卡片右上角 |
| 归档 Modal | `.fixed.inset-0.z-50` (contains archived title) | 显示已归档产线列表 |
| 恢复按钮 | 归档 Modal 内的恢复文本按钮 | 点击恢复产线 |
| SVG 连线层 | `.build-flow-edge-layer` | 分组容器内的 SVG overlay |
| Edge 路径 | `.build-flow-edge-layer path` | 单条连线 |

### Tag ID 格式

| Tag 类型 | data-tag-id 格式 | 示例 |
|---|---|---|
| 产线原材料（来源） | `build-flow-source:<groupId>:<wareId>` | `build-flow-source:lf-1-g1:hullparts` |
| 产线建材（目标） | `build-flow-target:line:<groupId>:<wareId>` | `build-flow-target:line:lf-1-g2:hullparts` |
| 产出建材（目标） | `build-flow-target:output:<wareId>` | `build-flow-target:output:hullparts` |

## Fixture 数据映射

### Ware Fixtures (tests/fixtures/ware_fixtures.yaml)

| 关键 Ware | ID | EN 名称 | CN 名称 | Tier | 测试用途 |
|---|---|---|---|---|---|
| Hull Parts | `hullparts` | Hull Parts | 船体部件 | 2 | 建筑材料主要测试对象 |
| Graphene | `graphene` | Graphene | 石墨烯 | 1 | 产线建材测试对象 |
| Refined Metals | `refinedmetals` | Refined Metals | 精炼金属 | 1 | 分组隔离测试对象 |
| Quantum Tubes | `quantumtubes` | Quantum Tubes | 量子管 | 2 | claytronics 输入材料 |
| Microchips | `microchips` | Microchips | 微芯片 | 2 | claytronics 输入材料 |
| Antimatter Cells | `antimattercells` | Antimatter Cells | 反物质单元 | 1 | claytronics 输入材料 |
| Claytronics | `claytronics` | Claytronics | 电子黏土 | 3 | 高 tier 产线测试对象 |
| Energy Cells | `energycells` | Energy Cells | 能量电池 | 0 | tier 0 排除测试对象 |

### Module Fixtures (tests/fixtures/module_fixtures.yaml)

| 关键 Module | ID | Tier | buildCost 关键材料 | 测试用途 |
|---|---|---|---|---|
| Hull Part Production | `prod_gen_hullparts_macro` | 2 | graphene, refinedmetals, energycells | 产线建材测试 |
| Claytronics Production | `prod_gen_claytronics_macro` | 3 | antimattercells, microchips, quantumtubes | 高 tier 产线测试 |
| Quantum Tube Production | `prod_gen_quantumtubes_macro` | 2 | graphene, superfluidcoolant | 产线建材测试 |
| Graphene Production | `prod_gen_graphene_macro` | 1 | methane | 低 tier 产线测试 |

### Logic Flow Plan Fixtures (tests/fixtures/db.json)

| Plan ID | Groups | 测试用途 |
|---|---|---|
| `logic-flow-1` | lf-1-g1 (claytronics, hullparts), lf-1-g2 (quantumtubes), lf-1-g3 (foodrations, medicalsupplies) | 基本渲染测试 |
| `logic-flow-2` | lf-2-g1 (多个模块 + isolated nodes), lf-2-g2 (claytronics, hullparts) | 分组测试 |
| `logic-flow-3` | lf-3-g1 (hullparts, claytronics), lf-3-g2 (medicalsupplies, foodrations) | 分组隔离测试 |

## 测试策略

### 分组算法验证

分组算法基于递归扩散（无向连通分量），测试需验证：
1. **连通性**：通过 buildMaterialTags 关联的产线在同一组
2. **隔离性**：无关联的产线在不同组
3. **确定性**：多次计算结果相同

测试数据设计：
- 产线 A：提供 hullparts，需 graphene → 与 B 连通
- 产线 B：提供 graphene，需 hullparts → 与 A 连通
- 产线 C：提供 refinedmetals，无建材需求 → 与 A/B 隔离

### 绑定覆盖验证

绑定覆盖行为需验证：
1. 同一目标标签再次绑定时，旧绑定被替换
2. edge 连线同步切换
3. 菜单显示已绑定状态（`bindingState: 'other'`）

Locator 识别：
- 已绑定（自己）：`.text-emerald-300.bg-emerald-900/20`
- 已绑定（他人）：`.text-amber-300.bg-amber-900/20`
- 未绑定：`.text-gray-300.hover:bg-gray-700`

### 归档清理验证

归档产线需验证：
1. 从建筑产线区消失
2. 相关 assignments 清理
3. 需求原材料计算排除归档产线
4. 恢复后重新参与计算

### 规划拖拽隐藏验证

规划区相关拖拽时 `BuildFlowZone` 隐藏：
- 触发条件：`logicFlow.isDragging && !logicFlow.isBuildFlowDragging`
- 验证方式：在规划区候选 ware 拖拽开始时检查 build-flow-zone 不存在
- 恢复验证：拖拽结束后检查 build-flow-zone 恢复显示

## i18n 文本锚点

| 功能 | EN Key | CN Key | 文本 |
|---|---|---|---|
| 区域标题 | `buildFlow.build_flow_zone_title` | `buildFlow.build_flow_zone_title` | BUILD FLOW / 建筑流 |
| 产线建材 | `buildFlow.build_flow_build_materials` | `buildFlow.build_flow_build_materials` | Build Materials / 产线建材 |
| 产线原材料 | `buildFlow.build_flow_source_materials` | `buildFlow.build_flow_source_materials` | Source Materials / 产线原材料 |
| 产出建材 | `buildFlow.build_flow_output_materials` | `buildFlow.build_flow_output_materials` | Output Materials / 产出建材 |
| 产出区标题 | `buildFlow.build_flow_output_card_title` | `buildFlow.build_flow_output_card_title` | Output / 产出区 |
| 归档按钮 | `buildFlow.build_flow_archive_line` | `buildFlow.build_flow_archive_line` | Archive / 归档 |
| 归档计数 | `buildFlow.build_flow_archived_count` | `buildFlow.build_flow_archived_count` | `{count} archived` / `{count} 已归档` |
| 解绑按钮 | `buildFlow.build_flow_unbind` | `buildFlow.build_flow_unbind` | Unbind / 解绑 |
| 恢复按钮 | `buildFlow.build_flow_unarchive` | `buildFlow.build_flow_unarchive` | Restore / 恢复 |

## Drag Event 操作

### 来源标签拖拽绑定

```typescript
// 1. 定位来源标签
const sourceTag = page.locator('[data-tag-id="build-flow-source:<groupId>:<wareId>"]')

// 2. 触发 dragstart
await sourceTag.dispatchEvent('dragstart')

// 3. 定位目标标签
const targetTag = page.locator('[data-tag-id="build-flow-target:line:<targetGroupId>:<wareId>"]')

// 4. 触发 drop
await targetTag.dispatchEvent('drop')
```

### 规划区拖拽触发隐藏

```typescript
// 1. 定位候选区 ware 标签（规划区）
const candidateTag = page.locator('.logic-flow-candidate-zone .ware-tag')

// 2. 触发 dragstart（规划区拖拽开始）
await candidateTag.dispatchEvent('dragstart')

// 3. 断言 build-flow-zone 消失
await expect(page.locator('.build-flow-zone')).not.toBeVisible()

// 4. 触发 dragend
await candidateTag.dispatchEvent('dragend')

// 5. 断言恢复
await expect(page.locator('.build-flow-zone')).toBeVisible()
```

## Edge 连线验证

### SVG 路径定位

```typescript
// 定位特定分组的 edge 层
const edgeLayer = page.locator('.build-flow-group').filter({ hasText: '<groupKey>' }).locator('.build-flow-edge-layer')

// 断言 edge 存在
await expect(edgeLayer.locator('path')).toHaveCount(1)
```

### 颜色分配

Edge 和标签颜色按 wareId 排序后的 index % 8 分配：
- COLORS = ['#f97316','#eab308','#22d3ee','#a78bfa','#fb923c','#facc15','#67e8f9','#c4b5fd']

验证绑定状态：
```typescript
// 绑定标签背景色非透明
const boundTag = page.locator('[data-tag-id="<targetTagId>"]')
const bgColor = await boundTag.locator('.target-tag-segment-main').evaluate(el => el.style.backgroundColor)
expect(bgColor).not.toBe('transparent')
```

## Store 访问（E2E Dev/Test Mode）

```typescript
// 访问 logicFlow store
const logicFlow = await page.evaluate(() => window.logicFlowStore)

// 检查 assignments
const assignments = await page.evaluate(() => window.logicFlowStore.buildFlowAssignments)

// 检查归档产线
const archivedIds = await page.evaluate(() => window.logicFlowStore.archivedBuildFlowGroupIds)
``
## 测试运行

### [✗] 1.5 测试 archiveGroup 清理相关 assignments

- **失败原因**: `test_defect` - `vi.hoisted()` 块引用未初始化的 `mockModulesMap`
- **修复方案**: 将 `mockModulesMap` 移入同一个 `vi.hoisted()` 块，或在 hoisted 外定义
- **经验**: `vi.hoisted()` 创建独立作用域，无法访问外部定义的变量

### [✗] 2.1-3.16 E2E 测试全部失败

- **失败原因**: `test_defect` - beforeEach 未导航到 logic-flow 页面
- **现象**: `.build-flow-zone` 元素不存在，页面停留在 Station Workbench
- **修复方案**: beforeEach 需点击"逻辑组网"按钮进入 Logic Flow Workbench
- **经验**: 建筑产线区仅存在于 Logic Flow Workbench 视图，需显式导航

## Bug 修复记录

### [2025-05-03] 删除产线时归档计数未减少

- **问题描述**: 在规划区删除已归档的产线后，建筑产线区标题栏的归档计数未减少
- **根本原因**: `removeGroup()` 和 `clearAllGroups()` 未同步清理 `archivedBuildFlowGroupIds`
- **修复方案**: 
  1. `removeGroup()` 删除产线时同步从 `archivedBuildFlowGroupIds` 移除对应 groupId
  2. `clearAllGroups()` 清空所有产线时同步清空 `archivedBuildFlowGroupIds`
- **影响范围**: `src/store/useLogicFlowStore.ts` line 530-540, 820-824
- **验证方式**: 
  1. 归档一条产线 → 检查标题栏显示归档计数
  2. 在规划区删除该产线 → 检查归档计数减少或归档图标消失
  3. 清空所有产线 → 检查归档计数归零
- **经验**: 状态清理需遵循"谁创建谁清理"原则，删除产线的入口函数（removeGroup/clearAllGroups）需负责清理所有相关状态
