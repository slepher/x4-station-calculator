# x4-map-tooltip 实施任务

- [x] 1. 建立 sector hover tooltip 状态入口
- [x] 1.1 在 `MapSvgCanvas` 为 sector 图元接入 hover 事件
- [x] 1.2 向 `MapWorkbenchView` 上报 hovered sector 的基础数据与定位锚点
- [x] 1.3 在 `MapWorkbenchView` 增加单例 tooltip 显示状态

- [x] 2. 组装 tooltip 内容数据
- [x] 2.1 基于 `maps.json` 组装 sector 名称、所属势力与 sunlight 数据
- [x] 2.2 复用既有资源顺序与丰度文案映射逻辑
- [x] 2.3 仅输出当前 sector 实际存在的资源项
- [x] 2.4 明确不显示资源数值与 `Potential Kha'ak Sources` 内容

- [x] 3. 实现 tooltip 视图组件
- [x] 3.1 新增独立 sector tooltip 组件承载标题、sunlight 与资源列表
- [x] 3.2 为资源项提供名称、丰度文案与颜色块展示
- [x] 3.3 保持 tooltip 视觉结构清晰且适配当前地图 overlay 风格

- [x] 4. 实现 tooltip 定位与边界避让
- [x] 4.1 在 `MapWorkbenchView` 内测量 tooltip 尺寸
- [x] 4.2 按优先方向计算 tooltip 弹出位置
- [x] 4.3 当默认方向空间不足时切换到可用方向
- [x] 4.4 对最终位置执行视口边界钳制，避免 tooltip 被裁切

- [x] 5. 保证交互稳定性
- [x] 5.1 支持鼠标从 sector 移动到 tooltip 本体时保持显示
- [x] 5.2 在 hover 结束后正确关闭 tooltip，不引入持久选中态
- [x] 5.3 处理 tooltip 与现有搜索、高亮、点击聚焦、拖拽缩放的共存关系
- [x] 5.4 在拖拽或缩放过程中关闭或重置 tooltip，避免错位

- [x] 6. 构建验证
- [x] 6.1 完成实现后执行 `npm run build`
- [x] 6.2 若构建失败，修复后重新构建直至通过或记录 blocker
