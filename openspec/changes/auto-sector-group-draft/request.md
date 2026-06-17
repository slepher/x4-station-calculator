# Binding 模式共享草案 (auto-sector-group-draft)

## 目标

将 binding 模式的 group 方案数据搬入 `liveStore`，使 live 面板和 map 面板共享同一份编辑状态，切换不丢进度。同时草案数据不直接修改 `draftBinding`，退出 binding 不回滚已确认内容。

本变更只维护一份全局唯一的 binding draft。系统不需要、也不支持同时维护多个 binding 的并行草案；`liveStore` 中的共享状态始终表示“当前正在编辑的 binding 草案”。

## 已确认方案（审核重点）

### 1. 当前问题

- `useAutoSectorGroupPresenter()` 每次调用创建独立实例，live 面板和 map 面板各有独立状态
- `handleColorChange` 调用 `saveBindingStore.updateGroup()` 直接修改 `draftBinding`，选色立即持久化
- live 改一半切到 map 面板，进度丢失

### 2. 最小搬迁清单

以下 6 个状态从 presenter 搬入 `useLiveProductionStore`（Pinia 单例），两个面板共享：

| 状态 | 类型 | 说明 |
|------|------|------|
| `autoGroupResult` | `ShallowRef<AutoGroupResult \| null>` | groups（含 selectedTradeStation、color）+ assignments + bridgePlans |
| `calculationMode` | `Ref<'edit' \| 'result'>` | 编辑/结果模式 |
| `prefJumpRange` | `Ref<number>` | 覆盖 hop 数 |
| `bridgeSearchJumpRange` | `Ref<number>` | bridge 搜索 hop 数 |
| `prefThreshold` | `Ref<number>` | hub 阈值 |

`autoGroupResult` 可以为非 null 且未确认（编辑中草案），也可以为非 null 且已确认（已提交结果）。确定栏始终显示，不因确认状态隐藏。

### 3. 存档时间比对与变化 flag

`SaveBindingPlan` 新增 `appliedAutoGroupArchiveTime`，与 `needsAutoGroupRecalc` 构成变化 flag：

| 字段 | 类型 | 说明 |
|------|------|------|
| `appliedAutoGroupArchiveTime` | `number \| undefined` | 最近一次已应用 auto group 的 `archive.meta.time` |

**变化 flag**：
```
needsAutoGroupRecalc := appliedAutoGroupArchiveTime === undefined
                     || appliedAutoGroupArchiveTime < archiveTime
```

Store 初始化（或 activeBinding/archive 切换）时调用 `initAutoGroupDraft()`，根据变化 flag 分两条路径：

- **有变化 flag** → 运行分组算法（`groupCleanSlate` / `groupIncremental`）生成 `autoGroupResult`
- **没有变化 flag** → 从已有 binding 的 groups 为每个覆盖星区计算所有候选目标，构建 assignments（不跑分组算法）

Live 面板和 Map 面板均为纯 view 层，直接读取 store 中已生成的数据。「详情」按钮仅切换显示模式，不执行计算。

`handleConfirm()` 记录 `appliedAutoGroupArchiveTime`，不覆盖 `autoGroupResult`。

**不搬的（留在 presenter 本地）：**

- `tradeStationCandidates` — computed，每次切换 tab 从 archive + groups 重算
- `editSnapshot`、`calcBaselinePillState` — 与当前面板 UI 绑定
- `bridgeRetainEnabled` 等保留开关 — 局部 UI 状态
- `hasGlobalUnresolved`、`hasUncertainAssignments` 等 — computed，本地重算

### 4. Presenter 改造

Presenter 退化为纯 view 连接层：只从 `liveStore` 读取 refs 暴露给组件，不包含双路径决策或数据生成逻辑。Handler 函数 delegates 到 store 或 `saveBindingStore`。

```ts
export function useAutoSectorGroupPresenter() {
  const liveStore = useLiveProductionStore()
  const { autoGroupResult, calculationMode, ... } = storeToRefs(liveStore)
  // computed / handler 不变但 delegate 到 store
}
```

### 5. 地图草案渲染

`MapWorkbenchView` 的 `sectorGroupColorMap` 计算：

```ts
const sectorGroupColorMap = computed(() => {
  const isBinding = bindingContextStage.value === 'select-sector'
                 || bindingContextStage.value === 'select-station'
  if (isBinding && liveStore.autoGroupResult) {
    return buildColorMap(liveStore.autoGroupResult.groups)
  }
  const binding = saveBindingStore.activeBinding
  if (!binding) return {}
  return buildColorMap(binding.groups)
})
```

非 binding 模式下始终使用 `saveBindingStore.activeBinding` 的持久数据。

### 6. 生命周期

Store 在初始化及 activeBinding/archive 切换时调用 `initAutoGroupDraft()` 生成数据。Live 和 Map 面板不负责触发计算。

### 7. Live 面板模式切换

Live 面板（`SectorOverviewPanel`）两种显示模式（仅切换 UI 布局，store 数据已就绪）：

| 模式 | 布局 | 按钮 |
|------|------|------|
| 展示模式 | `[存档 3fr] \| [星区 4fr] \| [资源 5fr]` | 详情、地图 |
| 计算模式 | `[星区 5fr] \| [分配 4fr] \| [交易站 3fr]` | 返回、提交 |

**展示模式内容**（数据直接从 store 读取，只读展示）：

星区列表列顶部参数区（纯数值显示，不可编辑）：
- 桥接搜索跳数（`bridgeSearchJumpRange`）
- 分组覆盖跳数（`prefJumpRange`）
- Hub 阈值（`prefThreshold`，如 5M m³）

- 展示模式「详情」→ `liveMode = 'calculate'`（仅模式切换）
- 展示模式「地图」→ 跳转到 map binding 面板对应的星区/group 视图
- 计算模式「提交」→ 写 binding + 回到展示模式
- 计算模式「返回」→ 回到展示模式（不提交）
- 详情按钮红点：`needsAutoGroupRecalc`
- 详情按钮置灰：`!autoGroupResult`

计算模式内部列按钮（取消/计算等）保留不变。

| 时机 | 行为 |
|------|------|
| 进入 binding 模式 | presenter 读取 liveStore ref，恢复上次编辑状态 |
| binding 中编辑 | 两个面板读写同一份 liveStore ref |
| 切换 activeBinding 或 archive | 用新 binding/archive 重新初始化唯一草案；旧草案不按 gameGuid 缓存 |
| 确认提交 | `handleConfirm` → `createAutoGroups` → 写入 `draftBinding` → `saveBinding` |
| 展示模式「地图」 | 跳转到 map binding 面板 |
| 退出 binding | 不做回滚（已确认的内容在 draftBinding 中保存） |

## 边界

In Scope：
- `liveStore` 新增状态：`autoGroupResult`、`calculationMode`、`prefJumpRange`、`bridgeSearchJumpRange`、`prefThreshold`、`needsAutoGroupRecalc`、`initAutoGroupDraft()`、`buildAssignmentsFromBinding()`
- `SaveBindingPlan` 新增并持久化 `appliedAutoGroupArchiveTime`
- Store 初始化时根据变化 flag 自动生成 `autoGroupResult`（双路径）
- Presenter 退化为纯 view 连接层
- `MapWorkbenchView` 从 liveStore 读取渲染地图
- `handleColorChange` 移除 `updateGroup` 调用
- live 面板和 map 面板共享编辑状态

Out of Scope：
- 全部 presenter 内容搬迁
- `tradeStationCandidates` 搬迁
- UI 保留开关搬迁
- 修改 E2E 测试
- 多 binding 并行 draft 缓存

## 验收标准（DoD）

1. live 面板编辑 groups → 切到 map 面板 → 继续编辑 → 切回 live 面板，数据一致
2. binding 模式时修改 group 颜色，地图从 `autoGroupResult` 实时反映
3. `handleColorChange` 不再修改 `draftBinding`
4. binding 模式确认后地图从 `autoGroupResult` 渲染（与 `activeBinding` 数据一致）
5. 切换 activeBinding 或 archive 后，唯一草案按新上下文重新初始化，不显示上一上下文的未提交草案
6. Store 初始化/上下文切换时自动根据变化 flag 生成数据（有 flag → 分组算法，无 flag → 从 binding 构建 assignments）
7. `needsAutoGroupRecalc = applied === undefined || applied < archiveTime`
8. Live 面板「详情」仅切换模式不触发计算；红点/置灰状态正确
9. 确认提交后数据持久化，reload 不丢失
10. `npm run build` 通过

## 未决项

无
