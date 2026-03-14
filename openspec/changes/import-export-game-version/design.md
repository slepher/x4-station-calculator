# import-export-game-version 设计说明

## 设计目标
本次设计聚焦在现有导入/导出链路上补充“版本感知”能力，而不是重写导入/导出框架。
设计需要同时满足四个目标：
- 导出文件能明确说明它来自哪个游戏版本
- 导入文件在跨版本使用时能提前暴露风险，而不是静默吃掉问题
- 对当前版本已失效的引用，在正式写入前完成结构安全清洗
- 导入/导出与版本切换使用统一的模块命名语义，面向用户统一为 `Sector / Flow / Ship`

## 1. 协议设计

### 1.1 导出 payload 顶层元数据
- 在现有导出结构上追加两个顶层字段：
  - `game_vsn: string`
  - `beta: boolean`
- 这两个字段与 `data` 平级，不嵌入某个具体模块。
- 原因：
  - 它们描述的是整份导出文件生成时的游戏数据上下文
  - 导入阶段在文件刚解析完成时就需要读取它们，用于构建差异提示
- 原有 `format / version / exportedAt / data` 保持不变，以免破坏现有导入兼容性。

### 1.2 缺失版本元数据的兼容策略
- 老导出文件可能没有 `game_vsn` 与 `beta`。
- `normalizeImportPayload` 不应因缺失这两个字段而判定文件非法。
- 设计上将其视为旧协议输入，并补默认值：
  - `game_vsn = 8.0`
  - `beta = false`
- 这样做的原因是：
  - 历史存档默认来自旧的 8.0 stable 语义
  - 导入界面仍然可以执行确定性的版本差异比较，而不是落入“未知版本”分支
- 这保证新协议可向后兼容老文件，同时避免旧文件的版本提示语义含糊。

## 2. 导出 UI 设计

### 2.0 导出数据来源与版本作用域
- 当前导出并不是直接从 `localStorage` 读取固定 key，而是读取三个 store 当前已加载到内存中的状态：
  - `empireStore.savedEmpires`
  - `logicFlowStore.savedPlans`
  - `shipBuildStore.savedBlueprints`
- 这三个 store 在现有版本切换实现中已经通过 `useGameDataStore.getStorageKey(...)` 按当前版本读写各自的存储槽位。
- 因此，从实现边界上看，“导出源数据跟随版本切换”已经成立。
- 本次变更不需要再单独改造导出数据来源的 storage-key 路由，只需要在文档中明确这一前提，并在导出文件中显式写出 `game_vsn / beta`。

### 2.1 当前版本展示
- `StorageExportWizard` 增加一块只读信息区，显示当前游戏版本。
- 显示文案至少包含：
  - 版本号，如 `9.0`
  - beta 标识，如 `beta`
- 该信息与导出文件名输入框并列存在，使用户在下载前就能确认当前导出上下文。

### 2.2 默认文件名生成规则
- 现有默认文件名是时间戳驱动。
- 本次改为“固定前缀 + 游戏版本 + beta 后缀（可选） + 时间戳”。
- 示例：
  - stable: `x4-export-9.0-20260314-1530.json`
  - beta: `x4-export-9.0-beta-20260314-1530.json`
- 文件名生成只影响默认值，不限制用户后续手工修改。

## 3. 导入预检查设计

### 3.1 解析阶段新增预检查结果模型
- `StorageImportWizard` 当前只有：
  - `parsedPayload`
  - `moduleStats`
  - `parseError`
- 本次需要新增一组解析副产物：
  - 文件版本元数据
  - 当前版本与文件版本是否匹配
  - 各模块的清洗后统计与清洗摘要
- 这些结果应在用户点击“执行导入”前就可见。
- 因此预检查逻辑应放在 `onPickFile` 解析完成之后，而不是只在最终 `applyImportPayload` 内做黑盒处理。

### 3.2 版本差异提示
- 版本差异判断只比较：
  - `game_vsn`
  - `beta`
- 若任一不一致，则在导入配置区显示 warning 级别提示。
- 提示信息应同时表达：
  - 文件版本
  - 当前版本
- 若文件原始 JSON 缺失版本元数据，则文件版本显示为默认推断的 `8.0 stable`。
- 这能避免用户只看到“版本不一致”却不知道具体差在哪。

## 4. 三模块清洗设计

### 4.1 设计原则
- 清洗依据必须是“当前已加载的游戏数据”，而不是导入文件自身声明版本。
- 清洗发生在“迁移/归一化之后、正式应用导入之前”。
- 清洗的输出必须仍是可被现有导入流程消费的合法结构。
- 需要同时返回“清洗后的数据”和“清洗摘要”，供 UI 展示与最终 warning 复用。

### 4.2 Empire 清洗
- 输入：迁移后的 `SavedEmpiresState`
- 校验点：`station.modules[].id`
- 判定依据：`gameDataStore.modulesMap`
- 清洗动作：
  - 无效模块从 `modules[]` 中移除
  - 统计被移除的模块数量
- 之所以移除而不是置空，是因为站点模块列表本身就是离散条目集合，空壳无意义。

### 4.3 Logic Flow 清洗
- 输入：迁移后的 `SavedFlowPlansState`
- 校验点：`group.nodes[].module`
- 判定依据：`gameDataStore.modulesMap`
- 清洗动作：
  - 无效模块节点直接从 `nodes[]` 中移除
  - `isolated` ware 节点保持不动
- 这里不把 ware 一起纳入校验，是为了严格对齐本次需求范围，避免把无关扩展混进去。

### 4.4 Ship Blueprint 清洗
- 输入：迁移后的 `SavedShipBlueprintsState`
- 校验对象至少包括：
  - `shipId`
  - `equipment_id`
  - `shield.equipment_id`
  - `deployables / countermeasure / drones / missiles` 中各 item 的 `id`
- 清洗策略按结构分层处理：
  - `shipId` 失效：整条 blueprint 删除
  - 槽位装备失效：对应装备引用清空；若 group 因此失去有效内容，可进一步移除该 group
  - 仓储条目失效：从列表移除，单值槽位则置空
- 这里的“置空”是结构语义上的清空，不追求所有字段都强制写 `null`。

## 5. 导入流程整合设计

### 5.1 预检查与正式导入复用同一清洗核心
- 不能让 UI 预检查和真正导入各自维护两套清洗算法，否则结果会漂移。
- 设计上应抽出共享入口，例如：
  - `prepareImportPayload(...)`
  - 或者分模块的 `sanitizeEmpireImport / sanitizeFlowImport / sanitizeShipImport`
- 该入口负责：
  - 读取版本元数据
  - 计算版本差异
  - 清洗三模块数据
  - 汇总清洗摘要
- `StorageImportWizard` 用它做预览，`applyImportPayload` 用它做真正落库前处理。

### 5.2 与现有 migrate 流程的关系
- 现有 `importExport.ts` 已有：
  - `coerce*`
  - `migrate*`
  - `apply*Import`
- 新清洗逻辑不替换 migration，而是插在 migration 之后：
  - `coerce -> migrate -> sanitize -> apply`
- 原因：
  - migration 先把旧结构与旧 ID 归一到当前协议
  - sanitize 再基于当前协议结构做实体存在性判断
- 这能避免对历史格式分支重复写清洗代码。

## 6. i18n 与命名统一设计

### 6.1 模块名称来源统一
- 当前导入/导出使用 `importExport.module_*`
- 当前版本切换使用 `gameVersion.moduleEmpire` 等独立 key
- 这会导致同一模块在不同界面出现不同命名来源。
- 设计上应统一成一套共享模块命名 key，被导入/导出和版本切换共同消费。

### 6.2 Empire 到 Sector 的语义替换
- 内部存储键仍然可以保留 `x4_empire_data`，因为这属于持久化协议，不应在本次做破坏式改名。
- 但面向用户的显示名称统一为 `Sector / 星区`。
- 同时，对应 i18n key 命名也应摆脱 `Empire` 这一旧语义，避免后续开发继续误用。
- 换句话说：内部协议名和用户显示名可以分离，但用户显示层不再暴露 `Empire / 帝国`。

### 6.3 版本显示格式统一
- 版本切换、导入、导出等 UI 不应各自手写 `currentVersion + beta` 拼接规则。
- 设计上将版本展示格式统一收敛到 `useGameDataStore`：
  - `displayVersion`：输出完整格式，如 `9.0-Empire-beta`
  - `displayFullVersion`：输出短格式，如 `9.0-beta`
- 版本切换下拉选项使用完整格式，避免丢失 codename。
- 工具栏版本按钮与导入/导出中的当前版本、文件版本优先使用短格式，减少 UI 噪音并保持与导出文件元数据语义一致。
- stable 版本不追加 `stable` 文案，直接显示版本号，例如 `8.0`。

## 7. 风险与对策

- 风险：只在最终应用导入时清洗，用户在点击导入前无法感知跨版本损失。
  - 对策：把清洗结果前置到文件解析成功后的配置步骤中展示。
- 风险：UI 预检查和正式导入使用两套逻辑，导致“预览说删 3 个，实际删 5 个”。
  - 对策：预检查与真正导入复用同一清洗核心。
- 风险：Ship Blueprint 清洗过于粗暴，可能破坏结构合法性。
  - 对策：按 blueprint / connection / group / storage 分层清洗，始终输出合法结构。
- 风险：把 `Empire` 全量替换成 `Sector` 时误伤内部存储键或类型名。
  - 对策：仅统一用户可见文案与 i18n key 语义，不改动持久化字段名。
- 风险：老导出文件缺少 `game_vsn` 与 `beta` 后被误判为非法，或落入“未知版本”提示导致用户无法判断差异。
  - 对策：把缺失元数据视为兼容输入，并默认补成 `8.0 stable`。
