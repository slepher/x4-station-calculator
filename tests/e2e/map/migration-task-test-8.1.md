# task-test-8.1 迁移记录

## 范围与运行约束

本次只维护三个 map spec 与本映射、结果文档。普通场景使用去除 `vsn` 的 `db.json`，reload 后通过 UI 选择 `zh-CN`；overlay 场景使用权威 `loadLiveBindingFixture`，再通过 Maps UI 和 `map-save-panel-tab` 进入。固定实体为 `cluster_01_sector001_macro`。所有运行均为 preview-only、Chromium、`PORT=22781`、workers1、retries0、trace on；未改 src/fixture/helper，未 build、未运行 Unit、未执行 git 写入。

## 46 项逐项映射

| old id | current behavior | UI action | static expected | new case |
|---|---|---|---|---|
| refactory 2.1 | 默认地图 canvas | reload maps | SVG 可见 | 保留 2.1 |
| refactory 2.2 | live overlay 可见 | Maps → save panel tab | overlay/面板可见 | 保留 2.2 |
| refactory 2.3 | sector hover | hover 固定 sector | tooltip 出现 | 保留 2.3 |
| refactory 2.4 | hover 激活 | 移入固定 sector | hover 状态成立 | 保留 2.4 |
| refactory 2.5 | hover 离开 | 移出 sector | tooltip 消失 | 保留 2.5 |
| refactory 3.1 | sector links 绘制 | 读取 link path | link 集合存在且属性稳定 | 保留 3.1 |
| refactory 3.2 | highway 绘制 | 读取 highway path | segment 集合存在 | 保留 3.2 |
| refactory 3.3 | gate 为 image | 读取 `.gate-circle` | data ids、x/y、width/height，尺寸 4.0 | 保留 3.3 |
| refactory 3.4 | 跨 cluster gate line | 读取跨 cluster line | line 存在且端点属性有效 | 保留 3.4 |
| refactory 3.5 | clipPath 定义 | 读取全部 clipPath | 每个都有 id 且唯一 | 保留 3.5 |
| refactory 3.6 | SVG filter 定义 | 读取全部 filter | 每个都有 id 且唯一 | 保留 3.6 |
| refactory 3.7 | hover 绑定 | hover 固定 sector | tooltip 与 sector 对应 | 保留 3.7 |
| refactory 3.8 | leave 关闭 | 移入再移出 | tooltip 关闭 | 保留 3.8 |
| refactory 3.9 | placement overlay 可交互 | live fixture 后点击 Maps | overlay pointer-events 与入口有效 | 保留 3.9 |
| refactory 3.10 | save POI overlay 可交互 | live fixture 后打开 save panel | POI overlay pointerdown 可用 | 保留 3.10 |
| refactory 3.11 | tooltip 稳定 | 移入 tooltip | tooltip 不闪退 | 保留 3.11 |
| refactory 3.12 | 缩放时隐藏 tooltip | viewport wheel | tooltip 按动作关闭 | 保留 3.12 |
| refactory 3.13 | tooltip 完整内容 | hover 固定 sector | 标题、owner、sunlight、资源顺序固定 | 保留 3.13 |
| refactory 3.14 | tooltip 本地化 | en → zh UI 切换后 hover | 中文标题与 owner 静态匹配 | 保留 3.14 |
| search 2.1 | maps-view-ready | reload maps | workbench/search input 可见 | 保留 2.1 |
| search 2.2 | search popover visible | focus 输入 `grand` | popover 至少一项 | 保留 2.2 |
| search 2.3 | ready → popover | click 输入框并输入 | popover 可见 | 保留 2.3 |
| search 3.1 | 搜索入口 | 读取左上 search panel | placeholder 为中英文之一 | 保留 3.1 |
| search 3.2 | name 搜索 | 输入 `Grand` | 含 Grand Exchange | 保留 3.2 |
| search 3.3 | localeName 搜索 | zh UI 直接输入 `大交易` | 含 `大交易所` | 保留 3.3 |
| search 3.4 | en 不搜 localeName | en UI 输入中文 | No matching/未找到 | 保留 3.4 |
| search 3.5 | 完整 cluster id | 输入小写 `cluster 01` | 含 cluster_01 sector001 | 保留 3.5 |
| search 3.6 | exact numeric prefix | 注入当前 schema cluster_011，再输入小写前缀 | 结果精确为三个 cluster_01 sector，排除 cluster_011 | 保留 3.6 |
| search 3.7 | 少量批量高亮 | 输入 `Mercury` | 0 < highlight < 10 | 保留 3.7 |
| search 3.8 | 大量结果不批量高亮 | 输入 `a` | 结果 ≥10，highlight=0 | 保留 3.8 |
| search 3.9 | 候选聚焦 | `<100` 点击 Grand；`>=100` 拖拽后再点击 | 低倍率升至 ≥100；高倍率保持；两分支目标均靠近 viewport 中心且 viewBox 改变 | 保留 3.9 |
| search 3.10 | selected glow | 点击 Grand 候选 | 恰有一个 selected polygon 且 bbox 非空 | 保留 3.10 |
| search 3.11 | 输入保持 | 点击候选 | 输入仍为 Grand | 保留 3.11 |
| search 3.12 | 点击后失焦 | 点击候选 | input 不再 focus | 保留 3.12 |
| search 3.13 | 清空回收状态 | click clear | highlight/selected 均为 0 | 保留 3.13 |
| search 3.14 | 清空保持视图 | 真实 zoom、drag、clear | zoom 与 viewBox 不变 | 保留 3.14 |
| search 3.15 | 语言主显示 | 输入 Grand | 当前语言主名称匹配 | 保留 3.15 |
| search 3.16 | id 命中 | 输入 sector id | 结果显示 sectorId | 保留 3.16 |
| search 3.17 | id 结果宽度 | 输入 sector id | popover 有 wide class | 保留 3.17 |
| tooltip 2.1 | sector-hover | 等待 SVG 后 hover 固定 sector | hover 状态可用 | 保留 2.1 |
| tooltip 2.2 | hover → leave | 真实移入移出 | tooltip 关闭 | 保留 2.2 |
| tooltip 3.1 | 内容与资源颜色 | zh UI hover 固定 sector | sunlight、9.0 资源 inline RGB 与固定资源顺序 | 保留 3.1 |
| tooltip 3.2 | 本地化 | en → zh UI 切换 | 中文 tooltip 标题/owner | 保留 3.2 |
| tooltip 3.3 | 稳定显示 | 固定 hover 等待 | tooltip bbox 非空且内容稳定 | 保留 3.3 |
| tooltip 3.4 | 拖拽关闭 | viewport 真实 mouse drag | tooltip 关闭 | 保留 3.4 |
| tooltip 3.5 | 缩放后 tooltip | 固定 sector bbox 内真实 wheel | wheel 后按规范重新显示 tooltip | 保留 3.5 |

## 分类与证据

原始 baseline 为 46 collected、29 passed / 17 failed；失败按 test-owned/stale 分类（旧 gate selector、旧 station 前置、共享前置级联、派生 expected、缺少独立 locale/阈值/视图状态）。本轮 focused 与完整单次均保持 46 项，不使用 skip、only、条件通过、fallback 或从结果派生 expected。

`final2` 曾出现 45 passed / 1 failed：同源码复跑时 `versions-D9enPG8M.js` 动态 import asset 404，属于 preview environment transient；没有据此修改测试或产品。随后同源码 `final3` 复跑消失并通过 46/46。

- final focused：`/tmp/x4-test-repair-M8.1/final3.log`，exit 0，46 passed / 0 failed / 0 skipped。
- final collection：`/tmp/x4-test-repair-M8.1/final3-collection.log`，exit 0，46 tests in 3 files。
- 变更后的最终复核：`/tmp/x4-test-repair-M8.1/final4.log`，exit 0，46 passed / 0 failed / 0 skipped；collection `/tmp/x4-test-repair-M8.1/final4-collection.log`，46 tests in 3 files。
- `git diff --check`：exit 0。
