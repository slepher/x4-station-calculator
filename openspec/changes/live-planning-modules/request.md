# 实况产能规划 — 模组规划器增强

## 目标

在实况产能规划模式（live production workbench）的模组规划器中，新增 **已建模块区** 和 **在建模块区** 两个参考区域，展示存档中已存在（已建成/在建）的模块。同时引入自动模块显示相减、搜索默认数量、红色阈值警告等联动机制，让规划器以存档实况为参照进行规划。

## 已确认方案（审核重点）

### 1. 已建模块区 & 在建模块区

- **触发条件**：`visualMode === 'planning'` 且存档数据（`archiveStation`）存在。
- **显示方式**：与 `ArchiveModuleList` 一致——已建与在建模块混合显示，按 `X4Module.group` 分组（每 group 一个 tier header），组内已建在前、在建在后，在建以琥珀色虚线左边界区分。
- **无独立的「已建模块区」「在建模块区」层级 header**，只保留 group 名 header。
- **规划区与存档区之间以分隔线 `<hr>` 分隔**。
- **未知模块**：若某模块在 `modulesMap` 中查不到，跳过不显示。
- **live 模式**：live 模式下的 `ArchiveModuleList` 展示不受影响。

### 2. 自动生成模块显示相减

- **store 层不变**：`deriveFullModules` / `calculateAutoFillModules` 照常产出完整的 `autoIndustryModules`、`autoHabitationModules`、`autoInfrastructureModules`。
- **presenter 层做相减**：对每个自动模块，从显示数量中扣除存档中该模块的 `(built + building)` 总量：
  ```ts
  display_count = max(0, auto_count - archive_built - archive_building)
  ```
- 扣除后 `count <= 0` 的模块从显示列表中移除。
- `plannedModules` 不做相减，保持用户指定数量。

### 3. 点击已建/在建区添加模块到规划区

- 已建区和在建区的模块数字均可点击（`readonly`、非 `noClick`）。
- 点击时默认数量 = `archive.modules[moduleId] + archive.building.modules[moduleId]`（存档总量）。
- 若模块**已存在于 plannedModules**：
  - `planned.count < 存档总量` → 将 planned 中该模块 count 提升到存档总量。
  - `planned.count >= 存档总量` → 不重复添加，不做任何操作。
- 若模块**不存在于 plannedModules**：以存档总量为 count 添加到 plannedModules。

### 4. 搜索框添加默认数量

- 从 `StationModulePicker` 搜索框添加新模块时：
  - 若模块已在 `plannedModules` 中，每次点击 `count + 1`（现有行为不变）。
  - 若模块**不在** `plannedModules` 中，默认数量 = 存档中该模块的 `modules + buildingModules` 总量（而非硬编码 1）。
- 搜索框增量点击（已存在时 +1）不受此约束影响。

### 5. 红色阈值警告

- 对于 `plannedModules` 中**所有**满足 `planned.count < archive_total` 的模块，数字以红色显示。
- 红色表示"规划数量低于已拥有数量"，是一种视觉警告。
- 不区分是否从已建/在建区添加，只要是低于存档总量就红色。

### 6. autoFill 参考模块优先级

`calculateAutoFillModules` 新增「参考模块」参数。live 模式下，参考模块 = `archive.modules + archive.building.modules`。

autoFill 选择模块填补缺口时按以下优先级逐级匹配：

| 优先级 | 条件 | 配额机制 |
|--------|------|----------|
| P1 | `race` 匹配 **且** 在参考中 | 按该模块参考产能为上限（消耗后扣减） |
| P2 | 在参考中（不限 race，除去 P1 已消耗） | 按该模块剩余参考产能为上限 |
| P3 | `race` 匹配 **且** 在 plannedModules | 无上限（沿袭现有逻辑） |
| P4 | 在 plannedModules 中（不限 race） | 无上限 |
| P5 | `race` 匹配 **且** 在参考中 | 无上限 |
| P6 | 在参考中（不限 race） | 无上限 |
| P7 | `race` 匹配 | 无上限 |
| P8 | 任意模块 | 无上限 |

**配额按产能计算**：参考模块中某 module 的配额 = `ref_count × 该模块单周期目标 ware 产量`，而非简单地按模块个数计。

**P1+P2 共享同一份参考配额**。P1 消耗后，P2 只对剩余配额生效。P5/P6 不再受配额约束，但模块类型仍优先于 P7/P8。

**举例**（需 10000 EC/h，race=argon，参考: Terran太阳能×2 产 2400/h, Argon太阳能×1 产 1000/h）：

```
P1 (race+ref): Argon×1 (用完 1000/h 配额)   → 缺 9000
P2 (ref):      Terran×2 (用完 2400/h 配额)  → 参考配额耗尽, 缺 6600
P3 (race+planned): 无匹配
P4 (planned): 无匹配
P5 (race+ref无上限): Argon不可再选(Terran race≠argon)
P6 (ref无上限): Terran×6  → 满足

结果: Argon×1 + Terran×8
vs 无参考优先级时: Argon×10
```

## 边界

### In Scope

- 规划模式下模组规划器中新增存档模块区（已建+在建混合，group 分组，ArchiveModuleList 风格）
- presenter 层自动模块显示相减
- 点击存档区模块添加及"低于默认 → 提升"逻辑
- 搜索框新模块默认数量 = 存档总量
- plannedModules 红色阈值警告
- `calculateAutoFillModules` 参考模块优先级（P1–P6，产能配额）
- 规划区与存档区分隔线
- 中/英文 locale 新增键

### Out of Scope

- 产量计算 max-merge 逻辑（wareflow 层面）
- live 模式的 `ArchiveModuleList` 行为变更
- station dashboard 的 `effectiveModules` 改动
- E2E 测试（由独立测试流程负责）

## 验收标准（DoD）

1. 规划模式下，存在存档数据时，存档模块区可见，以 ArchiveModuleList 风格（group 分组，已建在前、在建在后以虚线区分）展示，规划区与存档区之间有分隔线。
2. 自动模块区的显示数量 = max(0, auto_count - 存档总量)；扣除后为 0 的模块不显示。
3. 点击存档区的模块数字，将该模块以存档总量为 count 添加到 `plannedModules`；若已存在且 count < 存档总量，提升到存档总量。
4. 搜索框添加新模块时，默认 count = 存档总量；添加已存在的模块仍每次 +1。
5. `plannedModules` 中 count < 对应存档总量的模块，数字显示为红色。
6. autoFill 按 P1–P8 优先级选择模块，参考模块配额按产能计算，P1+P2 共享配额，P5/P6 无配额但优先于 P7/P8。
7. 无存档数据时，规划器行为与当前完全一致。
8. `npm run build` 通过。

## 未决项

无。
