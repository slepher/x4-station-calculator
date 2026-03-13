# map-station 实施任务

- [x] 1. 地图空间站工作态入口
- [x] 1.1 在 `MapWorkbenchView` 左下角新增“空间站”入口按钮
- [x] 1.2 增加空间站面板打开/关闭状态，并切换左侧工作面板布局
- [x] 1.3 关闭面板时回收空间站 overlay、拖动态与预览态

- [x] 2. empire location 数据结构
- [x] 2.1 为 `StationPlan` 增加 `location` 字段
- [x] 2.2 为 `SectorPlan` 增加 `location` 字段
- [x] 2.3 在 empire 迁移与归一化逻辑中兼容 `location`
- [x] 2.4 让 `location` 参与 empire dirty 快照与保存

- [x] 3. 空间站面板对象列表与操作
- [x] 3.1 基于当前 `activeEmpire` 构造 `station` 与 `sector transit` 列表
- [x] 3.2 在方案 A 结构中展示“未放置 / 已放置”区块、对象名称、类型与放置状态
- [x] 3.3 为已放置对象提供清除位置/取消放置操作

- [x] 4. 地图拖放与原始坐标换算
- [x] 4.1 为地图层增加放置态命中检测
- [x] 4.2 在目标 map sector 内计算原始 `{x, z}` 坐标
- [x] 4.3 拖入时自动继承目标 sector 的 `sunlight` 与 `resources:string[]`
- [x] 4.4 支持再次拖动已放置对象并更新原 `location`

- [x] 5. overlay 渲染
- [x] 5.1 面板打开时显示已放置 `station` 与 `sector transit` overlay
- [x] 5.2 区分 `station`、`sector transit`、拖动态与预览态的视觉表现
- [x] 5.3 面板关闭时隐藏全部空间站相关 overlay

- [x] 6. 构建验证
- [x] 6.1 完成实现后执行 `npm run build`
- [x] 6.2 若构建失败，修复后重新构建直至通过或记录 blocker

- [x] 7. 空间站面板检索与展示收口
- [x] 7.1 为空间站面板搜索框增加清空搜索内容功能，仅作用于面板对象列表
- [x] 7.2 去除列表中的 `station` / `sector transit` / `未放置` 文案，并将“拖到地图”改为拖动手柄
- [x] 7.3 将面板滚动改为整体单滚动容器，并统一滚动条风格
- [x] 7.4 已放置对象显示目标地图星区名称，隐藏 `sector_id` 与坐标
- [x] 7.5 点击已放置对象时复用 `focusSector()` 聚焦到对应目标地图星区

- [x] 8. 重新构建验证
- [x] 8.1 完成上述调整后再次执行 `npm run build`
- [x] 8.2 若构建失败，修复后重新构建直至通过或记录 blocker
