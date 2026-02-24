# Ship Build Equipment Specification

## Purpose
为“船只建造”新增可操作的配装区，支持连接组级别精细配装与分组批量配装，并保证模式切换仅改变展示方式，不改变已配装数据。

## ADDED Requirements

### Requirement: Connection-Oriented Fit Panel

#### Scenario: Render Slot Groups Top To Bottom
- **前提**：用户已在“船只建造”视图中选择一艘飞船。
- **当**：页面渲染配装区。
- **那么**：系统 SHALL 按飞船 `slots` 原顺序从上到下展示。
- **并且**：每个 `slot` 下展示其全部 `groups`（connection groups）。

#### Scenario: Assign Equipment Per Connection Group
- **前提**：某 `slot.group` 可进行配装。
- **当**：用户在标准模式下为该 group 选择装备。
- **那么**：系统 SHALL 将该选择应用到该 group 的全部同类 connection。
- **并且**：该选择 MUST 立即反映在配装区当前行。

#### Scenario: Show Main Slot And Shield Sections In Same Group Tab
- **前提**：某 connection group 同时存在主槽位与从属护盾。
- **当**：系统渲染该 group 标签内容。
- **那么**：系统 SHALL 在同一标签下分别展示主槽位选择区与护盾选择区。
- **并且**：护盾 MUST 作为主槽位 group 的从属内容显示，而非独立顶层分组。

### Requirement: Global Equipment Candidate Filtering

#### Scenario: Build Candidate List From All Equipments
- **前提**：系统已加载 `equipments.json`。
- **当**：为某 connection group 计算候选装备。
- **那么**：系统 MUST 从全量 `equipments` 进行筛选。
- **并且**：筛选条件 MUST 包含 `type` 与 `size` 精确匹配。

#### Scenario: Tag Matching Uses Any-Hit Rule
- **前提**：connection 含有 `tags`。
- **当**：系统执行候选筛选。
- **那么**：若 `equipment.slotTags` 与 `connection.tags` 命中任意一条，即 SHALL 视为标签匹配。

#### Scenario: Empty Connection Tags Fallback
- **前提**：connection 的 `tags` 为空。
- **当**：系统执行候选筛选。
- **那么**：系统 SHALL 仅使用 `type + size` 规则决定候选集合。

#### Scenario: Equipment Name Uses i18n NameId
- **前提**：候选装备存在 `nameId`。
- **当**：系统渲染候选装备名称。
- **那么**：系统 SHALL 使用 `nameId` 对应的 i18n 文本显示名称。
- **并且**：系统 MUST NOT 直接以静态 `name` 作为唯一展示来源。

### Requirement: Simplified Group Mode

#### Scenario: Aggregate Groups In Simplified Mode
- **前提**：用户切换至简化模式。
- **当**：系统渲染配装区。
- **那么**：系统 SHALL 按 group 聚合同类槽位。
- **并且**：用户可一次性选择装备并批量应用到该 group 下全部 connection groups。

#### Scenario: Split Same Size Groups By Tag Signature
- **前提**：同一 `slot.type` 下存在多个 `size` 相同但 `tags` 不同的 groups。
- **当**：系统在简化模式生成 group 标签。
- **那么**：系统 MUST 以 `size + tags` 作为聚合维度拆分标签。
- **并且**：标签 SHALL 显示为 `M1/M2...` 等可区分形式，而非强行合并为单个 `M`。

#### Scenario: Aggregate Shield By Parent Slot Semantic Key
- **前提**：group 内存在从属护盾连接。
- **当**：系统在简化模式聚合护盾。
- **那么**：系统 MUST 按 `slot.size|slot.tags|shield.size|shield.tags`（并受 `slot.type` 约束）聚合护盾。
- **并且**：系统 MUST NOT 把不同父槽位语义下的护盾合并为同一组。

### Requirement: Mode Switch Preserves Assignment Data

#### Scenario: Switch Display Mode Without Data Mutation
- **前提**：用户已完成部分或全部配装。
- **当**：用户在标准模式与简化模式间切换。
- **那么**：系统 MUST NOT 清空、重置或改写已配装结果。
- **并且**：切换仅改变展示层级。

### Requirement: Simplified Mode Availability Guard

#### Scenario: Disable Simplified Mode On Multi-Selection Conflict
- **前提**：同一 `slot.type` 下已存在多种不同装备分配。
- **当**：系统评估简化模式切换可用性。
- **那么**：简化模式切换控件 MUST 置灰。

#### Scenario: Re-enable Simplified Mode After Conflict Resolved
- **前提**：导致冲突的多装备分配被消除。
- **当**：系统重新评估切换可用性。
- **那么**：简化模式切换控件 SHALL 恢复可用。

### Requirement: Group Navigation And Count Accuracy

#### Scenario: Hide Absent SlotType Tabs
- **前提**：当前飞船不包含某些 `slotType`。
- **当**：系统渲染左侧 `slotType` 切换按钮。
- **那么**：系统 SHALL 仅显示当前飞船实际存在的 `slotType` 按钮。

#### Scenario: Render Real Selected Over Total Count
- **前提**：某主槽位区或护盾区存在多个可配连接点。
- **当**：系统渲染区块计数。
- **那么**：系统 MUST 显示真实 `selected/total`。
- **并且**：`total` 与该区实际槽位数量一致，不得固定为 `0/1`。

### Requirement: Single Candidate View And Text-Only Card

#### Scenario: Keep Arsenal As The Only Fit Candidate View
- **前提**：用户进入配装区。
- **当**：系统渲染候选界面。
- **那么**：系统 SHALL 仅使用 Arsenal 视图。
- **并且**：系统 MUST NOT 再提供 Nebula / Hangar / Tactical 切换控件。

#### Scenario: Candidate Cards Do Not Render Image Placeholder
- **前提**：候选装备数据中无可用图片资源。
- **当**：系统渲染候选卡片。
- **那么**：系统 SHALL 仅渲染文本信息（名称、种族、MK）。
- **并且**：系统 MUST NOT 渲染图片占位块。

## MODIFIED Requirements

### Requirement: Tag Matching With Hittable/Unhittable Guard

#### Scenario: Require Additional Tag Beyond Hittable Or Unhittable
- **前提**：connection tags 含 `hittable` 或 `unhittable`。
- **当**：系统执行候选筛选。
- **那么**：系统 MUST 在命中 `hittable/unhittable` 的同时，额外命中至少一个其他标签才视为匹配。
- **并且**：`hittable` 与 `unhittable` 互斥，不得互相匹配。

#### Scenario: Shield Integrated Rule Is Removed
- **前提**：候选筛选针对 shield 连接。
- **当**：系统执行标签匹配。
- **那么**：系统 SHALL 使用统一的 slotTags 规则。
- **并且**：系统 MUST NOT 使用 `integrated` 的额外命中特例。

### Requirement: Exclude No-Player-Blueprint Equipments

#### Scenario: Filter Out No-Player-Blueprint Candidates
- **前提**：候选装备包含 `noplayerblueprint=true` 的条目。
- **当**：系统执行候选筛选。
- **那么**：系统 MUST 排除所有 `noplayerblueprint=true` 的装备。

### Requirement: Candidate View Naming And Equipment I18n Consistency

#### Scenario: Standardize Single Candidate View Name
- **前提**：配装区仅保留一个候选视图。
- **当**：系统渲染该视图名称。
- **那么**：系统 SHALL 使用标准化后的唯一名称显示。

#### Scenario: Equipment Name I18n In Both Modes
- **前提**：标准/简化模式均展示装备名称。
- **当**：系统渲染装备名称。
- **那么**：系统 SHALL 使用 `nameId` 的 i18n 文本，避免跨模式语言不一致。
