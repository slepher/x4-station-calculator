# Import-Export Specification

## Purpose
定义模块化导入导出能力，确保各模块在导入时具备一致流程（迁移、覆盖/增量、`activeId` 决策、页面刷新），并保持 Empire 与其他模块的版本演进策略可扩展。

## ADDED Requirements

### Requirement: Import-Export UI Workflow
系统 MUST 通过 TabBar 上现有导入导出按钮承载导入导出流程。

#### Scenario: 导出按钮打开导出弹窗
- **前提**：用户位于可见 TabBar 的页面。
- **当**：用户点击导出按钮。
- **那么**：系统 MUST 打开导出弹窗。
- **并且**：系统 MUST 展示帝国/flow/ship 三模块条目统计。
- **并且**：系统 MUST 展示“取消 / 下载”底部操作按钮。

#### Scenario: 导出弹窗支持文件名编辑并下载
- **前提**：用户已打开导出弹窗。
- **当**：系统渲染导出表单。
- **那么**：系统 MUST 提供导出文件名输入框，并默认填入系统生成文件名。
- **并且**：下载按钮 MUST 以图标+文本形式展示（`[[下载图标] 下载]`）。
- **当**：用户点击下载按钮。
- **那么**：系统 MUST 按输入文件名导出 JSON 并触发浏览器下载。
- **并且**：若输入未包含 `.json` 后缀，系统 MUST 自动补全后缀。

#### Scenario: 导入按钮进入文件上传流程
- **前提**：用户位于可见 TabBar 的页面。
- **当**：用户点击导入按钮。
- **那么**：系统 MUST 展示文件上传界面并允许选择 JSON 文件。
- **并且**：文件上传完成后系统 MUST 展示导入配置步骤。

### Requirement: Import Configuration Panel After Upload
系统 MUST 在上传完成后向用户展示导入策略与模块选择配置。

#### Scenario: 展示覆盖/增量选项
- **前提**：用户已上传并通过校验的 JSON 文件。
- **当**：系统进入导入配置步骤。
- **那么**：系统 MUST 提供“是否覆盖”选项（覆盖/增量）。

#### Scenario: 展示模块统计与模块级多选
- **前提**：用户已上传并通过校验的 JSON 文件。
- **当**：系统进入导入配置步骤。
- **那么**：系统 MUST 列出 JSON 中包含的模块及每模块数据条数（帝国/flow/ship）。
- **并且**：系统 MUST 提供模块级多选以控制本次导入范围。

#### Scenario: 覆盖模式默认全选模块
- **前提**：用户已上传并通过校验的 JSON 文件。
- **并且**：用户当前选择“覆盖”模式。
- **当**：系统渲染模块选择区域。
- **那么**：系统 MUST 默认全选当前 JSON 中可导入的模块。

### Requirement: Module-Oriented Import Pipeline
系统 MUST 按模块执行导入，并对每个模块应用统一流程：`migrate -> import mode apply -> activeId decision -> context refresh`。

#### Scenario: 覆盖导入执行完整流水线
- **前提**：用户选择覆盖导入，导入包包含一个或多个模块数据。
- **当**：系统执行导入。
- **那么**：系统 MUST 先对每个模块执行 `migrate`，再清理对应当前模块数据并写入迁移后数据。
- **并且**：系统 MUST 按模块执行 `activeId` 更新与刷新判定。

#### Scenario: 增量导入执行完整流水线
- **前提**：用户选择增量导入，导入包包含一个或多个模块数据。
- **当**：系统执行导入。
- **那么**：系统 MUST 先对每个模块执行 `migrate`，再在当前模块数据上进行追加导入。
- **并且**：系统 MUST 对导入对象执行 ID 重生，避免与当前数据冲突。

### Requirement: Module Migration Strategy
系统 MUST 为每个导入模块提供 `migrate` 入口，且迁移策略可按模块独立演进。

#### Scenario: Empire 模块执行版本迁移
- **前提**：导入包含 `x4_empire_data` 且版本为 v1。
- **当**：系统执行 `migrateEmpireData`。
- **那么**：系统 MUST 输出符合 v2 结构的数据用于后续导入。

#### Scenario: 非 Empire 模块迁移占位
- **前提**：导入包含 `x4_logic_flow_plans` 或 `x4_ship_blueprints`。
- **当**：系统执行对应迁移函数。
- **那么**：系统 MUST 调用对应迁移入口并返回原数据（no-op）。
- **并且**：迁移入口 MUST 保持可扩展以支持未来版本演进。

### Requirement: ActiveId Decision Rules
系统 MUST 按导入模式与当前状态决定是否更新 `activeId`。

#### Scenario: 覆盖导入更新 activeId
- **前提**：模块导入模式为覆盖。
- **当**：模块数据写入完成。
- **那么**：系统 MUST 以导入结果中的 `activeId` 作为当前 `activeId`（在合法可定位前提下）。

#### Scenario: 增量导入在允许条件下更新 activeId
- **前提**：模块导入模式为增量。
- **并且**：当前 `activeId` 为空，或当前 `activeId` 对应对象为空且 `isDirty=false`。
- **当**：模块数据写入完成。
- **那么**：系统 MUST 更新 `activeId` 到导入结果映射后的目标对象。

#### Scenario: 增量导入在不满足条件时保持 activeId
- **前提**：模块导入模式为增量。
- **并且**：当前 `activeId` 非空，且当前对象非空或 `isDirty=true`。
- **当**：模块数据写入完成。
- **那么**：系统 MUST 保持当前 `activeId` 不变。

### Requirement: Empire Active Station Synchronization
当 Empire 模块 `activeId` 变更时，系统 MUST 同步处理 `activeStationId`。

#### Scenario: Empire activeId 更新联动 activeStationId
- **前提**：`x4_empire_data.activeId` 在导入后发生变化。
- **当**：系统完成 Empire 导入。
- **那么**：系统 MUST 同步更新 `activeStationId` 到导入结果对应值（或合法回退值）。

### Requirement: Context Refresh After Active Switch
模块导入导致 `activeId` 更新时，系统 MUST 刷新当前页面上下文。

#### Scenario: 生产页上下文刷新
- **前提**：当前页面为生产页，且 Empire 或 Station 上下文的 `activeId` 被更新。
- **当**：导入完成。
- **那么**：系统 MUST 触发当前生产页数据刷新，使页面内容与新 active 上下文一致。

#### Scenario: 逻辑组网页上下文刷新
- **前提**：当前页面为逻辑组网页，且 Logic Flow `activeId` 被更新。
- **当**：导入完成。
- **那么**：系统 MUST 触发逻辑组网页面内容刷新，使其切换到新 active 方案。

#### Scenario: Ship Build 页上下文刷新
- **前提**：当前页面为 Ship Build 页，且 Ship Blueprint `activeId` 被更新。
- **当**：导入完成。
- **那么**：系统 MUST 刷新配装页面上下文，显示新 active 蓝图内容。

### Requirement: Export Compatibility
系统 MUST 导出可回灌的模块化数据结构。

#### Scenario: 导出结果可作为导入输入
- **前提**：用户触发导出，系统生成导出数据。
- **当**：该导出数据被重新导入同版本系统。
- **那么**：系统 MUST 能识别模块与版本字段并按导入流程处理。
