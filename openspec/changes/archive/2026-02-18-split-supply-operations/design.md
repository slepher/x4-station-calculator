## Context

当前 `analyzeWareFlow.ts` 中的分组逻辑将所有 `netRate <= 0` 且 `transportType === 'container'` 的物资归入 `operations` 分组。这导致工人消耗物资（如 foodrations、medicalsupplies）和工业生产消耗物资（如 hullparts、weaponcomponents）无法区分。

工人消耗通过 `calculateWorkforceCensus` 函数计算，直接累加到 `consumption` 字段中，没有单独记录。

## Goals / Non-Goals

**Goals:**
- 在数据层面区分工人消耗和工业消耗
- 新增 `supply` 分组显示工人补给缺口
- 保持向后兼容，现有功能不受影响

**Non-Goals:**
- 不修改工人消耗的计算逻辑
- 不修改 `contributions` 结构（保持现有明细数据）
- 不影响体积视图的分组逻辑

## Decisions

### Decision 1: 在 WareFlow 接口新增 workforceConsumption 字段

**选择**: 在 `WareFlow` 接口中新增 `workforceConsumption` 字段，单独记录工人消耗量。

**理由**:
- 语义清晰，直接表达"工人消耗"概念
- 分组时无需遍历 `contributions`，性能更好
- 未来可扩展其他消耗类型（如建筑维护消耗）

**备选方案**: 在 `ModuleFlowAtom` 中添加 `source` 字段标记消耗来源
- 放弃原因：分组时需要遍历 `contributions`，性能略差

### Decision 2: 分组逻辑调整

**选择**: 新增判断条件，有工人消耗且净产出为负的物资归入 `supply` 分组。

**分组规则**:
| 分组 | 条件 |
|------|------|
| `positive` | `netRate > 0` |
| `operations` | `netRate <= 0 && transportType === 'container' && workforceConsumption === 0` |
| `supply` | `netRate <= 0 && workforceConsumption > 0` |
| `resources` | `netRate <= 0 && transportType !== 'container' && workforceConsumption === 0` |

**注意**: 如果一个物资同时有工人消耗和工业消耗，且净产出为负，则归入 `supply` 分组。

### Decision 3: UI 分组顺序

**选择**: 产品 → 运营 → 补给 → 资源

**理由**: 运营和补给都是 container 类物资，放在一起更符合逻辑分组。

## Risks / Trade-offs

**风险 1**: 一个物资同时有工人消耗和工业消耗时的归属问题
- **缓解**: 归入 `supply` 分组，因为工人消耗是该物资存在的必要条件

**风险 2**: 现有代码依赖 `rateGroups` 的结构
- **缓解**: 新增 `supply` 字段而非修改现有字段，保持向后兼容
