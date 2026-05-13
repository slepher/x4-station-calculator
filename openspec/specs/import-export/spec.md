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
## Requirements
### Requirement: Import-Export UI Workflow
系统 MUST 通过 TabBar 上现有导入导出按钮承载导入导出流程，并支持四个模块。

#### Scenario: 导出按钮打开导出弹窗
- **前提**：用户位于可见 TabBar 的页面。
- **当**：用户点击导出按钮。
- **那么**：系统 MUST 打开导出弹窗。
- **并且**：系统 MUST 展示帝国/flow/ship/save 四模块条目统计。
- **并且**：系统 MUST 展示"取消 / 下载"底部操作按钮。

#### Scenario: 展示模块统计与模块级多选
- **前提**：用户已上传并通过校验的 JSON 文件。
- **当**：系统进入导入配置步骤。
- **那么**：系统 MUST 列出 JSON 中包含的模块及每模块数据条数（帝国/flow/ship/save）。
- **并且**：系统 MUST 提供模块级多选以控制本次导入范围。

### Requirement: Import Configuration Panel After Upload
系统 MUST 在上传完成后向用户展示导入策略、模块选择配置、版本差异提示与清洗摘要。

#### Scenario: 展示模块统计与模块级多选
- **前提**：用户已上传并通过校验的 JSON 文件。
- **当**：系统进入导入配置步骤。
- **那么**：系统 MUST 列出 JSON 中包含的模块及每模块数据条数（`Sector / Flow / Ship`）。
- **并且**：系统 MUST 提供模块级多选以控制本次导入范围。
- **并且**：模块名称 MUST 使用与版本切换场景一致的 i18n 语义。

#### Scenario: 展示导入前清洗摘要
- **前提**：用户已上传并通过校验的 JSON 文件。
- **并且**：导入预检查发现至少一个模块存在当前游戏版本下已失效的引用。
- **当**：系统进入导入配置步骤。
- **那么**：系统 MUST 按模块展示清洗摘要。
- **并且**：摘要 MUST 表达对应引用对象不存在且已从存档中移除。

#### Scenario: 覆盖模式默认全选模块
- **前提**：用户已上传并通过校验的 JSON 文件。
- **并且**：用户当前选择“覆盖”模式。
- **当**：系统渲染模块选择区域。
- **那么**：系统 MUST 默认全选当前 JSON 中可导入的模块。

### Requirement: Module-Oriented Import Pipeline
系统 MUST 按模块执行导入，并对每个模块应用统一流程：`migrate -> sanitize -> import mode apply -> activeId decision -> context refresh`。

#### Scenario: 覆盖导入执行完整流水线
- **前提**：用户选择覆盖导入，导入包包含一个或多个模块数据。
- **当**：系统执行导入。
- **那么**：系统 MUST 先对每个模块执行 `migrate`，再执行 `sanitize`（Save 模块特殊规则）。
- **并且**：系统 MUST 清理对应当前模块数据并写入处理后数据。
- **并且**：系统 MUST 按模块执行 `activeId` 更新与刷新判定。

#### Scenario: 增量导入执行完整流水线
- **前提**：用户选择增量导入，导入包包含一个或多个模块数据。
- **当**：系统执行导入。
- **那么**：系统 MUST 先对每个模块执行 `migrate`，再执行 `sanitize`。
- **并且**：系统 MUST 在当前模块数据上进行合并导入。
- **并且**：Save 模块 MUST 对同名存档执行覆盖，其他存档追加。

### Requirement: Export Compatibility
系统 MUST 导出可回灌的模块化数据结构，并显式写出生成该文件时的游戏版本元数据。

#### Scenario: 导出源数据跟随当前版本 storage key
- **前提**：用户已通过版本切换功能选择当前游戏版本。
- **当**：系统构建导出 payload。
- **那么**：系统 MUST 从当前版本作用域下的 `Sector / Flow / Ship` store 状态读取导出数据。
- **并且**：这些 store 状态 MUST 来自当前版本对应的 storage key，而不是固定的全局 key。

#### Scenario: 导出结果包含游戏版本元数据
- **前提**：用户触发导出，系统生成导出数据。
- **当**：系统序列化导出 payload。
- **那么**：导出结果顶层 MUST 包含 `game_vsn` 与 `beta`。
- **并且**：`game_vsn` MUST 等于当前生效的游戏版本号。
- **并且**：`beta` MUST 等于当前生效的 beta 标记。

#### Scenario: 导出结果可作为导入输入
- **前提**：用户触发导出，系统生成导出数据。
- **当**：该导出数据被重新导入同版本系统。
- **那么**：系统 MUST 能识别模块、版本字段、`game_vsn` 与 `beta` 并按导入流程处理。

#### Scenario: 老导出文件缺失版本字段仍可导入
- **前提**：用户上传的旧导出文件不包含 `game_vsn` 与 `beta`。
- **当**：系统执行导入解析。
- **那么**：系统 SHALL 继续识别模块与版本字段并按导入流程处理。
- **并且**：系统 SHALL 将该文件版本解释为 `8.0 stable`，而不是未知版本。

### Requirement: Module Migration Strategy
系统 MUST 为每个导入模块提供迁移入口，并在迁移结果上执行模块类型对应的失效引用清洗。

#### Scenario: Empire 模块清洗失效站点模块
- **前提**：导入包含 `x4_empire_data`。
- **并且**：某站点模块在当前游戏版本的模块数据中不存在。
- **当**：系统执行 Empire 模块导入预处理。
- **那么**：系统 MUST 从该站点模块列表中移除该条无效模块引用。

#### Scenario: Flow 模块清洗失效模块节点
- **前提**：导入包含 `x4_logic_flow_plans`。
- **并且**：某 flow 节点引用的模块在当前游戏版本中不存在。
- **当**：系统执行 Logic Flow 模块导入预处理。
- **那么**：系统 MUST 从对应 group 中移除该无效节点。

#### Scenario: Ship 模块清洗失效飞船与装备引用
- **前提**：导入包含 `x4_ship_blueprints`。
- **并且**：某 blueprint 的 `shipId`、装备引用或仓储物品引用在当前游戏版本中不存在。
- **当**：系统执行 Ship Blueprint 模块导入预处理。
- **那么**：系统 MUST 按当前数据结构执行安全清洗。
- **并且**：当 `shipId` 不存在时，系统 MUST 移除整条 blueprint。
- **并且**：当装备或仓储物品不存在时，系统 MUST 置空或移除对应引用，而不是保留脏数据。

#### Scenario: Ship 模块识别跨版本槽位不兼容的装备
- **前提**：导入包含 `x4_ship_blueprints`。
- **并且**：导出文件来自不同游戏版本。
- **并且**：某个 `equipment_id` 在当前版本中仍然存在，但它不再匹配当前舰船对应槽位的 `slot_type / size / tags`。
- **当**：系统执行 Ship Blueprint 模块导入预处理。
- **那么**：系统 MUST 将该装备视为失效引用并在导入前清空。
- **并且**：系统 MUST 在清洗摘要中体现该装备已被移除。

### Requirement: Import-Export Module Naming
导入/导出相关界面与提示中的模块名称 MUST 与版本切换场景使用同一套 i18n 语义，并统一采用 `Sector / 星区` 面向用户表达。

#### Scenario: 导入导出模块命名对齐版本切换
- **前提**：系统渲染导入/导出模块名称。
- **当**：用户查看模块列表、版本差异提示或清洗摘要。
- **那么**：系统 MUST 使用与版本切换场景一致的模块名称来源。
- **并且**：系统 MUST NOT 维护一套与版本切换平行且语义漂移的独立命名。

#### Scenario: 用户可见命名不再使用 Empire
- **前提**：系统渲染与 `x4_empire_data` 对应的用户可见模块名称。
- **当**：模块名出现在导入/导出或版本切换相关 UI 中。
- **那么**：系统 SHALL 显示 `Sector / 星区`。
- **并且**：系统 MUST NOT 再显示 `Empire / 帝国` 作为该模块的用户可见名称。

### Requirement: Save Module Export Data Structure
系统 MUST 在导出 payload 中包含 Save 模块数据，结构为 `{ state: SavedSaveArchivesState, archives: SaveArchive[] }`。

#### Scenario: 导出包含存档索引和正文
- **前提**：用户选择导出，且勾选 Save 模块。
- **当**：系统构建导出 payload。
- **那么**：系统 MUST 从当前版本作用域的 localStorage 读取 `savedArchivesState`。
- **并且**：系统 MUST 从当前版本作用域的 IndexedDB 读取每条存档正文。
- **并且**：系统 MUST 组装 `{ state, archives }` 结构写入 `data.x4_save_archives`。

#### Scenario: 导出标记来源版本
- **前提**：系统构建导出 payload。
- **当**：写入顶层元数据。
- **那么**：系统 MUST 在 `game_vsn / beta` 字段标记当前游戏版本。

### Requirement: Save Module Export UI Behavior
系统 MUST 在导出界面为 Save 模块提供特殊展示和行为。

#### Scenario: 展示存档模块统计
- **前提**：用户打开导出弹窗。
- **当**：系统渲染模块选择区域。
- **那么**：系统 MUST 展示 Save 模块条目统计（如 "存档 (3)"）。
- **并且**：系统 MUST 在 Save 模块旁显示说明："包含存档索引和正文，文件体积较大"。

#### Scenario: 全选不自动勾选存档
- **前提**：用户打开导出弹窗。
- **当**：用户点击"全选"按钮。
- **那么**：系统 MUST 勾选 Empire/Flow/Ship 模块。
- **并且**：系统 MUST NOT 自动勾选 Save 模块。

### Requirement: Save Module Import Sanitize
系统 MUST 在导入 Save 模块时执行版本和 parser_version 强制校验。

#### Scenario: 版本不匹配的存档跳过
- **前提**：导入文件包含 `x4_save_archives` 模块。
- **当**：系统执行 sanitize。
- **那么**：系统 MUST 校验每条存档的 `meta.version` 与 `currentVersion`。
- **并且**：若版本不匹配，系统 MUST 跳过该存档。
- **并且**：系统 MUST 统计跳过数量并记录详情。

#### Scenario: parser_version 不匹配的存档跳过
- **前提**：导入文件包含 `x4_save_archives` 模块。
- **当**：系统执行 sanitize。
- **那么**：系统 MUST 校验每条存档的 `meta.parser_version` 与 `CURRENT_PARSER_VERSION`。
- **并且**：若不匹配，系统 MUST 跳过该存档。
- **并且**：系统 MUST 统计跳过数量并记录详情。

#### Scenario: 展示跳过详情
- **前提**：sanitize 完成，存在跳过的存档。
- **当**：系统渲染导入配置界面。
- **那么**：系统 MUST 显示有效存档数量。
- **并且**：系统 MUST 显示跳过存档数量及原因。
- **并且**：系统 MUST 提供可折叠的跳过详情列表。

### Requirement: Save Module Import Re-process
系统 MUST 在导入时对 post_processor_version 不匹配的存档重新处理。

#### Scenario: post_processor_version 不匹配时重新处理
- **前提**：存档通过版本和 parser_version 校验。
- **当**：系统检查 `meta.post_processor_version`。
- **那么**：若与 `CURRENT_POST_PROCESSOR_VERSION` 不匹配，系统 MUST 执行 `postProcessRustSaveArchive`。
- **并且**：系统 MUST 更新存档的 `meta.post_processor_version` 到当前版本。
- **并且**：系统 MUST 更新存档的 `meta.isValid` 和其他派生字段。

#### Scenario: post_processor_version 匹配时直接使用
- **前提**：存档通过版本和 parser_version 校验。
- **当**：系统检查 `meta.post_processor_version`。
- **那么**：若与 `CURRENT_POST_PROCESSOR_VERSION` 匹配，系统 MUST 直接使用原正文。

### Requirement: Save Module Import Same-Name Archive Handling
系统 MUST 对同名存档执行覆盖逻辑。

#### Scenario: 同名存档覆盖
- **前提**：导入存档与当前作用域已存在存档具有相同 `guid + time`。
- **当**：系统执行导入写入。
- **那么**：系统 MUST 直接覆盖该存档的 meta。
- **并且**：系统 MUST 直接覆盖该存档的 IndexedDB 正文。

### Requirement: Save Module Import Migration
系统 MUST 为 Save 模块提供 migrate 接口。

#### Scenario: Save 模块执行版本迁移
- **前提**：导入包含 `x4_save_archives` 模块。
- **当**：系统执行 `migrateSaveArchivesStateToCurrent`。
- **那么**：系统 MUST 调用迁移入口。
- **并且**：当前版本为 v1，迁移 MUST 返回原数据（无实质操作）。
- **并且**：迁移入口 MUST 保持可扩展以支持未来版本演进。

### Requirement: Save Module Import ActiveId Decision
系统 MUST 为 Save 模块应用 activeId 决策规则。

#### Scenario: 覆盖导入更新 Save activeId
- **前提**：Save 模块导入模式为覆盖。
- **当**：模块数据写入完成。
- **那么**：系统 MUST 以导入结果中的 `activeArchiveId` 作为当前 `activeArchiveId`（在合法可定位前提下）。

#### Scenario: 增量导入在允许条件下更新 Save activeId
- **前提**：Save 模块导入模式为增量。
- **并且**：当前 `activeArchiveId` 为空，或 `selectedArchive` 为空。
- **当**：模块数据写入完成。
- **那么**：系统 MUST 更新 `activeArchiveId` 到导入结果中的值。

#### Scenario: 增量导入在不满足条件时保持 Save activeId
- **前提**：Save 模块导入模式为增量。
- **并且**：当前 `activeArchiveId` 非空，且 `selectedArchive` 非空。
- **当**：模块数据写入完成。
- **那么**：系统 MUST 保持当前 `activeArchiveId` 不变。

### Requirement: Save Module Import Context Refresh
系统 MUST 在 Save 模块导入后刷新 maps 视图上下文。

#### Scenario: Maps 视图上下文刷新
- **前提**：当前页面为 maps 视图。
- **并且**：Save 模块导入导致 `activeArchiveId` 变化。
- **当**：导入完成。
- **那么**：系统 MUST 清空当前 overlay。
- **并且**：若新 `activeArchiveId` 对应正文存在，系统 MUST 恢复 overlay。
- **并且**：若正文不存在，系统 MUST 显示空地图。

### Requirement: Save Module Import Version Scope Isolation
系统 MUST 确保 Save 模块导入导出严格按版本作用域隔离。

#### Scenario: 导入写入当前版本作用域
- **前提**：用户在特定游戏版本下执行导入。
- **当**：系统写入 Save 模块数据。
- **那么**：系统 MUST 使用 `getStorageKey('save_archives')` 获取当前作用域 key。
- **并且**：系统 MUST 写入 localStorage 到当前作用域 key。
- **并且**：系统 MUST 写入 IndexedDB 正文，主键为 `${scopeKey}:${archiveId}`。

#### Scenario: 覆盖导入清理当前版本作用域
- **前提**：Save 模块导入模式为覆盖。
- **当**：系统执行清理。
- **那么**：系统 MUST 清理当前作用域 key 对应的 localStorage 状态。
- **并且**：系统 MUST 调用 `clearArchivesFromDB(scopeKey)` 清理当前作用域的 IndexedDB 正文。

#### Scenario: 覆盖导入不影响其他版本数据
- **前提**：当前游戏版本为 9.0。
- **并且**：存在 8.0 版本的历史数据。
- **当**：用户在 9.0 作用下执行覆盖导入。
- **那么**：系统 MUST 仅清理和写入 9.0 作用域的数据。
- **并且**：系统 MUST NOT 影响 8.0 作用域的数据。

#### Scenario: 增量导入限定在当前版本作用域
- **前提**：Save 模块导入模式为增量。
- **当**：系统执行合并。
- **那么**：系统 MUST 仅读取和写入当前作用域的数据。
- **并且**：系统 MUST NOT 读取或写入其他版本作用域的数据。

### Requirement: Save Module Import UI Behavior
系统 MUST 在导入界面为 Save 模块提供特殊展示。

#### Scenario: 展示存档模块统计和跳过详情
- **前提**：用户上传包含 Save 模块的导入文件。
- **当**：系统进入导入配置步骤。
- **那么**：系统 MUST 展示 Save 模块有效存档数量。
- **并且**：系统 MUST 展示跳过存档数量及原因。
- **并且**：系统 MUST 提供可折叠的跳过详情列表。
- **并且**：系统 MUST 提供模块级多选以控制本次导入范围。

