# sector-link 实施任务

- [x] 1. 数据模型与迁移
- [x] 1.1 在 empire 持久化结构新增 `sectorLinks`（无向边 key 集合）
- [x] 1.2 实现边 key 规范化工具（`minId|maxId`）
- [x] 1.3 初始化/迁移时为旧数据补 `sectorLinks=[]`

- [x] 2. Store 连接能力
- [x] 2.1 新增 `createSectorLink(sourceSectorId, targetSectorId)`
- [x] 2.2 新增 `removeSectorLink(a, b)`
- [x] 2.3 在 action 中统一处理自连接、重复连接、非法目标校验
- [x] 2.4 新增 `getLinkedSectors(sectorId)` 邻接读取能力

- [x] 3. 星区列表面板 UI
- [x] 3.1 在星区拖拽把手旁新增连接图标
- [x] 3.2 在星区项内新增链接区（drop zone）
- [x] 3.3 为连接图标实现 dragstart（写入源星区上下文）
- [x] 3.4 为链接区实现 dragover/drop 并调用 store 建链

- [x] 4. 连接展示与删除
- [x] 4.1 在星区项显示已连接星区列表
- [x] 4.2 为每条连接提供删除按钮
- [x] 4.3 删除按钮调用统一删链 action，确保双端同步移除

- [x] 5. 交互细节与文案
- [x] 5.1 区分排序拖拽与连接拖拽事件入口，避免冲突
- [x] 5.2 增加自连接/重复连接的轻量反馈文案
- [x] 5.3 补齐中英文 i18n 文案键值

- [x] 6. 文档同步
- [x] 6.1 若主规格存在“连接功能关闭”描述，改为当前实现边界
- [x] 6.2 保持 request/spec/design/tasks 描述一致
