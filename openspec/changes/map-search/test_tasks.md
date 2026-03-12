# Test Tasks: map-search

## 1 单元测试

- [✓] 1.1 搜索索引构造：验证 sector 搜索索引字段完整性
  - [✓] 1.1.1 从 `maps.json` 加载 `clusters` 数据，提取首个 cluster 的首个 sector 构造 `SearchSectorLayout` 对象
  - [✓] 1.1.2 断言对象包含 `sectorId`、`clusterId`、`name`、`displayName`、`centerX`、`centerY` 六个必需字段 #期望: [6]

- [✓] 1.2 匹配规则：验证 name 包含匹配逻辑
  - [✓] 1.2.1 构造测试数据：`[{name:'Grand Exchange I', displayName:'大交易所 I', ...}]`，调用匹配函数输入 `"grand"`
  - [✓] 1.2.2 断言返回结果包含 `Grand Exchange I` 且 `matchType` 为 `name` #期望: ['Grand Exchange I', 'name']

- [✓] 1.3 匹配规则：验证非 en locale 下 localeName 包含匹配逻辑
  - [✓] 1.3.1 设置 `locale = 'zh-CN'`，构造测试数据包含 `displayName:'大交易所 I'`，输入 `"大交易"`
  - [✓] 1.3.2 断言返回结果 `matchType` 为 `localeName` #期望: ['localeName']

- [✓] 1.4 匹配规则：验证 en locale 下不额外搜索 localeName
  - [✓] 1.4.1 设置 `locale = 'en'`，构造测试数据 `name:'Grand Exchange I'`，输入 `"grand"` 后验证匹配路径
  - [✓] 1.4.2 断言仅 `name` 字段被匹配，不触发 `localeName` 分支 #期望: ['name']

- [✓] 1.5 匹配规则：验证 cluster id 完整数字匹配
  - [✓] 1.5.1 输入 `"cluster 01"`，匹配函数应返回 `clusterId` 数字部分为 `1` 的 sector
  - [✓] 1.5.2 断言 `matchType` 为 `id` 且结果展开为对应 cluster 下的 sector 列表 #期望: ['id']

- [✓] 1.6 匹配规则：验证 cluster id 不允许前缀误命中
  - [✓] 1.6.1 构造测试数据同时包含 `Cluster_01_macro` 和 `Cluster_011_macro` 两个 cluster 下的 sector
  - [✓] 1.6.2 输入 `"cluster 01"`，断言仅返回 `Cluster_01_macro` 下的 sector，不包含 `Cluster_011_macro` 的 sector #期望: ['Cluster_01_macro']

- [✓] 1.7 高亮阈值：验证结果数小于 10 时触发批量高亮
  - [✓] 1.7.1 构造 5 个匹配结果的搜索输出，计算 `highlightedSectorIds`
  - [✓] 1.7.2 断言 `highlightedSectorIds` 长度等于结果数 #期望: [5]

- [✓] 1.8 高亮阈值：验证结果数大于等于 10 时不触发批量高亮
  - [✓] 1.8.1 构造 15 个匹配结果的搜索输出，计算 `highlightedSectorIds`
  - [✓] 1.8.2 断言 `highlightedSectorIds` 为空数组 #期望: [[]]

## 2 E2E 标准状态与状态迁移

- [✓] 2.1 状态: maps-view-ready
  - [✓] 2.1.1 在 `/` 页面执行前置：将 `tests/fixtures/db.json`（去除 `vsn`）写入 `localStorage`，并设置 `isTestEnv=true`
  - [✓] 2.1.2 执行 `page.reload()` 后通过语言选择器切换 `zh-CN`
  - [✓] 2.1.3 通过 `window.shipBuildStore.activeView = 'maps'` 切换到地图视图
  - [✓] 2.1.4 等待地图 SVG 渲染完成，读取 `.map-workbench` 容器存在性
  - [✓] 2.1.5 断言 `data-testid="map-sector-search-input"` 可见 #期望: [true]

- [✓] 2.2 状态: search-popover-visible
  - [✓] 2.2.1 在 `maps-view-ready` 状态下聚焦 `data-testid="map-sector-search-input"`
  - [✓] 2.2.2 输入任意有效搜索文本如 `"grand"`
  - [✓] 2.2.3 等待候选列表渲染完成
  - [✓] 2.2.4 读取 `data-testid="map-sector-search-popover"` 的可见态
  - [✓] 2.2.5 断言候选列表可见且包含至少一个结果项 #期望: [true, 1]

- [✓] 2.3 切换: maps-view-ready -> search-popover-visible
  - [✓] 2.3.1 在 `maps-view-ready` 状态下点击搜索框并输入 `"grand"`
  - [✓] 2.3.2 等待候选列表渲染完成
  - [✓] 2.3.3 断言 `data-testid="map-sector-search-popover"` 可见 #期望: [true]

## 3 E2E 测试场景

- [✓] 3.1 Case: 地图页面左上角存在 sector 搜索入口
  - [✓] 3.1.1 状态: maps-view-ready
  - [✓] 3.1.2 在页面左上角定位 `.map-search-panel` 容器
  - [✓] 3.1.3 断言搜索框 `data-testid="map-sector-search-input"` 存在且 placeholder 包含 `搜索星区|Search sector` #期望: [true]

- [✓] 3.2 Case: 按 name 搜索返回对应 sector 候选
  - [✓] 3.2.1 状态: maps-view-ready
  - [✓] 3.2.2 切换: maps-view-ready -> search-popover-visible
  - [✓] 3.2.3 在搜索框输入 `"Grand"`
  - [✓] 3.2.4 断言候选列表包含 `Grand Exchange` 相关结果项 #期望: ['Grand Exchange']

- [✓] 3.3 Case: 非 en locale 按 localeName 搜索返回候选
  - [✓] 3.3.1 状态: maps-view-ready
  - [✓] 3.3.2 在搜索框输入 `"大交易"`
  - [✓] 3.3.3 切换: maps-view-ready -> search-popover-visible
  - [✓] 3.3.4 断言候选列表包含 `大交易所` 相关结果项 #期望: ['大交易所']

- [✓] 3.4 Case: en locale 仅按 name 搜索不额外搜索 localeName
  - [✓] 3.4.1 通过语言选择器切换 `en`
  - [✓] 3.4.2 状态: maps-view-ready
  - [✓] 3.4.3 切换: maps-view-ready -> search-popover-visible
  - [✓] 3.4.4 在搜索框输入 `"大交易"`
  - [✓] 3.4.5 断言候选列表显示 `"未找到匹配星区|No matching sectors"` #期望: ['No matching sectors']

- [✓] 3.5 Case: cluster id 完整数字匹配返回对应 sector 候选
  - [✓] 3.5.1 状态: maps-view-ready
  - [✓] 3.5.2 切换: maps-view-ready -> search-popover-visible
  - [✓] 3.5.3 在搜索框输入 `"cluster 01"`
  - [✓] 3.5.4 断言候选列表包含 `Cluster_01_macro` 下的 sector 结果 #期望: ['Cluster_01']

- [✓] 3.6 Case: cluster id 不允许前缀误命中
  - [✓] 3.6.1 状态: maps-view-ready
  - [✓] 3.6.2 切换: maps-view-ready -> search-popover-visible
  - [✓] 3.6.3 在搜索框输入 `"cluster 01"`
  - [✓] 3.6.4 断言候选列表不包含 `Cluster_011` 或 `Cluster_011_macro` 相关结果 #期望: [false]

- [✓] 3.7 Case: 少量结果触发地图批量高亮
  - [✓] 3.7.1 状态: search-popover-visible
  - [✓] 3.7.2 在搜索框输入 `"Mercury"`（预期结果数 < 10）
  - [✓] 3.7.3 在 SVG 地图中读取应用了 `url(#map-search-sector-glow)` 滤镜的 polygon 元素数量
  - [✓] 3.7.4 断言高亮 sector 数量大于 0 且小于 10 #期望: [true]

- [✓] 3.8 Case: 大量结果不触发地图批量高亮
  - [✓] 3.8.1 状态: search-popover-visible
  - [✓] 3.8.2 在搜索框输入 `"a"`（预期结果数 >= 10）
  - [✓] 3.8.3 在 SVG 地图中读取应用了 `url(#map-search-sector-glow)` 滤镜的 polygon 元素数量
  - [✓] 3.8.4 断言高亮 sector 数量为 0 #期望: [0]

- [✓] 3.9 Case: 点击候选后聚焦并校正缩放
  - [✓] 3.9.1 状态: maps-view-ready
  - [✓] 3.9.2 在缩放滑块 `.zoom-slider` 上设置值使 `scale < 100%`
  - [✓] 3.9.3 切换: maps-view-ready -> search-popover-visible
  - [✓] 3.9.4 在搜索框输入 `"Grand"` 后点击首个候选
  - [✓] 3.9.5 断言缩放值显示为 `"100%"` 或更高 #期望: ['100%']

- [✓] 3.10 Case: 点击候选后保持明确选中态
  - [✓] 3.10.1 状态: maps-view-ready
  - [✓] 3.10.2 切换: maps-view-ready -> search-popover-visible
  - [✓] 3.10.3 在搜索框输入 `"Grand"` 后点击首个候选
  - [✓] 3.10.4 在 SVG 地图中读取应用了 `url(#map-search-sector-selected-glow)` 滤镜的 polygon 元素数量
  - [✓] 3.10.5 断言选中态 sector 数量为 1 #期望: [1]

- [✓] 3.11 Case: 点击候选后不改写搜索框输入
  - [✓] 3.11.1 状态: maps-view-ready
  - [✓] 3.11.2 切换: maps-view-ready -> search-popover-visible
  - [✓] 3.11.3 在搜索框输入 `"Grand"` 后点击首个候选
  - [✓] 3.11.4 读取搜索框当前值
  - [✓] 3.11.5 断言搜索框值仍为 `"Grand"` #期望: ['Grand']

- [✓] 3.12 Case: 点击候选后搜索框失焦
  - [✓] 3.12.1 状态: maps-view-ready
  - [✓] 3.12.2 切换: maps-view-ready -> search-popover-visible
  - [✓] 3.12.3 在搜索框输入 `"Grand"` 后点击首个候选
  - [✓] 3.12.4 断言搜索框不是 `document.activeElement` #期望: [false]

- [✓] 3.13 Case: 清空搜索回收高亮与选中态
  - [✓] 3.13.1 状态: maps-view-ready
  - [✓] 3.13.2 切换: maps-view-ready -> search-popover-visible
  - [✓] 3.13.3 在搜索框输入 `"Grand"` 后点击首个候选
  - [✓] 3.13.4 点击搜索框清空按钮 `.clear-btn`
  - [✓] 3.13.5 断言高亮 sector 数量为 0 且选中态 sector 数量为 0 #期望: [0, 0]

- [✓] 3.14 Case: 清空搜索不重置视图缩放与平移
  - [✓] 3.14.1 状态: maps-view-ready
  - [✓] 3.14.2 记录当前缩放值与平移位置
  - [✓] 3.14.3 切换: maps-view-ready -> search-popover-visible
  - [✓] 3.14.4 在搜索框输入 `"Grand"` 后点击清空按钮
  - [✓] 3.14.5 断言缩放值与平移位置与记录值一致 #期望: [true]

- [✓] 3.15 Case: 候选项主显示按语言规则
  - [✓] 3.15.1 状态: maps-view-ready
  - [✓] 3.15.2 切换: maps-view-ready -> search-popover-visible
  - [✓] 3.15.3 在搜索框输入 `"Grand"`
  - [✓] 3.15.4 读取首个候选的 `.result-label` 文本
  - [✓] 3.15.5 断言主显示为 `大交易所`（zh-CN locale） #期望: ['大交易所']

- [✓] 3.16 Case: id 命中显示 sectorId
  - [✓] 3.16.1 状态: maps-view-ready
  - [✓] 3.16.2 切换: maps-view-ready -> search-popover-visible
  - [✓] 3.16.3 在搜索框输入 `"cluster 01"`
  - [✓] 3.16.4 读取首个候选的 `.result-meta` 文本
  - [✓] 3.16.5 断言附加显示包含 `Cluster_01_Sector` 相关 id 文本 #期望: ['Sector']

- [✓] 3.17 Case: id 命中时加宽候选列表
  - [✓] 3.17.1 状态: maps-view-ready
  - [✓] 3.17.2 切换: maps-view-ready -> search-popover-visible
  - [✓] 3.17.3 在搜索框输入 `"cluster 01"` 触发 id 命中
  - [✓] 3.17.4 读取候选列表 `.map-search-popover` 的宽度类
  - [✓] 3.17.5 断言包含 `map-search-popover-wide` 类 #期望: [true]

## 4 Bug 测试
