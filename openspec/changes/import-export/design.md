## Context

当前存储数据由多个模块组成（Empire、Logic Flow、Ship Blueprints），但导入导出流程尚未形成统一的“模块级流水线”。
本次设计目标是建立可扩展的模块导入框架，使迁移、导入模式、`activeId` 规则和页面刷新能够按模块独立演进。

## Decisions

1. 采用“模块驱动”的导入编排器：逐模块执行 `migrate -> applyImportMode -> resolveActive -> refreshContext`。
2. 迁移层采用模块注册表：
   - Empire 提供真实迁移函数（兼容 v1->v2）。
   - Logic Flow / Ship Build 先提供 no-op 迁移入口。
3. 增量导入统一执行 ID 重生，不尝试复用导入包中的原始 ID。
4. `activeId` 决策从导入写入逻辑中抽离为独立策略函数，便于测试和跨模块复用。
5. 页面刷新与导入解耦：仅在 `activeId` 实际变化后触发，并按当前视图类型分发刷新。
6. Empire 的 `activeStationId` 作为 `activeId` 联动字段，在 Empire 激活目标变更时同步更新。
7. 导入导出入口复用 TabBar 现有按钮；导出点击先进入导出弹窗，导入先上传文件再进入配置。
8. 导出弹窗需与导入弹窗保持同级 UI：模块统计列表、底部操作区、统一遮罩与容器样式。
9. 导出弹窗提供可编辑文件名输入框，默认值为系统生成名称；下载时自动补 `.json` 后缀。
10. 下载主按钮采用图标+文本样式（`[[下载图标] 下载]`）以统一操作语义。
11. 上传后配置面板必须包含覆盖/增量切换、模块统计和模块级多选；覆盖模式默认全选模块。

## Import Architecture

### 0) UI 交互流水线

1. 用户点击 TabBar 导出按钮：
   - 打开导出弹窗并展示模块统计。
   - 预填默认导出文件名，允许用户编辑。
   - 用户点击下载后调用导出序列化器并触发 JSON 下载。
2. 用户点击 TabBar 导入按钮：
   - 打开上传界面并选择 JSON 文件。
   - 完成格式校验后进入导入配置面板。
3. 导入配置面板：
   - 选择覆盖/增量模式。
   - 展示 3 个模块的条目统计（帝国/flow/ship）。
   - 模块级多选控制本次导入模块集合。
   - 覆盖模式进入面板时默认全选可导入模块。
4. 用户确认后执行模块导入编排器。

### 1) 模块注册表

定义 `ImportModuleRegistry`，每个模块声明：
- `key`
- `migrate(input)`
- `clearCurrent()`
- `mergeIncremental(input)`
- `resolveActiveUpdate(mode, context)`
- `applyActive(activeResult)`
- `refreshIfNeeded(activeChanged, viewContext)`

### 2) 导入执行器

导入执行器输入：
- 已通过格式校验的导入数据
- 用户导入模式（覆盖/增量）
- 用户勾选的模块集合
- 当前页面上下文（production / flow / ship-build）

执行步骤：
1. 遍历导入包内模块。
2. 调用模块 `migrate`。
3. 覆盖模式执行 `clearCurrent + write`；增量模式执行 `reId + merge`。
4. 执行 `activeId` 决策。
5. 应用激活结果并记录 `activeChanged`。
6. 根据页面上下文调用模块刷新器。

### 3) ID 重生策略（增量）

- 统一使用新 UUID 生成器。
- 对引用关系做映射回填：
  - empire: `empire.id`、`station.id`、`activeId`、`activeStationId`
  - logic flow: `plan.id`、`group.id`、`node.id`、`activeId`
  - ship blueprints: `blueprint.id`、`activeId`
- 不允许增量模式下发生原 ID 覆盖。

### 4) Active 决策策略

#### 覆盖模式
- 直接采用导入结果内 `activeId`（若无效则回退到首个可用对象或 `null`）。

#### 增量模式
- 仅当以下条件之一成立时可更新 active：
  - 当前 `activeId` 为空；
  - 当前 `activeId` 指向对象为空，且 `isDirty=false`。
- 若不满足则保持当前 active。

### 5) 页面刷新分发

- `production`：刷新 Empire/Station 当前上下文。
- `flow`：刷新 Logic Flow 当前方案上下文。
- `ship-build`：刷新 Ship Blueprint 当前方案上下文。
- 非当前页面模块不强制切换页面，仅保持 store 一致。

## Error Handling

1. 模块迁移失败：记录该模块错误并跳过写入，其他模块继续。
2. 模块写入失败：回滚该模块本次写入（最小回滚单元为模块）。
3. active 无法定位：回退到模块首个有效对象或 `null`，并记录 warning。
4. 刷新失败：不影响导入持久化结果，但记录 warning 供 UI 提示。

## Risks

1. 增量导入 ID 重生若引用回填不完整，会产生悬挂引用。
2. 不同页面下刷新行为若复用旧入口，可能出现局部状态未同步。
3. Empire v1->v2 迁移与现有初始化迁移路径并行时，需避免重复迁移。

## Non-Goals

1. 不在本次引入跨端同步与远程数据源。
2. 不改动既有业务算法（流量、建造、配装计算）。
3. 不扩展除 Empire 以外的历史版本迁移规则。
