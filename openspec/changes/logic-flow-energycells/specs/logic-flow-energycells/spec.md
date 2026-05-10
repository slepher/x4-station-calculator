# Logic Flow Energy Cells Specification

## Purpose

将能量电池从 logic-flow 的 T0 资源排除逻辑中移出，使其作为可自产的生产模块节点参与数据，并引入 `isRawMaterial` 判断替代 `tier === 0`。

## ADDED Requirements

### Requirement: isRawMaterialWare 判断函数

新增 `isRawMaterialWare(wareId, ctx)` 函数，判断一个 ware 是否为"不可自产的原始材料"。

- 判断依据：`modulesByOutputMap[wareId]` 中无玩家可建造的生产模块（`isPlayerBlueprint=true`）
- ore, silicon, hydrogen, helium, ice, methane, nividium, rawscrap, rawkhaakscrap → `isRawMaterial=true`
- energycells → `isRawMaterial=false`（有 `module_gen_prod_energycells_01` 和 `module_ter_prod_energycells_01`）

#### Scenario: T0 资源识别

**前提** gameData 已加载
**当** 调用 `isRawMaterialWare('ore', ctx)`
**那么** 返回 `true`

#### Scenario: energycells 不再是 rawMaterial

**前提** gameData 已加载
**当** 调用 `isRawMaterialWare('energycells', ctx)`
**那么** 返回 `false`

### Requirement: EC 节点以具体模块参与 logic-flow

energycells 在 `computeExpandUpstream` 中不再作为 isT0/isRawMaterial 跳过，而是走正常的 `findModuleForWare` 路径，获得具体 moduleId。

#### Scenario: 工业 terran 组展开包含 EC

**前提** 一个 terran 工业 group，添加了需要 EC 作为输入的产品
**当** 上游展开遇到 energycells
**那么** 创建 EC 节点，moduleId=`module_ter_prod_energycells_01`，race=`terran`

#### Scenario: 工业 argon 组展开包含 EC

**前提** 一个 argon 工业 group，添加了需要 EC 作为输入的产品
**当** 上游展开遇到 energycells
**那么** 创建 EC 节点，moduleId=`module_gen_prod_energycells_01`，race=`default`

#### Scenario: 农业 group 展开包含 EC

**前提** 一个农业 group，添加了需要 EC 作为输入的产品
**当** 上游展开遇到 energycells
**那么** 创建 EC 节点，moduleId 由 group lineage 决定

### Requirement: EC 节点不画连线到下游

EC 节点存在于图中，但 traceUpstream 和 highlightedConnectionIds 中跳过 `inputWareId === 'energycells'` 的连线。

#### Scenario: 上游追踪跳过 EC 连线

**前提** 图中存在依赖 EC 的模块节点
**当** 从下游节点 traceUpstream
**那么** 不追踪到 EC 节点

#### Scenario: 高亮连线跳过 EC

**前提** 用户悬停在某个节点
**当** 计算 highlightedConnectionIds
**那么** 不包含 EC 相关连线

### Requirement: EC 可拖动、rawMaterial 不可拖动

Vue 组件中所有 `tier === 0` 判断替换为 `isRawMaterialWare`。EC 可拖动、有＋菜单；rawMaterial 禁止拖动、无＋菜单。

#### Scenario: EC 在候选区可拖动

**前提** 候选区显示 energycells 卡片
**当** 用户拖拽 energycells
**那么** 拖拽正常开始，不阻止

#### Scenario: EC 有＋菜单

**前提** 候选区显示 energycells 卡片
**当** 渲染卡片背景层
**那么** 显示＋按钮（与 tier>0 的 ware 一致）

#### Scenario: ore 在候选区不可拖动

**前提** 候选区显示 ore 卡片
**当** 用户尝试拖拽 ore
**那么** 拖拽被阻止

#### Scenario: EC 可拖入规划区

**前提** 用户正在拖拽 energycells
**当** 悬停在现有 group 或新建区域
**那么** 不返回 'rejected'

## MODIFIED Requirements

### Requirement: calculateRequiredT0Wares 重命名

- FROM: `calculateRequiredT0Wares`
- TO: `calculateRequiredRawMaterials`

内部判断从 `ware.tier === 0` 改为 `isRawMaterialWare`，移除 `energycells` 硬编码跳过。

#### Scenario: EC 不计入原材料需求

**前提** 一个组的 manual 节点需要 EC
**当** 调用 `calculateRequiredRawMaterials`
**那么** 结果中不包含 energycells

#### Scenario: T0 资源仍计入

**前提** 一个组的 manual 节点需要 ore
**当** 调用 `calculateRequiredRawMaterials`
**那么** 结果中包含 ore

### Requirement: getWareGroupStatus 对 EC 走正常判断

原来 `ware.tier === 0 || wareId === 'energycells'` 直接返回 'available'，现改为 `isRawMaterialWare` 判断。EC 不再被特殊处理，进入正常状态判断流程。

#### Scenario: EC 在空组中拖入

**前提** 一个空 group
**当** 拖入 energycells
**那么** 返回 'available'（因 EC 无同名节点存在）

#### Scenario: EC 已存在于组中

**前提** 组中已有 EC 节点
**当** 再次拖入 energycells
**那么** 返回 'duplicated'（与普通 ware 行为一致）
