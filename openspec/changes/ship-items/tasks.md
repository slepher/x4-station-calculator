## 1. 类型定义扩展

- [x] 1.1 在 `src/types/x4.ts` 中添加 `ShipBlueprintStorageItem` 接口
- [x] 1.2 在 `src/types/x4.ts` 中添加 `ShipBlueprintStorage` 接口

## 2. X4DualPhaseRangeSlider 增强

- [x] 2.1 添加 `dragMax` prop 用于限制拖动范围
- [x] 2.2 实现双阶段填充（绿色已用，蓝色可用）
- [x] 2.3 使用全宽输入框 + toNumber 值限制实现 dragMax
- [x] 2.4 移除 CSS transition 避免延迟

## 3. 槽位配置更新

- [x] 3.1 更新 `slotTypeDefs` 数组顺序：E → R → S → W → T → C → U
- [x] 3.2 为每个槽位添加 tooltip 配置（向右弹出）
- [x] 3.3 添加 C 槽和 U 槽的槽位类型定义（id: consumables/units）

## 4. Store 扩展

- [x] 4.1 在 `useShipBuildStore` 中添加 `updateBlueprintStorage()` 方法
- [x] 4.2 storage 数据随 blueprint 一起序列化/反序列化

## 5. 数据加载逻辑

- [x] 5.1 从 consumables.json 加载可部署物品（deployable=true）
- [x] 5.2 从 consumables.json 加载诱导弹物品（class="countermeasure"）
- [x] 5.3 从 drones.json 加载无人机物品（前3个）
- [x] 5.4 从 missiles.json 加载导弹物品（前3个）

## 6. ShipStoragePanel 组件开发

- [x] 6.1 创建 `ShipStoragePanel.vue` 主面板组件
- [x] 6.2 实现 C 槽界面（可部署 + 诱导弹）
- [x] 6.3 实现 U 槽界面（无人机 + 导弹）
- [x] 6.4 使用 X4DualPhaseRangeSlider 显示物品数量
- [x] 6.5 实现总量约束（deployables/drones 使用 dragMax）
- [x] 6.6 从 blueprint 恢复存储配置

## 7. ShipBuildPanelFit 集成

- [x] 7.1 导入 ShipStoragePanel 组件
- [x] 7.2 在 availableSlotTypes 中包含 consumables 和 units
- [x] 7.3 使用 v-if 控制 ShipStoragePanel 显示
- [x] 7.4 排除 C/U 槽的 group-tabs 渲染
- [x] 7.5 排除 C/U 槽的 slot-wall 渲染
- [x] 7.6 排除 C/U 槽的 compatibility-box 渲染

## 8. 样式调整

- [x] 8.1 storage-section 取消 border、padding、bg（只保留 rounded-lg）

## 9. 国际化

- [x] 9.1 在 `src/locales/en.json` 添加 storage 相关翻译
- [x] 9.2 在 `src/locales/zh-CN.json` 添加 storage 相关翻译

## 10. Bug 修复

- [x] 10.1 修复 C/U 槽显示"无可用装备"问题
- [x] 10.2 修复另存为清空存储数据问题
- [x] 10.3 修复拖动条出现禁用图标问题
- [x] 10.4 修复蓝色填充延迟问题

## 11. 构建验证

- [x] 11.1 运行 `npm run build` 验证编译通过
