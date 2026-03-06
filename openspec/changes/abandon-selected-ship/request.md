# 需求说明：abandon-selected-ship

## 目标
将 ship build 的当前飞船上下文从 `selectedShipId + blueprint.shipId` 双轨模型收敛为“blueprint 单一来源”。
在该收敛下，`新建` 后仍保留当前飞船上下文与船体材料展示，不再出现因 `blueprint=null` 导致的飞船信息丢失。

## 已确认方案（审核重点）
1. 状态模型收敛
- 运行时以当前 `blueprint` 承载飞船上下文；`blueprint.shipId` 是工作态飞船身份的权威来源。
- 本次不要求全量改造所有读取 `selectedShipId` 的代码路径；允许兼容读取存在，但不得依赖其“可空语义”驱动业务分支。
- `blueprint` 在 ship-build 工作态下不允许为 `null`；新建时应重置为“当前飞船的空蓝图”。
- 避免继续维护 `selectedShipId` 与 `blueprint.shipId` 的双向同步逻辑。

2. 新建与切船语义
- `新建`：清空配装/存储等可编辑内容，但保留当前飞船（即保留 `blueprint.shipId`）。
- 切换飞船：创建或替换为目标飞船的空蓝图，并进入 workspace。
- 取消切船：恢复到当前蓝图对应飞船的筛选上下文。

3. 面板取数一致性
- Stats、Materials、Selector、Toolbar 的当前飞船来源统一为当前蓝图。
- 允许兼容期内存在读取 `selectedShipId` 的实现，但最终呈现与行为必须与 `blueprint.shipId` 一致。

4. 持久化与迁移
- 保留 blueprint 的 `shipId` 持久化字段，用于蓝图归属与独立可读性。
- 对历史数据保持兼容迁移；若存在旧的 `selectedShipId` 依赖路径，迁移后由蓝图上下文驱动。

5. 审核与回归重点
- `New`/`Save`/`Save As`/`Load` 行为在“blueprint 永不为空”模型下保持可解释且可验证。
- 未选择 ship 时，`New`/`Save`/`Save As`/`Load` 必须保持不可达（按钮禁用或流程拦截）。
- `isDirty`、`isEmptyForSave`、`requiresSaveAsOnSave` 语义与新模型一致。
- 新建后材料面板仍显示飞船本体材料，且装备分项为清空状态。

## In Scope
- ship-build store 的上下文模型收敛（以 blueprint 为单一来源）。
- 新建/切船/取消切船流程在新模型下重定义并落地。
- ship-build 相关面板行为口径统一（不要求本轮全量替换所有 `selectedShipId` 读取实现）。
- 与 ship blueprint 持久化、迁移、导入导出相关的必要联动。
- 对应单元/E2E 文档任务补充（本阶段仅规划文档）。

## Out of Scope
- empire 与 logic-flow 的数据模型重构。
- 非 ship-build 业务功能改造。
- 视觉样式改版。

## 验收标准（DoD）
1. ship-build 工作态下 `blueprint` 不为 `null`，并可唯一确定当前飞船。
2. 新建后当前飞船不丢失，材料面板继续显示该飞船本体材料。
3. Stats/Materials/Selector/Toolbar 对“当前飞船”判定一致，不依赖双轨状态同步。
4. 未选 ship 时 `New`/`Save`/`Save As`/`Load` 不可达，已选 ship 时按既有策略可达。
5. 相关保存与脏状态判定在新模型下行为稳定，无明显语义倒挂。
6. 历史数据可迁移到当前模型并正常载入。
7. 规划文档中的需求、设计、任务项保持一致且可执行。

## 未决项
无。
