# Knowledge: map-search

## 1. 对齐范围（与 test_tasks.md 同步）
- 覆盖范围：地图页面 sector 搜索入口、name/localeName/id 搜索匹配规则、结果高亮阈值、候选点击聚焦行为、清空搜索状态回收。
- 章节状态与迁移 ID：
  - `maps-view-ready`
  - `search-popover-visible`
  - `切换: maps-view-ready -> search-popover-visible`
- Bug 场景对齐：当前无已记录 bug。

## 2. 固定数据口径（确定值）
- 基线 fixture：`tests/fixtures/db.json`（导入前删除 `vsn` 字段）。
- 地图数据源：`src/assets/x4_game_data/8.0-Diplomacy/data/maps.json`
- Cluster 示例数据：
  - `Cluster_01_macro`：name = `Grand Exchange`，nameId = `{20003,10001}`
  - `Cluster_011_macro`：用于验证 id 不允许前缀误命中
- Sector 示例数据：
  - `Cluster_01_Sector001_macro`：name = `Grand Exchange I`，nameId = `{20004,10011}`
- Locale 映射：
  - `{20003,10001}` → zh-CN: `大交易所`
  - `{20004,10011}` → zh-CN: `大交易所 I`

## 3. fixture 术语映射（地图实体）
- `Grand Exchange`
  - 来源: `maps.json` Cluster_01_macro
  - nameId: `{20003,10001}`
  - zh-CN 显示名: `大交易所`
  - 推荐断言目标: 搜索 `"Grand"` 或 `"大交易"` 返回候选
- `Mercury`
  - 来源: `maps.json` Cluster_18_macro
  - name: `Mercury`
  - 推荐断言目标: 少量结果高亮测试（预期 < 10 个结果）
- `cluster 01`
  - 输入格式: `cluster + 数字`
  - 命中目标: `Cluster_01_macro` 下的所有 sector
  - matchType: `id`
  - 推荐断言目标: id 匹配测试

## 4. 定位器与操作路径（稳定口径）
- 地图视图切换：
  - `window.shipBuildStore.activeView = 'maps'`
  - URL 参数: `?router=maps`
- 地图容器：
  - `.map-workbench` 地图工作台容器（用于等待视图加载完成）
- 搜索输入：
  - `data-testid="map-sector-search-input"`
  - `.map-search-panel` 容器
- 候选列表：
  - `data-testid="map-sector-search-popover"`
  - `.map-search-popover` 容器类（与 data-testid 同元素）
  - `.map-search-popover-wide` 宽度变体类（id 命中时应用）
  - `data-testid="map-sector-search-result-${sectorId}"`
  - `.result-label` 主显示文本
  - `.result-meta` 附加文本
- 清空按钮：
  - `.clear-btn`（搜索框内）
- 缩放控制：
  - `.zoom-slider` 缩放滑块
  - `.zoom-value` 缩放值显示
- 地图 SVG：
  - 高亮滤镜: `url(#map-search-sector-glow)`
  - 选中滤镜: `url(#map-search-sector-selected-glow)`
- 语言切换：
  - `select`（文本包含 `简体中文|English`），执行 `selectOption('zh-CN')` 或 `selectOption('en')`

## 5. 可观测断言口径
- E2E 主断言优先 UI 与 SVG 状态：
  - UI: 搜索框可见、候选列表可见、候选项文本、缩放值显示。
  - SVG: 应用高亮/选中滤镜的 polygon 数量。
- 搜索匹配断言：
  - `matchType`: `name` | `localeName` | `id`
  - 候选项 `.result-meta` 显示规则：
    - `id` 命中：显示 `sectorId`
    - 非 en 且 `name` 命中：显示原始 `name`
    - 其他情况：不显示附加文本
- 高亮阈值断言：
  - 结果数 < 10：`highlightedSectorIds` 长度 = 结果数
  - 结果数 >= 10：`highlightedSectorIds` 为空

## 6. 与 test_tasks.md 映射
- `2.1` 对应本文件第 4 节地图视图切换与搜索入口定位器。
- `2.2/2.3` 对应本文件第 4 节候选列表定位器。
- `3.1` 对应本文件第 4 节搜索面板布局断言。
- `3.2/3.3/3.4` 对应本文件第 3 节 name/localeName 匹配与第 5 节匹配类型断言。
- `3.5/3.6` 对应本文件第 3 节 cluster id 匹配规则。
- `3.7/3.8` 对应本文件第 5 节高亮阈值断言。
- `3.9/3.10/3.11/3.12` 对应本文件第 4 节缩放控制与选中滤镜。
- `3.13/3.14` 对应本文件第 5 节清空搜索状态回收断言。
- `3.15/3.16/3.17` 对应本文件第 5 节候选显示规则断言。

## 7. 测试运行
- 执行时间：2026-03-13
- 命令与结果：
  - 单元测试：`pnpm exec vitest run tests/unit/map-search/` - 13 passed
  - E2E 测试：`pnpm exec playwright test tests/e2e/map-search/` - 20 passed

# 测试运行经验沉淀

- [✓] 3.4 Case: en locale 仅按 name 搜索不额外搜索 localeName
  - 问题：`stateMapsViewReady` helper 强制设置 `zh-CN` locale，导致测试 3.4 在切换到 `en` 后又被重置回 `zh-CN`
  - 解决：在测试 3.4 中不调用 `stateMapsViewReady`，而是直接断言 maps 视图元素可见
  - 分类：test_defect