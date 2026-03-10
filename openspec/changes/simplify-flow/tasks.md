# Tasks: simplify-flow

## 1. 类型与版本

- [x] 1.1 将 `SavedFlowNode` 持久化类型改为极简结构：`isolated?: string`、`module?: string`（互斥）。
- [x] 1.2 将 flow 当前版本从 `2` 升级为 `3`，并统一版本常量引用。

## 2. 保存链路精简

- [x] 2.1 更新 flow 保存映射逻辑：隔离节点保存 `{ isolated }`。
- [x] 2.2 更新 flow 保存映射逻辑：可生产节点保存 `{ module }`。
- [x] 2.3 对非法节点形态执行跳过并输出 warning。

## 3. 加载与重建

- [x] 3.1 更新 flow 方案加载逻辑，支持 `{ isolated }` 节点恢复。
- [x] 3.2 更新 flow 方案加载逻辑，支持 `{ module }` 节点恢复并重建 auto 上游。
- [x] 3.3 确保加载后运行态字段按现有规则补齐，不从持久化直接读取冗余字段。

## 4. 迁移与导入导出兼容

- [x] 4.1 在 flow migration 中实现 `v2 -> v3` 节点转换。
- [x] 4.2 store 加载路径复用统一 flow migration 并回写归一化结构。
- [x] 4.3 import/export flow 路径复用统一 flow migration，确保导入导出版本与结构一致。
- [x] 4.4 适配 empire 导入 flow 目标构建逻辑：支持从 `{ module }` 统计模块、从 `{ isolated }` 统计锁定货物。
- [x] 4.5 保持空组跳过与 warning 语义在 empire 导入场景下不回归。

## 5. 文档同步

- [x] 5.1 同步更新与 flow 版本相关的 OpenSpec 规范描述（v3）。
- [x] 5.2 同步更新 request/design/spec 间的字段命名与迁移语义，保持一致。

## 6. 构建校验

- [x] 6.1 完成实现后执行 `npm run build`。
- [x] 6.2 若构建失败，修复后重复构建直至通过或出现明确阻塞。
