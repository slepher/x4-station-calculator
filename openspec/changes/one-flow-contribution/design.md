# One Flow Contribution - Design

## 架构变更

### 1. 贡献类型统一

当前有三种贡献类型，分散在两个模块中：

```
src/types/production-flow.ts:
  BaseModuleFlowAtom  → moduleId, count, type, amount, bonusPercent

src/types/x4.ts:
  ModuleFlowAtom      → moduleId, count, type, amount, bonusPercent, volumeFlow, valueFlow, transportFlow
  StationFlowAtom     → stationId, stationName, stationCount, production, consumption, workforceConsumption, netRate
```

统一后合并为单一类型，方向由 `type` 承担、数值由 `amount` 承担：

```
src/types/production-flow.ts:
  FlowContribution    → id, class, type, count, amount, bonusPercent
```

### 2. 数据流变化

#### 生成侧（Store 层一阶段）

`calculateProductionFlows` 中生成 contribution 时：
- 模块贡献：`class='module'`，`type` 为 `'production'`/`'consumption'`
- workforce 贡献：`class='workforce'`，`type='consumption'`，`amount` 为负的实际消耗值

```
// 药品的 contributions 示例
[
  { id: 'module_hospital', class: 'module', type: 'consumption', count: 2, amount: -200, bonusPercent: 0 },
  { id: 'argon', class: 'workforce', type: 'consumption', count: 1500, amount: -24.0 }
]
```

#### 消费侧（filter/group）

所有 `flow.workforceConsumption > 0` 的判定改为 `flow.contributions.some(c => c.class === 'workforce')`。

`workforceConsumption` 字段消除后，该条件仅用于分类。

### 3. 类型文件调整

- `src/types/production-flow.ts`：新增 `FlowContribution`，删除 `BaseModuleFlowAtom`，更新 `WareProductionFlow.contributions` 类型
- `src/types/x4.ts`：删除 `ModuleFlowAtom`、`StationFlowAtom`，更新 `WareFlow.contributions`、`EmpireWareFlow.contributions` 类型，删除 `workforceConsumption`

### 4. 涉及修改的文件

| 文件 | 变更 |
|---|---|
| `src/types/production-flow.ts` | 新增 `FlowContribution`，删除 `BaseModuleFlowAtom`，更新 `WareProductionFlow` |
| `src/types/x4.ts` | 删除 `ModuleFlowAtom`、`StationFlowAtom`，更新 `WareFlow`、`EmpireWareFlow`、`GroupedFlows`、`SectorInternalData` 等关联类型 |
| `src/store/logic/calculateProductionFlows.ts` | workforce contribution 生成方式改为工数量 + `class='workforce'` |
| `src/store/logic/calculateWareFlowDerived.ts` | contribution 类型更新，volumeFlow/valueFlow/transportFlow 附加到 `FlowContribution` |
| `src/store/logic/analyzeWareFlow.ts` | `workforceConsumption` 相关判定迁移 |
| `src/store/logic/analyzeEmpireWareFlow.ts` | `workforceConsumption` 相关判定迁移，contribution 类型更新 |
| `src/store/state/StationDerivedMap.ts` | `filterProductionFlowsByPriority` 等函数中 `workforceConsumption` 引用更新 |
| `src/store/logic/empireFlowFacade.ts` | `workforceConsumption` 引用更新 |
| 其他消费 `workforceConsumption` 或旧 contribution 类型的文件 | 统一替换 |

### 5. stationContributions 双路径消除

`WareProductionFlow` 原有两个贡献路径：
- `contributions`：模块级贡献（`class='module'` + `class='workforce'`）
- `stationContributions`：站级聚合贡献（原 `StationFlowAtom`）

统一后 `stationContributions` 字段删除，站级贡献直接写入 `contributions`（`class='station'`）。

影响链路：
- `getSectorFinalProductionFlows`：写入 `contributions` 代替 `stationContributions`
- `deriveProductionFlows`：移除 `stationContributions` → `DerivedStationFlowAtom` 转换逻辑，所有贡献统一从 `contributions` 读取
- `TransitHubCenterDashboard`：读取 `contributions` 代替 `stationContributions`
- `DerivedStationFlowAtom` 保留为展示层类型（transit-hub 需要 `stationName`/`netValue`/`storageVolume` 等派生字段）

### 6. 向后兼容

- 本 change 仅更换类型定义和生成/消费方式，不修改业务逻辑语义
- 不修改持久化 schema（贡献类型仅用于运行时计算，不直接落库）
- 无版本迁移需求
