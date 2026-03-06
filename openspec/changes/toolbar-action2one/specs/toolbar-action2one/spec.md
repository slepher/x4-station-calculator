# toolbar-action2one Specification

## Purpose
统一三模块（ship-build / logicFlow / empire）在 Toolbar 操作点的动作编排，并把默认命名、dirty 判定、空方案判定、SmartSave 流程与保存成功消息提示收敛到单一 controller。

## MODIFIED Requirements

### Requirement: Toolbar Workflow Must Be Centralized
系统 MUST 使用单一编排入口处理 Toolbar/SmartSave 相关流程。

#### Scenario: 组件不再维护分散流程分支
- **前提**：用户在任一模块触发 `New/Save/Save As`
- **当**：系统处理动作
- **那么**：`StationToolbar.vue` 与 `SmartSaveDialog.vue` MUST 通过统一 controller API 执行
- **并且**：组件层 MUST NOT 直接编排三模块流程分支

### Requirement: Action Semantics Must Stay Consistent Across Modules
系统 MUST 保持统一动作语义与组合动作序列。

#### Scenario: 覆盖并新建
- **前提**：用户触发 `覆盖并新建`
- **当**：系统执行动作
- **那么**：系统 MUST 执行 `SAVE -> NEW`

#### Scenario: 另存为并新建
- **前提**：用户触发 `另存为并新建` 且输入有效名称
- **当**：系统执行动作
- **那么**：系统 MUST 执行 `SAVE_AS(name) -> NEW`
- **并且**：MUST 创建新对象（新 id）

#### Scenario: 丢弃并新建
- **前提**：用户触发 `丢弃并新建`
- **当**：系统执行动作
- **那么**：系统 MUST 仅执行 `NEW`

### Requirement: isEmptyForSave Must Be Unified And Applied To NEW
系统 MUST 通过各 store 的 `isEmptyForSave()` 统一判定空方案，并应用于 `SAVE`、`SAVE_AS`、`NEW`。

#### Scenario: SAVE/SAVE_AS 空方案拦截
- **前提**：用户触发 `SAVE` 或 `SAVE_AS(name)`
- **当**：系统执行前置判定
- **那么**：系统 MUST 调用对应 store 的 `isEmptyForSave()`
- **并且**：返回 `true` 时 MUST 拒绝保存

#### Scenario: NEW 也经过空判定
- **前提**：用户触发 `NEW`
- **当**：系统执行前置判定
- **那么**：系统 MUST 调用对应 store 的 `isEmptyForSave()`
- **并且**：返回 `true` 时 MUST 直接执行空方案新建
- **并且**：返回 `false` 时 MUST 进入非空流程（dirty 决定是否进入 SmartSave）

#### Scenario: ship-build 特例（count=0 但有装备 id）
- **前提**：ship blueprint 的连接槽位 `equipment_id` 非空且 `count=0`
- **当**：执行 `isEmptyForSave()`
- **那么**：系统 MUST 判定为非空

#### Scenario: empire 特例（有 station 无 module）
- **前提**：empire 下存在至少一个 station，且 modules 全空
- **当**：执行 `isEmptyForSave()`
- **那么**：系统 MUST 判定为非空

### Requirement: Default Name Strategy Must Be Unified
系统 MUST 使用统一函数输出默认名策略。

#### Scenario: 默认名统一入口
- **前提**：系统需要获取当前模块默认名
- **当**：调用命名策略
- **那么**：系统 MUST 通过 `getDefaultName(storeType, ctx)` 获取
- **并且**：`useTitleEditor` 仅负责编辑交互，不负责默认名规则

#### Scenario: empire 名称允许为空并走展示默认名
- **前提**：当前 empire 的持久化名称为空字符串
- **当**：系统展示标题
- **那么**：系统 MUST 允许数据层保留空名称
- **并且**：MUST 在展示层通过默认名兜底

### Requirement: Unsaved Save Must Follow SaveAs Dialog
系统 MUST 在未保存对象执行 `SAVE` 时走 `SAVE_AS` 弹窗流程。

#### Scenario: 未保存对象点击 SAVE
- **前提**：当前对象未保存过
- **当**：用户触发 `SAVE`
- **那么**：系统 MUST 打开与 `SAVE_AS` 一致的输入弹窗
- **并且**：系统 MUST 通过 store 语义 `requiresSaveAsOnSave` 判定，而非 controller 直接读取模块内部状态

#### Scenario: 弹窗输入初值与当前 SaveAs 一致
- **前提**：系统打开 `SAVE_AS` 输入弹窗（含未保存对象由 SAVE 触发）
- **当**：系统初始化输入框
- **那么**：系统 MUST 使用当前 `displayTitle` 作为初值（`name || defaultName`）
- **并且**：MUST NOT 追加 copy 后缀

### Requirement: Save Success Toast Must Be Consistent In Toolbar Flow
系统 MUST 在 Toolbar 操作点统一保存成功消息触发策略。

#### Scenario: SAVE/SAVE_AS 成功时统一提示
- **前提**：用户在 Toolbar 或 SmartSave 路径触发保存步骤并执行成功
- **当**：controller 完成动作执行
- **那么**：系统 MUST 触发且仅触发一次 success toast

#### Scenario: 仅 NEW 不提示保存成功
- **前提**：用户触发 `NEW` 且动作序列中无 `SAVE/SAVE_AS`
- **当**：controller 执行完成
- **那么**：系统 MUST NOT 触发保存成功 toast

#### Scenario: 保存前置拦截提示统一
- **前提**：`SAVE/SAVE_AS` 因空方案或空名称被拦截
- **当**：controller 终止动作执行
- **那么**：系统 MUST 触发统一 warning 提示

### Requirement: Empire Import Path Must Be Orchestrated By Controller
系统 MUST 为 `ImportPlanModal(mode=import)` 的 empire 模式提供 controller 编排路径。

#### Scenario: 导入前保存并导入
- **前提**：用户在 empire-import 确认中选择“保存并导入”
- **当**：controller 执行 import 路径
- **那么**：系统 MUST 按顺序执行 `SAVE -> RESET -> IMPORT_DATA`

#### Scenario: 导入前放弃并导入
- **前提**：用户在 empire-import 确认中选择“放弃并导入”
- **当**：controller 执行 import 路径
- **那么**：系统 MUST 按顺序执行 `RESET -> IMPORT_DATA`

#### Scenario: import 复用普通 save/reset 语义
- **前提**：controller 执行 empire-import 路径
- **当**：执行 `SAVE` 与 `RESET`
- **那么**：系统 MUST 复用 controller 既有 `save/reset/dirty` 逻辑
- **并且**：controller MAY 通过既有映射调用普通 store 语义方法
- **并且**：MUST NOT 引入 store 级 import 专用接口（如 `saveBeforeImport/resetBeforeImport/shouldConfirmBeforeImport`）

#### Scenario: importData 作为原子导入操作
- **前提**：controller 执行 empire-import 路径
- **当**：进入最终导入阶段
- **那么**：系统 MUST 通过 `IMPORT_DATA` 原子操作执行数据导入落盘

#### Scenario: 非 empire-import 路径保持不变
- **前提**：用户执行 station 模式导入或 game-blueprint/x4-station 导入
- **当**：系统处理导入流程
- **那么**：系统 MAY 保持现有策略弹窗与执行路径

#### Scenario: 预留非 station 模块的统一入口
- **前提**：controller 收到 `logicFlow` 或 `ship-build` 的 import 路径请求
- **当**：当前版本尚未实现对应导入
- **那么**：系统 MUST 命中 controller.import 的 dummy handler（unsupported）
- **并且**：MUST 保持单一入口，不在组件层另起实现分支
