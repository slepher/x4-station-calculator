# resource-pie 测试任务

## 1 单元测试

- [✓] 1.1 buildSectorResourceFill 饼图切片份额计算
  - [✓] 1.1.1 在 `tests/unit/map-resource-filter/map-resource-filter.spec.ts` 中对 `buildSectorResourceFill` 函数传入两个资源（ore level=14, silicon level=2）并执行份额计算，断言返回 `mode: 'pie'` 且切片数量为 2 #期望: [mode='pie', slices.length=2]
  - [✓] 1.1.2 对上述返回结果断言每个切片 `share >= 0.05` #期望: [所有切片 share >= 0.05]
  - [✓] 1.1.3 对上述返回结果断言所有切片 `share` 总和接近 1 #期望: [sum(share) ≈ 1]

- [✓] 1.2 buildSectorResourceFill 零 level 归一化处理
  - [✓] 1.2.1 在 `tests/unit/map-resource-filter/map-resource-filter.spec.ts` 中对 `buildSectorResourceFill` 函数传入三个资源（ore/silicon/ice level 均为 0）并执行份额计算，断言返回 `mode: 'pie'` 且切片数量为 3 #期望: [mode='pie', slices.length=3]
  - [✓] 1.2.2 对上述返回结果断言每个切片 `share >= 0.05` #期望: [所有切片 share >= 0.05]
  - [✓] 1.2.3 对上述返回结果断言所有切片 `share` 总和接近 1 #期望: [sum(share) ≈ 1]

- [✓] 1.3 buildSectorResourceFill 日光回退逻辑
  - [✓] 1.3.1 在 `tests/unit/map-resource-filter/map-resource-filter.spec.ts` 中对 `buildSectorResourceFill` 函数传入空资源列表且 `sunlightFilterEnabled=true`，断言返回 `mode: 'solid'` 且 `ware='sunlight'` #期望: [mode='solid', ware='sunlight']

- [✓] 1.4 MapResourceFilterPanel 多资源选择事件输出
  - [✓] 1.4.1 在 `tests/unit/map-resource-filter/map-resource-filter-panel.spec.ts` 中挂载组件并依次点击 ore 和 silicon 两个资源 tag
  - [✓] 1.4.2 对组件发出的 `resource-visual-change` 事件断言 payload 包含 `highlightedSectorIds` 和 `sectorFills` #期望: [包含 highlightedSectorIds 和 sectorFills]
  - [✓] 1.4.3 对 `sectorFills[sectorId].mode` 断言值为 `'pie'` #期望: [mode='pie']
  - [✓] 1.4.4 对 `sectorFills[sectorId].slices` 断言切片按资源 tag 固定顺序排列 #期望: [slices 顺序为 ore, silicon]

- [✓] 1.5 MapSvgCanvas 饼图切片渲染
  - [✓] 1.5.1 在 `tests/unit/map-resource-filter/map-svg-canvas.spec.ts` 中挂载组件并传入 `resourceSectorFills` 包含 `mode: 'pie'` 和两个切片
  - [✓] 1.5.2 对组件渲染结果断言存在两个 `data-testid="resource-pie-slice"` 元素 #期望: [slices.length=2]
  - [✓] 1.5.3 对每个切片元素断言 `fill` 属性与传入颜色一致 #期望: [fill 属性匹配]

## 2 E2E 标准状态与状态迁移

- [✓] 2.1 状态: 地图-资源面板打开
  - [✓] 2.1.1 在地图视图导航到 `/?router=maps` 路由
  - [✓] 2.1.2 对 `.map-viewport svg` 等待渲染完成
  - [✓] 2.1.3 对 `data-testid="map-resource-entry-button"` 执行点击操作打开资源面板
  - [✓] 2.1.4 断言 `data-testid="map-resource-panel-header"` 可见 #期望: [资源面板已展开]

- [✓] 2.2 切换: 地图-资源面板打开 -> 地图-资源面板关闭
  - [✓] 2.2.1 状态: 地图-资源面板打开
  - [✓] 2.2.2 对 `data-testid="map-resource-close-panel"` 执行点击操作关闭面板
  - [✓] 2.2.3 断言 `data-testid="map-resource-panel-header"` 不可见 #期望: [资源面板已关闭]

## 3 E2E 测试场景

- [✓] 3.1 Case: 多资源饼图渲染
  - [✓] 3.1.1 状态: 地图-资源面板打开
  - [✓] 3.1.2 对 `data-testid="map-resource-tag-ore"` 执行点击操作选中 ore
  - [✓] 3.1.3 对 `data-testid="map-resource-tag-silicon"` 执行点击操作选中 silicon
  - [✓] 3.1.4 对 `[data-sector-hover-id="Cluster_01_Sector001_macro"]` 内的 SVG 断言存在多个 `data-testid="resource-pie-slice"` 子元素 #期望: [pie-slice 数量 >= 2]
  - [✓] 3.1.5 对第一个饼图切片断言 `fill` 属性为 `#CF7F54` (ore 颜色) #期望: [fill='#CF7F54']

- [✓] 3.2 Case: 单资源单色填充
  - [✓] 3.2.1 状态: 地图-资源面板打开
  - [✓] 3.2.2 对 `data-testid="map-resource-tag-ore"` 执行点击操作选中 ore
  - [✓] 3.2.3 对 `[data-sector-hover-id="Cluster_01_Sector001_macro"]` 内断言不存在 `data-testid="resource-pie-slice"` 元素 #期望: [无 pie-slice 元素]
  - [✓] 3.2.4 对 `[data-sector-hover-id="Cluster_01_Sector001_macro"] polygon` 断言 `fill` 属性为 `#CF7F54` (ore 颜色) #期望: [fill='#CF7F54']

- [✓] 3.3 Case: 日光单独染色
  - [✓] 3.3.1 状态: 地图-资源面板打开
  - [✓] 3.3.2 对 `data-testid="map-resource-tag-sunlight"` 执行点击操作选中日光
  - [✓] 3.3.3 对 `[data-sector-hover-id="Cluster_01_Sector001_macro"]` 内断言不存在 `data-testid="resource-pie-slice"` 元素 #期望: [无 pie-slice 元素]
  - [✓] 3.3.4 对 `[data-sector-hover-id="Cluster_01_Sector001_macro"] polygon` 断言 `fill` 属性为 `#F7D24B` (sunlight 颜色) #期望: [fill='#F7D24B']

- [✓] 3.4 Case: 日光混合时排除
  - [✓] 3.4.1 状态: 地图-资源面板打开
  - [✓] 3.4.2 对 `data-testid="map-resource-tag-ore"` 执行点击操作选中 ore
  - [✓] 3.4.3 对 `data-testid="map-resource-tag-silicon"` 执行点击操作选中 silicon
  - [✓] 3.4.4 对 `data-testid="map-resource-tag-sunlight"` 执行点击操作选中日光
  - [✓] 3.4.5 对 `[data-sector-hover-id="Cluster_01_Sector001_macro"]` 内断言饼图切片数量为 2 #期望: [pie-slice 数量 = 2]
  - [✓] 3.4.6 对所有饼图切片断言 `fill` 属性均不为 `#F7D24B` (sunlight 颜色) #期望: [无 sunlight 颜色切片]

- [✓] 3.5 Case: 关闭面板保留筛选状态
  - [✓] 3.5.1 状态: 地图-资源面板打开
  - [✓] 3.5.2 对 `data-testid="map-resource-tag-ore"` 执行点击操作选中 ore
  - [✓] 3.5.3 对 `data-testid="map-resource-tag-silicon"` 执行点击操作选中 silicon
  - [✓] 3.5.4 切换: 地图-资源面板打开 -> 地图-资源面板关闭
  - [✓] 3.5.5 对 `data-testid="map-resource-entry-button"` 执行点击操作重新打开面板
  - [✓] 3.5.6 对 `data-testid="map-resource-tag-ore"` 断言包含 `selected` 类名 #期望: [ore 保持选中]
  - [✓] 3.5.7 对 `[data-sector-hover-id="Cluster_01_Sector001_macro"]` 内断言饼图切片数量为 2 #期望: [pie-slice 数量 = 2]

- [✓] 3.6 Case: 面板关闭清除高亮
  - [✓] 3.6.1 状态: 地图-资源面板打开
  - [✓] 3.6.2 对 `data-testid="map-resource-tag-ore"` 执行点击操作选中 ore
  - [✓] 3.6.3 切换: 地图-资源面板打开 -> 地图-资源面板关闭
  - [✓] 3.6.4 对 `.map-viewport svg` 断言不存在 `data-testid="resource-pie-slice"` 元素 #期望: [无资源高亮显示]

## 4 Bug 测试
