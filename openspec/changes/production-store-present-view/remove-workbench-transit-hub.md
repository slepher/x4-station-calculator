# Remove Workbench Transit Hub

## 目标

这份文档专门约束一件事：

- 拆掉 `workbench transit hub` 这条独立 settings 语义链

这里说的不是只删一个函数名，而是彻底取消下面这套旧模型：

- transit 的 settings 是一套单独对象
- transit 的 settings 通过 `transitHubSettings` 暴露
- transit 的 settings 通过 `updateTransitHubSettings` 更新
- presenter / view 需要知道自己当前在操作 transit，所以要走另一套 settings 入口

本次要求是把这套模型完全收掉。

最终必须成立：

- `stationState.settings` 是当前实体唯一正式 settings 语义
- station / transit 都只通过统一 settings 读口暴露
- station / transit 都只通过统一 settings 写口更新
- presenter / view 不再感知 `transitHubSettings` / `updateTransitHubSettings`
- store 内部也不得再保留“假统一，真双轨”的桥接层

---

## 为什么必须拆

如果只把外部接口名改掉，但内部仍保留：

- station 读写 `station.settings`
- transit 读写 `group.settings`
- 然后再用一个 `currentWorkbenchSettings` 之类的 computed 做桥接

那么问题并没有解决，只是换了个更隐蔽的名字。

这种做法的问题是：

1. 它仍然保留了两套状态来源
   - station settings 来源于 station
   - transit settings 来源于 group
   - `currentWorkbenchSettings` 只是读口拼接，不是单一模型

2. 它会继续污染 action 设计
   - `updateSetting` 表面统一
   - 实际内部还要分支判断当前是 station 还是 transit
   - 结果是 action 统一了名字，没有统一模型

3. 它会继续让 presenter / view 的需求反噬 store
   - 一旦某个新字段只在 transit 下有用，就很容易再次长出 `updateTransitXxx`
   - 因为底层仍在暗示 transit 是另一类 settings 容器

4. 它会让后续 agent 判断失真
   - 代码表面上看是统一 settings
   - 实际上 store 内部依旧有 transit 特殊通道
   - 新人或 agent 很容易误以为“现在已经统一好了”

所以本次不是“减少旧接口暴露”，而是“取消 transit 独立 settings 链路”。

---

## 必须拆掉的对象与入口

以下内容都不允许继续作为正式模型存在：

### 1. store 对外入口

- `transitHubSettings`
- `updateTransitHubSettings`
- `updateTransitSetting`

要求：

- 不得从 store return 中导出
- 不得从 contract 中声明
- 不得从 presenter interface 中声明
- 不得从 view 中直接调用

### 2. store 内部桥接读口

- `currentWorkbenchSettings`
- 任何同义命名的“station/transit settings 二选一” computed

要求：

- 不得作为最终结构保留
- 如果短暂存在于重构中的半成品提交，不能视为完成状态

### 3. transit 专属 action 命名

- `updateTransit...`
- `setTransit...`
- `patchTransit...`

要求：

- 新增 settings 行为必须进入 `updateSetting(key, value)` 或 `updateSettings(patch)`
- 不允许再加 transit 专属 settings action

---

## 拆掉后的正式模型

拆掉后，settings 模型只允许是下面这套：

### 1. 读模型

当前 workbench 展示给 presenter 的 settings 只能来自：

```ts
store.stationState?.settings
```

约束：

- `stationState` 为 `station` 时，`stationState.settings` 表达当前 station settings
- `stationState` 为 `transit` 时，`stationState.settings` 也必须表达当前 transit 实体 settings
- presenter / view 不得再读取任何独立 transit settings 源

### 2. 写模型

当前 workbench 对 settings 的修改只能通过：

```ts
store.updateSetting(key, value)
store.updateSettings(patch)
```

约束：

- presenter / view 不得分支调用 transit 专属入口
- store 可以在内部把 patch 提交到最终持久化位置
- 但这种内部提交差异不得再暴露为第二套外部 action

### 3. 持久化差异

允许存在的唯一差异是：

- station settings 最终落到 station plan
- transit settings 最终落到 binding group

但这是“持久化落点差异”，不是“领域对象差异”。

必须明确：

- 读模型统一
- 写模型统一
- 只有提交层可以区分最终写到哪里

---

## 拆掉之后一定会出现的问题

下面这些问题不是“可能”，而是拆掉之后必然会遇到。

必须提前写清楚怎么处理，不允许靠实现时临场发挥。

---

## 问题 1：transit 的 settings 物理上不在 station plan 上

### 现状

当前 live 模式下：

- station settings 存在 `station.settings`
- transit settings 存在 `binding.groups[i].settings`

也就是说 transit 没有天然的 `station.settings` 宿主。

### 如果直接删掉 transit 独立入口，会发生什么

如果只是删掉：

- `transitHubSettings`
- `updateTransitHubSettings`

而不补统一模型，那么：

- transit toolbar 无法拿到 settings
- wareflow 面板无法读 buffer/multiplier/racePreference
- transit 模式下修改 settings 会失效

### 处理方式

必须新增“当前 transit 实体的领域快照”，但不是新增 `transitState`。

正确做法是：

1. 在构造 `stationState` 时，transit 分支直接产出完整的 `settings`
2. 这个 `settings` 来自 `group.settings`，但必须在 `stationState` 构造时完成归一化
3. 从 `stationState` 产出后，外层只认 `stationState.settings`

也就是说：

- 允许在 `stationState` 组装阶段读取 `group.settings`
- 不允许在 presenter / view / 通用 getter 层再读 `group.settings`

边界必须卡死：

- `group.settings` 只能是底层原始数据源
- `stationState.settings` 才是正式领域对象

---

## 问题 2：transit 修改 settings 时，最终还是要写回 group.settings

### 现状

transit 模式下的设置修改，最终要调用：

- `saveBindingStore.updateGroup(...)`

而不是：

- `updateBindingStationPlan(...)`

### 如果直接复用 station 写法，会发生什么

如果把 transit 也当普通 station 写：

- patch 会写错对象
- transit 的改动不会落盘到正确位置
- sector 聚合也可能不刷新

### 处理方式

必须把差异压缩到“提交层”，而不是暴露到 action 层。

推荐结构：

```ts
function updateSettings(patch: Partial<StationSettings>) {
  const entity = getCurrentEntity()
  const nextSettings = mergeSettings(entity.settings, patch)
  commitSettingsPatch(entity, nextSettings)
}
```

其中：

- `entity.settings` 来自统一实体快照
- `commitSettingsPatch` 内部再判断当前实体的持久化落点

要求：

- presenter 调用方永远不知道自己最终写的是 station plan 还是 binding group
- `updateSetting/updateSettings` 是唯一写入口
- 分支判断只能出现在底层提交函数里

注意：

这里允许“提交函数内部分支”，但不允许“读取模型分支 + 对外 action 分支 + presenter 分支”同时存在。

---

## 问题 3：transit 修改 settings 后，不只是写入，还要触发 sector 级同步

### 现状

当前 transit settings 改动后，live store 还要做：

- `syncPlanningSectorAggregations()`
- `syncLiveSectorAggregations()`

这和 station 的：

- `stationProductionFlowMap.compute(...)`
- `syncAfterStationFlowChange(...)`

不是同一条后处理链。

### 如果只统一 action 名字，不处理副作用差异，会发生什么

结果会有两种坏情况：

1. transit 改完 settings，但 sector 聚合没刷新
2. transit 被错误套用 station 的重算链，产生无效或错误同步

### 处理方式

必须把“settings 提交后副作用”按实体类型封装到提交层。

推荐约束：

```ts
function commitSettingsPatch(entity, nextSettings) {
  if (entity.entityType === 'station') {
    // 写 station settings
    // recompute station flow
    // sync station-related side effects
    return
  }

  if (entity.entityType === 'transit') {
    // 写 group settings
    // sync planning sector aggregations
    // sync live sector aggregations
    return
  }
}
```

关键点：

- 差异留在底层提交实现
- 不允许反向泄漏到 presenter / view
- 不允许重新长出 `updateTransitHubSettings`

---

## 问题 4：toolbar / wareflow / dashboard 之前分别从不同来源取 settings

### 现状

旧代码里常见这种情况：

- toolbar 读 `transitHubSettings`
- wareflow 读 `getWareflowSettings()`
- dashboard 读 station settings

这会导致同一个字段在不同 panel 上取值来源不同。

### 如果只改一个面板，会发生什么

会出现：

- toolbar 显示的是 transit settings
- wareflow 还在读 station settings
- 同一页不同控件显示不同值

### 处理方式

拆掉后必须统一为：

1. `stationState.settings` 作为原始统一来源
2. presenter 从 `stationState.settings` 派生各面板 props
3. `getToolbarSettings` / `getWareflowSettings` / `getDashboardSettings` 如果继续保留，只能转读同一份 `stationState.settings`

要求：

- 一个字段在所有 panel 中必须来自同一份 settings
- 不允许 toolbar 和 wareflow 各读一套数据源

---

## 问题 5：`updateSetting` 当前只对 station 成立，transit 只是被外面分流

### 现状

现在最常见的假统一写法是：

- station 下调用 `updateXxx`
- transit 下先 `if (workbenchMode === 'transit')` 再调用独立 transit 更新函数

这不是统一 action，只是统一命名。

### 如果不收这层，会发生什么

后续新增任意 settings 字段时，代码会重新变成：

- presenter 分支一次
- store 分支一次
- helper 分支一次

最后还是回到双轨。

### 处理方式

必须建立统一的当前实体解析函数，例如：

```ts
type CurrentSettingsEntity =
  | { entityType: 'station'; id: string; settings: StationSettings }
  | { entityType: 'transit'; id: string; settings: StationSettings }

function getCurrentSettingsEntity(): CurrentSettingsEntity | null
```

然后所有 settings 修改都走：

```ts
const entity = getCurrentSettingsEntity()
if (!entity) return
const next = mergeSettings(entity.settings, patch)
commitSettingsPatch(entity, next)
```

这样：

- `updateSetting`
- `updateSettings`
- `updateRacePreference`
- `updateResourceBufferHours`

都只是统一 patch 写法的薄包装。

---

## 问题 6：旧兼容代码会继续误导后续实现

### 现状

即使外部不再用，如果 store 内部还保留这些名字：

- `transitHubSettings`
- `updateTransitHubSettings`
- `currentWorkbenchSettings`

后续实现者仍然会沿着旧思路继续写。

### 处理方式

必须直接改名或删除，不允许保留误导性命名。

推荐替换方式：

- 删掉 `transitHubSettings`
- 不新增 `currentWorkbenchSettings`
- 改为显式的统一实体函数：
  - `getCurrentSettingsEntity()`
  - `commitSettingsPatch(entity, nextSettings)`

命名原则：

- 名字必须表达“统一实体 settings”
- 名字不得表达“transit 还单独有一个 hub settings 对象”

---

## 推荐最终实现结构

### 1. 当前实体解析

```ts
type CurrentSettingsEntity =
  | {
      entityType: 'station'
      id: string
      settings: StationSettings
      station: StationPlan
    }
  | {
      entityType: 'transit'
      id: string
      settings: StationSettings
      groupId: string
    }

function getCurrentSettingsEntity(): CurrentSettingsEntity | null
```

职责：

- 解析当前 workbench 对应的 settings 实体
- 在这里完成 transit `group.settings -> StationSettings` 的归一化
- 外层只拿统一实体，不拿底层 group/station 原始对象

### 2. 统一提交

```ts
function commitSettingsPatch(
  entity: CurrentSettingsEntity,
  nextSettings: StationSettings
): void
```

职责：

- station：写回 station plan，并执行 station 重算/同步
- transit：写回 binding group，并执行 sector 聚合同步

### 3. 统一 action

```ts
function updateSettings(patch: Partial<StationSettings>) {
  const entity = getCurrentSettingsEntity()
  if (!entity) return
  const nextSettings = mergeSettings(entity.settings, patch)
  commitSettingsPatch(entity, nextSettings)
}

function updateSetting<K extends keyof StationSettings>(
  key: K,
  value: StationSettings[K]
) {
  return updateSettings({ [key]: value })
}
```

### 4. 统一读取

```ts
const stationState = computed(() => {
  const entity = getCurrentSettingsEntity()
  // ...
  return {
    // ...
    settings: entity.settings
  }
})
```

要求：

- `stationState.settings` 必须直接来自统一实体解析结果
- 不允许再引入二次桥接 computed

---

## 静态约束

为避免后续回退，必须加入静态告警/门禁。

至少要拦截以下调用或命名：

- `updateTransitHubSettings(`
- `updateTransitSetting(`
- `transitHubSettings`
- `currentWorkbenchSettings`

其中：

- presenter / view 中出现任何一个，必须直接失败
- store 中如果仍出现 `transitHubSettings` / `currentWorkbenchSettings`，说明内部模型还没统一完成，也不得视为完成状态

---

## 实施顺序

### Step 1. 先补统一实体解析

目标：

- 引入 `getCurrentSettingsEntity()`
- 在其中完成 transit settings 归一化

完成标准：

- store 内部可以不再依赖 `transitHubSettings` 作为正式读口

### Step 2. 再补统一提交函数

目标：

- 引入 `commitSettingsPatch(entity, nextSettings)`
- 将 station / transit 的写回差异压缩到这里

完成标准：

- store 内 settings 写路径只剩 `updateSetting/updateSettings`

### Step 3. 最后删旧桥接变量与旧命名

目标：

- 删除 `transitHubSettings`
- 删除 `updateTransitHubSettings`
- 删除 `currentWorkbenchSettings`

完成标准：

- 代码中不再出现“transit 另有一套 settings 模型”的命名

---

## 完成判定

只有同时满足下面几条，才算真正拆掉：

1. presenter / view 不再引用 transit 专属 settings 入口
2. contract 中不再声明 transit 专属 settings 入口
3. store 对外只保留 `updateSetting/updateSettings` 与统一 `updateXxx`
4. `stationState.settings` 成为当前实体唯一正式 settings 语义
5. store 内部不再保留 `transitHubSettings` / `currentWorkbenchSettings` 这类桥接命名
6. transit 改 settings 后，sector 聚合同步仍然正确
7. station 改 settings 后，station 重算链仍然正确

只做到前 3 条，不算完成。那只是把旧模型藏起来了，没有真的拆掉。
