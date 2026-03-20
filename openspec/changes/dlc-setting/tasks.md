# Tasks: dlc-setting

## 1. Setting 存储接入
- [x] 1.1 在 `versions.json` 中为各版本显式增加 `setting` storage key。
- [x] 1.2 为 `x4-setting` 接入与现有模块一致的统一版本分流 storage key 规则。
- [x] 1.3 在 store 中定义 setting 数据结构，并支持 `activeDlcs?: string[]` 与 `enforceDlcActivation?: boolean`。
- [x] 1.4 实现当前版本 setting 的读取与保存。

## 2. DLC 状态计算
- [x] 2.1 在 `useGameDataStore` 中接入 `dlcs.json` 原始数据读取结果。
- [x] 2.2 基于 `dependencyVersion <= current game version` 计算当前版本可用 DLC 列表。
- [x] 2.3 确保候选列表不包含 `base`。
- [x] 2.4 在 `activeDlcs` 字段缺失时，提供“当前版本全部可用 DLC”作为默认激活 fallback。
- [x] 2.5 提供 `needsDlcSetup` 或等价状态，用于表示当前版本缺少 `activeDlcs` 字段。
- [x] 2.6 在 `enforceDlcActivation` 字段缺失时，默认回退为 `false`。

## 3. 右上角入口
- [x] 3.1 在右上角工具区新增 setting 按钮入口。
- [x] 3.2 复用既有 setting SVG 按钮样式。
- [x] 3.3 在 `needsDlcSetup` 为 true 时显示红点。

## 4. Setting Modal
- [x] 4.1 新增独立的 DLC setting modal 组件。
- [x] 4.2 在 modal 中渲染当前版本可用 DLC 的 checkbox 列表。
- [x] 4.2.1 使用游戏数据 i18n 显示 DLC 名称。
- [x] 4.3 在 modal 中提供“全选 / 全不选”操作。
- [x] 4.4 在 modal 中新增“未激活 DLC 物品处理策略”的布尔开关，默认关闭。
- [x] 4.4.1 在策略开关下显示简短说明文字。
- [x] 4.5 关闭 modal 时不强制保存未提交的修改。
- [x] 4.6 保存后写回当前版本对应的 setting storage，并刷新 store 状态。

## 5. Store 输出与后续可消费性
- [x] 5.1 在 `useGameDataStore` 中暴露当前版本可用 DLC 列表。
- [x] 5.2 在 `useGameDataStore` 中暴露当前版本激活 DLC 列表。
- [x] 5.3 在 `useGameDataStore` 中暴露 `enforceDlcActivation` 状态。
- [x] 5.4 在 `useGameDataStore` 中提供基础 DLC 激活判断或过滤 helper。
- [x] 5.5 确保后续业务可以只通过 store 获取 DLC 激活状态，而不需要直接读取 localStorage。

## 6. 构建验证
- [x] 6.1 完成实现后执行 `npm run build`。
- [x] 6.2 确认未设置 `activeDlcs` 时按钮显示红点且运行时默认激活全部当前版本可用 DLC。
- [x] 6.3 确认 `enforceDlcActivation` 默认关闭，且保存后持久化成功。
- [x] 6.4 确认保存后红点消失，且当前版本激活 DLC 列表持久化成功。
