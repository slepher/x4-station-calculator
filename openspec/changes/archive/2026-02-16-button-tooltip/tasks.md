## 1. 国际化与配置更新

- [x] 1.1 更新 `src/locales/en.json`，拆分 `Long+Resource Buffer` 等 Key，新增独立的原子 Key。
- [x] 1.2 更新 `src/locales/zh-CN.json`，完成对应中文翻译。

## 2. 组件逻辑增强

- [x] 2.1 修改 `src/components/common/FavoriteButton.vue`，增加 Props (`hasConsumption`, `hasNetProduction`, `bufferSettings`)。
- [x] 2.2 在 `FavoriteButton.vue` 中实现 `formattedBufferHours` 计算属性 (处理 AH/BH 显示逻辑)。
- [x] 2.3 在 `FavoriteButton.vue` 中实现动态描述文本生成逻辑 (基于拆分后的 Key)。
- [x] 2.4 更新 `FavoriteButton.vue` 和 `LockButton.vue` 的 `v-tippy` 配置，添加 `hideOnClick: false`。
- [x] 2.5 [New] 修改 `FavoriteButton.vue`，支持 `availableLevels` Prop 并据此过滤 Tooltip 行。
- [x] 2.6 [New] 修改 `formattedBufferHours` 逻辑，隐藏为 0 的生产缓冲时间。

## 3. UI 布局调整

- [x] 3.1 修改 `FavoriteButton.vue` 的 Tooltip 模板，应用 4 列 CSS Grid 布局。
- [x] 3.2 调整 CSS 样式，增加 Label 列最小宽度 (适配 "No Demand")，优化对齐。
- [x] 3.3 [BugFix] 修改 `FavoriteButton.vue` 样式，移除对 `disabled` 状态的透明度设置，确保纯消耗资源图标可见。
- [ ] 3.4 [Optimization] 调整 Hours 列宽，适配 "24h + 24h" 最大宽度场景，减少留白 (70px -> 60px)。

## 4. 集成与数据传递

- [x] 4.1 修改 `src/components/StationWareFlow.vue`，在循环中计算当前 Ware 的产出/消耗状态。
- [x] 4.2 将计算出的状态及 `stationSettings` 传递给 `FavoriteButton` 组件。
- [x] 4.3 [New] 修改 `StationWareFlow.vue`，实现 `isPlanned` 和 `availableLevels` 计算逻辑。
    - Planned Ware: `[1, 2]`
    - Auto/Byproduct: `[0, 1]`
    - Consumption Only: `[0]`
- [x] 4.4 [New] 修改 `StationWareFlow.vue`，移除 `isWareOperable` 的 UI 限制，改为基于 `availableLevels.length > 1` 计算 `disabled` 状态。
