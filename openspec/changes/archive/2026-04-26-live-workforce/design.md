# Live Workforce Integration - Design

## Architecture Overview

本功能在现有 production flow 计算架构中新增一个 override 分支，允许直接传入存档解析所得的实际 workforce 数据，绕过居住舱容量计算逻辑。

```
┌─────────────────────────────────────────────────────────────────┐
│                     useLiveProductionStore                       │
│  syncLiveFlowMapForStation()                                    │
│    ↓ 解析 PlayerStationEntry.workforces                         │
│    ↓ 计算 actualWorkforceOverride                               │
│    ↓                                                            │
│  ProductionFlowInput { workforceOverride, ... }                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                StationProductionFlowMap                          │
│  compute(input, deps)                                           │
│    ↓ 传递 override 到 calculateProductionFlowsCore              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│           calculateProductionFlowsInternal                       │
│                                                                 │
│  if (workforceOverride) {                                       │
│    // 新分支：直接使用种族分布计算医疗消耗                       │
│    workforceOverride.forEach(entry => {                         │
│      const consumption = medicalConsumptionMap[entry.race]      │
│      // 添加 workforceConsumption + contribution                │
│    })                                                           │
│    saturation = saturationOverride                              │
│  } else {                                                       │
│    // 原分支：calculateWorkforceCensus → 居住舱分配             │
│    censusItems = calculateWorkforceCensus(...)                  │
│    // ...                                                       │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   ProductionFlowCache                            │
│  { actualWorkforce, saturation, productionFlows }               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              useProductionDashboardPresenter                     │
│                                                                 │
│  settings.workforceAuto = visualMode === 'live' ? true : s.auto │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     StationDashboard                             │
│                                                                 │
│  <input checkbox                                                │
│    :checked="forceWorkforceAuto || settings.workforceAuto"      │
│    :disabled="forceWorkforceAuto"                               │
│  />                                                             │
└─────────────────────────────────────────────────────────────────┘
```

## Key Decisions

### Decision 1: Override 作为可选参数而非新 Store

**选择**: 在现有 `ProductionFlowInput` interface 中新增可选字段

**原因**:
- 避免引入新的数据流路径
- 保持 backward compatibility（无 override 时行为不变）
- 与已有的 `actualWorkforceOverride` / `saturationOverride` 模式一致

**Trade-offs**:
- ✓ 代码改动最小
- ✓ 不破坏现有 planning 模式
- − 需要在多层级传递参数（Store → FlowMap → Calculator）

### Decision 2: 使用 `workforce:${race}` 作为 Contribution moduleId

**选择**: 采用 `workforce:argon` 格式而非单一 `workforce`

**原因**:
- 可追溯每个种族的人口数量
- 未来可扩展显示种族分布统计
- 与现有 contribution 结构兼容

### Decision 3: Presenter 层强制 workforceAuto

**选择**: 在 Presenter computed 中强制设置，而非修改 Store settings

**原因**:
- 不污染持久化数据（settings 不应因 display mode 改变）
- Presenter 负责 UI 展示逻辑，符合分层原则
- 切换回 planning 时自动恢复原值

### Decision 4: Checkbox 禁用而非隐藏

**选择**: 显示 checkbox 但禁用交互

**原因**:
- 保持 UI layout 一致
- 用户仍可看到当前状态为 auto
- 比 hidden/disabled 组合更清晰

## Implementation Notes

### 边界情况处理

1. **workforces 为空**: fallback 到 census 计算
2. **race 未知**: 使用 `default` medicalConsumptionMap
3. **actualWorkforce 超过 capacity**: saturation 限制为 1.0
4. **planning 模式**: 完全忽略 override，保持原有逻辑

### 测试重点

- Unit: `calculateProductionFlowsInternal` 的两个分支
- E2E: live 模式 Dashboard 显示 checkbox disabled checked
- Integration: 从 save archive → flowMap → presenter → UI 的完整路径