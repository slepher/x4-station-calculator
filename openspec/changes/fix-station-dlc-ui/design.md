# 设计

StationPlanningPanel 已准确传入 inactiveByDlc，无需修改其业务层。Item 现有 DLC 展示 computed 移到同层 presenter；模板消费翻译 label 与禁用 quantity 状态。countDisabled（如 habitation）与 inactiveByDlc 各有明确禁用语义；readonly 和删除不改。

不新增 store/presenter/Vue 之外的层、不重构整个 Item、不影响 persisted modules。不加入 fallback 链，保留诊断日志。Unit 对同一 mounted Item 验证翻译、受限禁用、非受限编辑、已有 countDisabled、删除可用。
