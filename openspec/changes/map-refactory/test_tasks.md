# map-refactory Test Tasks

## 1 单元测试

- [✓] 1.1 geometry 工具函数单测
  - [✓] 1.1.1 在 `tests/unit/map-refactory/geometry.spec.ts` 创建单测文件
  - [✓] 1.1.2 对 `hexVertices(cx, cy, radius)` 输入 `(0, 0, 100)` 执行调用，断言返回 6 个顶点且首顶点角度为 0 度 #期望: [6 个顶点，首顶点 x≈100, y≈0]
  - [✓] 1.1.3 对 `clipSegmentToConvexPolygon(p0, p1, polygon)` 输入完全在六边形内的线段，断言返回原线段端点 #期望: [返回 [p0, p1] 或近似值]
  - [✓] 1.1.4 对 `clipSegmentToConvexPolygon` 输入完全在六边形外的线段，断言返回 null #期望: [null]
  - [✓] 1.1.5 对 `clipSegmentToConvexPolygon` 输入部分穿越六边形边界的线段，断言返回裁剪后的线段端点 #期望: [返回裁剪后的 [enter, exit] 两点]
  - [✓] 1.1.6 对 `clipPolylineToConvexPolygon` 输入穿越六边形的多段线，断言返回可见链数组 #期望: [返回数组，每条链至少 2 点]
  - [✓] 1.1.7 对 `catmullRomToBezierPath` 输入 4 点 Catmull-Rom 路径，断言输出包含 `M` 和 `C` 命令 #期望: [包含 "M" 和 "C" SVG path 命令]
  - [✓] 1.1.8 对 `buildHighwayPathPoints` 输入起点、终点、中间点数组，断言去重并过滤 eps 范围内重复点 #期望: [返回去重后的点数组]

- [✓] 1.2 coordinates 工具函数单测
  - [✓] 1.2.1 在 `tests/unit/map-refactory/coordinates.spec.ts` 创建单测文件
  - [✓] 1.2.2 对 `sectorRatioToClusterRatio` 输入 sector normalized 中心偏移和局部坐标，断言返回 cluster ratio #期望: [返回正确的 cluster ratio 坐标]
  - [✓] 1.2.3 对 `clusterRatioToScreen` 输入 center、radius、ratio，断言返回屏幕坐标 #期望: [返回屏幕坐标 x = center.x + ratio.x * radius]
  - [✓] 1.2.4 对 `sectorLocalRatioToScreen` 输入 cluster、sector、localRatio，断言返回屏幕坐标 #期望: [返回正确的屏幕坐标或 null]
  - [✓] 1.2.5 对 `gateClusterRatioFromRaw` 输入 gate raw_local_pos 和 sector normalized，断言返回 cluster ratio #期望: [返回正确的 cluster ratio 或 null]

- [✓] 1.3 useMapSvgLinks composable 单测
  - [✓] 1.3.1 在 `tests/unit/map-refactory/useMapSvgLinks.spec.ts` 创建单测文件
  - [✓] 1.3.2 构造包含 sector_links 的 cluster 数据，对 `sectorLinkLines` 执行 computed 计算，断言返回正确的 link 线段数组 #期望: [返回包含 id、start、end 的线段数组]
  - [✓] 1.3.3 构造包含 highways 的 sector 数据，对 `highwaySegments` 执行 computed 计算，断言返回裁剪后的可见链 #期望: [返回 path 或 line 类型 segment 数组]
  - [✓] 1.3.4 构造包含 cluster_gates 的 sector 数据，对 `gateCircles` 执行 computed 计算，断言返回 gate 圆数组 #期望: [返回包含 point、r、color 的圆数组]
  - [✓] 1.3.5 构造包含配对 cluster_gates 的两个 cluster，对 `crossClusterGateLines` 执行 computed 计算，断言返回跨 cluster gate 连线 #期望: [返回包含 left、right 的连线数组]
  - [✓] 1.3.6 对 superhighway sector link 验证 from_zone_id 与 to_zone_id 映射到正确屏幕坐标 #期望: [start/end 坐标来自 link.from_zone_id 和 link.to_zone_id 对应的 zone 位置]

## 2 E2E 标准状态与状态迁移

- [✓] 2.1 状态: 地图渲染-默认视图
  - [✓] 2.1.1 在页面导航至 `/?router=maps` 视图
  - [✓] 2.1.2 在 `.map-viewport` 等待 `svg[data-testid="map-svg-canvas"]` 渲染完成，超时设置为 10000ms
  - [✓] 2.1.3 等待 500ms 以确保地图布局稳定
  - [✓] 2.1.4 断言 `.sector-links` 组存在 #期望: [组存在]
  - [✓] 2.1.5 断言 `.sector-links` 组包含 line 元素 #期望: [line 元素集合非空]
  - [✓] 2.1.6 断言 `.highways` 组存在 #期望: [组存在]
  - [✓] 2.1.7 断言 `.highways` 组包含 path 或 line 元素 #期望: [path 或 line 元素集合非空]
  - [✓] 2.1.8 断言 `.gates` 组存在 #期望: [组存在]
  - [✓] 2.1.9 断言 `.gates` 组包含 circle.gate-circle 元素 #期望: [circle.gate-circle 元素集合非空]
  - [✓] 2.1.10 断言 `.sector-hover-target` 元素存在 #期望: [元素集合非空]

- [✗] 2.2 状态: 地图渲染-overlay-可见
  - [✓] 2.2.1 在页面导航至 `/?router=maps` 视图
  - [✓] 2.2.2 在 `.map-viewport` 等待 `svg[data-testid="map-svg-canvas"]` 渲染完成
  - [✓] 2.2.3 等待 500ms 以确保地图布局稳定
  - [✓] 2.2.4 打开 station panel 以触发 overlay 渲染
  - [✗] 2.2.5 断言 `.station-overlays` 组存在 #期望: [组存在]
  - [ ] 2.2.6 断言 `.save-poi-overlays` 组存在 #期望: [组存在]
  - [ ] 2.2.7 断言 `.placement-overlay` 元素存在且 CSS pointer-events 为 auto #期望: [元素存在且有 pointer-events: auto]

- [✓] 2.3 状态: 地图-sector-hover-激活
  - [✓] 2.3.1 在页面导航至 `/?router=maps` 视图
  - [✓] 2.3.2 在 `.map-viewport` 等待 `svg[data-testid="map-svg-canvas"]` 渲染完成
  - [✓] 2.3.3 对 `.sector-hover-target` 第一个元素执行 hover 操作
  - [✓] 2.3.4 等待 300ms 以确保 tooltip 位置计算完成
  - [✓] 2.3.5 断言 `.map-sector-tooltip-layer` 可见 #期望: [可见]
  - [✓] 2.3.6 断言 `.sector-tooltip-title` 文本非空 #期望: [文本非空]

- [✓] 2.4 切换: 地图渲染-默认视图 -> 地图-sector-hover-激活
  - [✓] 2.4.1 从 状态: 地图渲染-默认视图 开始
  - [✓] 2.4.2 对 `.sector-hover-target` 第一个元素执行 hover 操作
  - [✓] 2.4.3 断言 `.map-sector-tooltip-layer` 可见 #期望: [可见]

- [✓] 2.5 切换: 地图-sector-hover-激活 -> 地图渲染-默认视图
  - [✓] 2.5.1 从 状态: 地图-sector-hover-激活 开始
  - [✓] 2.5.2 将鼠标移动到 `.map-viewport` 元素的左上角坐标 (0, 0)
  - [✓] 2.5.3 等待 200ms 以确保 tooltip 关闭计时器触发
  - [✓] 2.5.4 断言 `.map-sector-tooltip-layer` 不可见 #期望: [不可见]

## 3 E2E 测试场景

- [✓] 3.1 Case: Sector link 渲染验证
  - [✓] 3.1.1 状态: 地图渲染-默认视图
  - [✓] 3.1.2 获取 `.sector-links line` 元素数量
  - [✓] 3.1.3 断言每个 line 元素有有效的 x1, y1, x2, y2 属性 #期望: [属性值为数值字符串]
  - [✓] 3.1.4 断言每个 line 元素 stroke 颜色为 `#1d4ed8` #期望: [stroke="#1d4ed8"]

- [✓] 3.2 Case: Highway segment 渲染验证
  - [✓] 3.2.1 状态: 地图渲染-默认视图
  - [✓] 3.2.2 获取 `.highways` 组内元素数量
  - [✓] 3.2.3 断言 path 元素 d 属性包含有效的 SVG path 命令 #期望: [包含 M 和 C/L 命令]
  - [✓] 3.2.4 断言 line 元素（如有）有有效坐标属性 #期望: [x1, y1, x2, y2 为数值]
  - [✓] 3.2.5 断言 highway stroke 颜色为 `#0ea5e9` #期望: [stroke="#0ea5e9"]

- [✓] 3.3 Case: Gate circle 渲染验证
  - [✓] 3.3.1 状态: 地图渲染-默认视图
  - [✓] 3.3.2 获取 `.gates circle.gate-circle` 元素数量
  - [✓] 3.3.3 断言每个 gate-circle 有 cx, cy, r 属性 #期望: [属性值为数值字符串]
  - [✓] 3.3.4 断言每个 gate-circle 有 data-gate-id 和 data-cluster-id 属性 #期望: [属性非空]
  - [✓] 3.3.5 断言 gate-circle stroke-width 与 stargateVisualScale 关联 #期望: [stroke-width 约为 0.3 * 1.5 = 0.45]

- [✓] 3.4 Case: Cross-cluster gate line 渲染验证
  - [✓] 3.4.1 状态: 地图渲染-默认视图
  - [✓] 3.4.2 获取 `.cross-links line.gate-path` 元素数量
  - [✓] 3.4.3 断言每个 gate-path 有 data-gate-line-id 属性 #期望: [属性包含 "<->" 分隔符]
  - [✓] 3.4.4 断言每个 gate-path stroke 颅色为 `#e5e7eb` #期望: [stroke="#e5e7eb"]

- [✓] 3.5 Case: ClipPath id 无冲突
  - [✓] 3.5.1 状态: 地图渲染-默认视图
  - [✓] 3.5.2 获取 `defs clipPath` 所有元素
  - [✓] 3.5.3 断言每个 clipPath id 唯一 #期望: [id 数量等于元素数量]
  - [✓] 3.5.4 断言 clipPath id 格式为 `sector-clip-{clusterId}-{sectorId}` #期望: [id 包含 "sector-clip-" 前缀]

- [✓] 3.6 Case: Filter id 无冲突
  - [✓] 3.6.1 状态: 地图渲染-默认视图
  - [✓] 3.6.2 获取 `defs filter` 所有元素
  - [✓] 3.6.3 断言每个 filter id 唯一 #期望: [id 数量等于元素数量]
  - [✓] 3.6.4 断言 filter id 格式正确 #期望: [id 包含 faction-color- 或 map-search-sector-glow 标识]

- [✓] 3.7 Case: Sector hover 事件绑定验证
  - [✓] 3.7.1 状态: 地图渲染-默认视图
  - [✓] 3.7.2 切换: 地图渲染-默认视图 -> 地图-sector-hover-激活
  - [✓] 3.7.3 断言 `.sector-tooltip-card` 包含标题和所属势力 #期望: [标题和势力非空]
  - [✓] 3.7.4 断言 `.sunlight-name` 可见 #期望: [可见]

- [✓] 3.8 Case: Sector hover 关闭验证
  - [✓] 3.8.1 状态: 地图渲染-默认视图
  - [✓] 3.8.2 切换: 地图渲染-默认视图 -> 地图-sector-hover-激活
  - [✓] 3.8.3 切换: 地图-sector-hover-激活 -> 地图渲染-默认视图
  - [✓] 3.8.4 断言 `.map-sector-tooltip-layer` 最终不可见 #期望: [不可见]

- [✗] 3.9 Case: Placement overlay pointerdown 事件验证
  - [✗] 3.9.1 状态: 地图渲染-overlay-可见
  - [ ] 3.9.2 断言 `.placement-overlay` 元素存在
  - [ ] 3.9.3 断言 `.placement-overlay` pointer-events 为 auto #期望: [pointer-events: auto]

- [✗] 3.10 Case: Save POI overlay pointerdown 事件验证
  - [✗] 3.10.1 状态: 地图渲染-overlay-可见
  - [ ] 3.10.2 断言 `.save-poi-overlays` 组存在 #期望: [组存在]
  - [ ] 3.10.3 断言 `.save-poi-marker` pointer-events 为 auto #期望: [pointer-events: auto]

- [✓] 3.11 Case: Tooltip 不闪烁消失
  - [✓] 3.11.1 状态: 地图渲染-默认视图
  - [✓] 3.11.2 切换: 地图渲染-默认视图 -> 地图-sector-hover-激活
  - [✓] 3.11.3 获取 `.map-sector-tooltip-layer` 的 boundingBox
  - [✓] 3.11.4 将鼠标从 sector 移动到 tooltip 元素中心位置
  - [✓] 3.11.5 断言 `.map-sector-tooltip-layer` 保持可见 #期望: [可见]
  - [✓] 3.11.6 切换: 地图-sector-hover-激活 -> 地图渲染-默认视图
  - [✓] 3.11.7 断言 tooltip 最终关闭 #期望: [不可见]

- [✓] 3.12 Case: 缩放触发 tooltip 隐藏验证
  - [✓] 3.12.1 状态: 地图渲染-默认视图
  - [✓] 3.12.2 切换: 地图渲染-默认视图 -> 地图-sector-hover-激活
  - [✓] 3.12.3 在 `.map-viewport` 执行鼠标滚轮缩放操作 (deltaY: -100)
  - [✓] 3.12.4 断言 `.map-sector-tooltip-layer` 因缩放暂时不可见 #期望: [不可见]
  - [✓] 3.12.5 切换: 地图-sector-hover-激活 -> 地图渲染-默认视图
  - [✓] 3.12.6 断言 `.map-sector-tooltip-layer` 最终不可见 #期望: [不可见]

- [✓] 3.13 Case: Tooltip 内容完整性验证
  - [✓] 3.13.1 状态: 地图-sector-hover-激活
  - [✓] 3.13.2 断言 `.sector-tooltip-title` 显示 sector 本地化名称 #期望: [文本非空且非英文 ID]
  - [✓] 3.13.3 断言 `.sector-tooltip-owner` 显示势力本地化名称 #期望: [文本非空]
  - [✓] 3.13.4 断言 `.sector-tooltip-grid` 包含 `.sunlight-name` 元素 #期望: [可见]
  - [✓] 3.13.5 断言资源列表按固定顺序显示 #期望: [ore, silicon, ice, hydrogen, nividium 顺序]

- [✓] 3.14 Case: Tooltip 内容本地化验证
  - [✓] 3.14.1 状态: 地图-sector-hover-激活
  - [✓] 3.14.2 记录 `.sector-tooltip-title` 和 `.sector-tooltip-owner` 当前文本内容
  - [✓] 3.14.3 通过语言选择器切换到 `zh-CN`
  - [✓] 3.14.4 重新 hover 同一 sector 触发 tooltip 更新
  - [✓] 3.14.5 断言 `.sector-tooltip-title` 文本切换为中文 #期望: [文本包含中文字符]

## 4 Bug 测试
