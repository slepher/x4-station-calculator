# Map Station Layout Replan Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在最新地图布局基础上，为 map 页面增加左下角“空间站”入口和左侧弹出的空间站工作栏，并让 `station/sector` 放置与 `location` 持久化适配新的 sidebar 结构。

**Architecture:** 最新 `MapWorkbenchView` 已固定为“左上资源入口、右上搜索、右下缩放”，且 `MapResourceFilterPanel` 作为 `map-layout` 的第一个子节点存在。空间站栏应采用与资源面板并列的 sibling sidebar 结构，从左侧展开；地图内只保留左下角入口按钮和 overlay 交互，避免与既有布局和测试冲突。

**Tech Stack:** Vue 3 SFC, Pinia, TypeScript, Tailwind, Vitest

---

### Task 1: 锁定最新地图布局约束

**Files:**
- Read: `src/components/empire/MapWorkbenchView.vue`
- Read: `tests/unit/map-tooltip/map-workbench-view.spec.ts`
- Read: `openspec/changes/map-station/request.md`

**Step 1: 确认布局不变量**

- `MapResourceFilterPanel` 是 `map-layout` 第一个子节点。
- 搜索框固定在右上。
- 资源按钮固定在左上。
- 缩放面板固定在右下。

**Step 2: 明确空间站栏的新接入规则**

- 空间站入口按钮只能放在左下。
- 空间站 sidebar 只能从左侧弹出。
- 不能破坏现有资源面板的位置测试。

### Task 2: 重构规划文档以反映新布局

**Files:**
- Modify: `openspec/changes/map-station/request.md`
- Modify: `openspec/changes/map-station/design.md`
- Modify: `openspec/changes/map-station/specs/map-station/spec.md`

**Step 1: 更新 request 的布局描述**

- 把“右下角按钮”保留。
- 将“右侧工作面板”改为“左侧工作面板”。
- 明确其不占用地图右侧区域。

**Step 2: 更新 design 的组件结构**

- 将空间站栏定义为 `MapStationPanel`，作为 `map-layout` 的 sibling。
- 放在 `map-shell` 之前，与资源面板类似但方向相反。
- 为 `map-layout` 增加独立的 `station-sidebar-active` 状态，而不是复用 `sidebar-active`。

**Step 3: 更新 spec 的验收行为**

- 按钮在左下。
- 左侧弹出 panel。
- 打开后地图仍保留右上搜索、右下缩放。

### Task 3: 设计 `MapWorkbenchView` 状态与插槽结构

**Files:**
- Modify: `src/components/empire/MapWorkbenchView.vue`
- Test: `tests/unit/map-tooltip/map-workbench-view.spec.ts`

**Step 1: 增加空间站面板状态**

- `isStationPanelOpen`
- station overlay 数据
- 当前拖放中的对象状态

**Step 2: 规划模板层级**

- `MapStationPanel` 作为 `map-layout` 的左侧 sibling。
- `map-shell` 继续保留地图、搜索框、资源按钮、缩放面板。
- 左下角入口按钮仅在 `!isStationPanelOpen` 时显示。

**Step 3: 增加位置测试**

- 验证空间站按钮位于左下。
- 验证空间站面板打开后是 `map-layout` 的左侧子节点。
- 验证资源面板测试不被破坏。

### Task 4: 定义空间站面板的方案 A 结构

**Files:**
- Create: `src/components/empire/MapStationPanel.vue`
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh-CN.json`

**Step 1: 实现面板骨架**

- header：标题、搜索框、关闭按钮
- filter chips：全部 / 空间站 / 中转点 / 未放置 / 已放置
- section A：未放置列表
- section B：已放置列表
- footer hint：拖到星区后可继续微调位置

**Step 2: 设计列表项字段**

- 图标
- 名称
- 类型标签
- 状态标签
- 操作按钮：清除位置 / 取消放置

**Step 3: 预留拖拽 data contract**

- item id
- item kind: `station | sector`
- placed status
- current location summary

### Task 5: 扩展 empire 类型与持久化输入

**Files:**
- Modify: `src/types/x4.ts`
- Modify: `src/store/logic/stateMigrations.ts`
- Modify: `src/store/useEmpireStore.ts`

**Step 1: 新增共享 location 类型**

- `EntityLocation`
- `StationPlan.location?: EntityLocation`
- `SectorPlan.location?: EntityLocation`

**Step 2: 兼容旧档**

- 旧档缺失 `location` 时安全载入。
- 无效结构时清理或忽略。

**Step 3: 增加 store 写接口**

- `setStationLocation`
- `clearStationLocation`
- `setSectorLocation`
- `clearSectorLocation`

**Step 4: 验证 dirty**

- `serializeEmpireForDirtyCheck()` 应自然包含 `location`。
- 保存与重载后 `location` 保持。

### Task 6: 设计地图 overlay 与左栏联动

**Files:**
- Modify: `src/components/empire/MapWorkbenchView.vue`
- Modify: `src/components/empire/MapSvgCanvas.vue`

**Step 1: 定义 overlay 视图模型**

- id
- kind
- name
- clusterId
- sectorId
- raw pos `{x,z}`

**Step 2: 打开左栏时显示 overlay**

- 仅 `isStationPanelOpen` 时渲染 station/sector overlay。
- 关闭时全部隐藏。

**Step 3: 规划拖放命中接口**

- 面板拖入地图
- overlay 二次拖动微调
- 命中目标 sector 后输出原始坐标

### Task 7: 坐标换算与环境快照

**Files:**
- Modify: `src/components/empire/MapSvgCanvas.vue`
- Modify: `src/components/empire/MapWorkbenchView.vue`
- Read: `src/assets/x4_game_data/8.0-Diplomacy/data/maps.json`

**Step 1: 建立原始坐标输出**

- 从鼠标落点计算目标 sector 的原始 `{x,z}`。
- 不保存 normalized ratio。

**Step 2: 写入 metadata**

- `cluster_id`
- `sector_id`
- `sunlight`
- `resources: string[]`

**Step 3: 统一 station 与 sector transit 的放置逻辑**

- 同一条路径处理两类对象。
- 二次拖动时只更新，不复制。

### Task 8: 验证路径

**Files:**
- Modify: `tests/unit/map-tooltip/map-workbench-view.spec.ts`
- Create: `tests/unit/...`（后续根据实现拆分）

**Step 1: 单测布局与状态**

- 左下入口按钮
- 左侧 panel 结构
- 面板开关时 overlay 显隐

**Step 2: 单测持久化输入**

- `location` 写入 station/sector
- 清除位置
- dirty 生效

**Step 3: 构建验证**

Run: `npm run build`
Expected: PASS
