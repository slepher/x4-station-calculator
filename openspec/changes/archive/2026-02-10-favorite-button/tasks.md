## 1. 类型定义与状态管理

- [x] 1.1 更新 StationSettings 接口 - 添加 primaryProductBufferHours 和 secondaryProductBufferHours 字段, 去除 productBufferHours 字段
- [x] 1.2 在 useStationStore 中添加 warePriority 响应式状态
- [x] 1.3 在 saveLayout 方法中添加对 warePriority 的持久化逻辑
- [x] 1.4 在 loadLayout 方法中添加对 warePriority 的加载逻辑, 默认值为{}

## 2. 优先级逻辑实现

- [x] 2.1 实现 isPlanned 检测 - 检查产物是否存在于 plannedModules 的输出列表中
- [x] 2.2 实现 isAuto 检测 - 检查产物是否仅存在于 autoIndustryModules 的输出列表中
- [x] 2.3 实现 getResolvedLevel 函数 - 包含自动纠错逻辑的三层判定
- [x] 2.4 实现 toggleWarePriority 动作 - 根据产物身份执行不同的状态切换

## 3. 缓冲计算更新

- [x] 3.1 修改 analyzeWareFlow 函数 - 接受优先级级别参数
- [x] 3.2 更新缓冲体积计算逻辑 - 根据优先级级别应用不同的缓冲时间
- [x] 3.3 更新 totalOccupiedVolume 计算 - 包含基于优先级的缓冲体积

## 4. UI 组件开发

- [x] 4.1 创建 FavoriteButton.vue 组件 - 实现三态 SVG 图标（实心/半空心/空心五角星）
- [x] 4.2 在 StationWareFlow.vue 的操作栏中添加 FavoriteButton
- [x] 4.3 更新 StationWareFlow.vue 操作栏宽度 - 从 w-10 改为 w-20
- [x] 4.4 更新 StationWareFlowGroup.vue 头部占位 div 宽度 - 改为 w-20 保持对齐

## 5. 设置面板更新

- [x] 5.1 在 StationWareFlowsDashboard.vue 中添加主产物缓冲时间滑块（范围 0-24 小时）
- [x] 5.2 在 StationWareFlowsDashboard.vue 中添加副产物缓冲时间滑块（范围 0-24 小时）
- [x] 5.3 添加 i18n 国际化键值 - 缓冲设置标签文本

## 6. 测试与验证

- [x] 6.1 运行构建验证 - 构建成功
- [x] 6.2 导出 warePriority 相关方法 - isPlannedWare, isAutoWare, getResolvedLevel, toggleWarePriority

## 7. Bug 修复与优化

- [x] 7.1 修复经济视图和体积视图中 FavoriteButton 无法控制的问题 - 移除了 netRate <= 0 的禁用条件
- [x] 7.2 为 FavoriteButton 添加 Tippy tooltip - 使用 SVG 图标显示三行状态说明
- [x] 7.3 为 LockButton 添加 Tippy tooltip - 使用 SVG 图标显示两行锁定功能说明
- [x] 7.4 添加 i18n tooltip 键值 - 中文和英文国际化
- [x] 7.5 清理未使用的 plannedWareIds 参数
