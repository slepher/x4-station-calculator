## 1. 数据层实现

- [x] 1.1 在 `useGameDataStore.ts` 中添加 `volumeCompressionMap` ref
- [x] 1.2 实现 `buildVolumeCompressionMap()` 函数
- [x] 1.3 在 `initialize()` 中调用 `buildVolumeCompressionMap()`
- [x] 1.4 导出 `volumeCompressionMap` 和 `getModuleVolumeCompression()` 辅助函数

## 2. UI 层实现

- [x] 2.1 在 `FlowNode.vue` 中导入 `volumeCompressionMap`
- [x] 2.2 添加计算属性 `volumeCompressionRate` 判断显示条件
- [x] 2.3 在 Subtitle 区域添加压缩率显示元素
- [x] 2.4 实现颜色编码逻辑（≤100% 绿色，>100% 红色）
- [x] 2.5 添加体积图标 SVG（参考 StationWareFlow）

## 3. 验证

- [x] 3.1 运行 `npm run build` 确保无编译错误
- [x] 3.2 运行 `npm run test` 确保现有测试通过
- [x] 3.3 手动验证 FlowNode 显示正确
