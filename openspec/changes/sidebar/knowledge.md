# Sidebar 浏览器定位与几何

- 初始化入口：`tests/e2e/live/helpers/loadLiveBindingFixture.ts` 的 `loadLiveBindingFixture(page)`。该 helper 完成基础 db fixture、IndexedDB archives、reload 和 UI 语言选择。测试不调用 localStorage.clear，不直接回填 live records。
- 蓝图 UI 切换：`top-view-btn-blueprint-production`；实况由 helper 选择 `top-view-btn-live-production`。蓝图用 `sidebar-add-station` 逐次添加空规划，直到列表足以溢出。
- Sidebar：`production-sidebar`；顶部按钮：`sidebar-toggle`；导航行：`.sidebar-row`；主图标：功能／站点行中的 `.sidebar-item-icon`。Transit 的小辅助导航图标不属于主图标列。
- 地形改造主折叠：`sidebar-tree-toggle`；实况主分组折叠：`sidebar-sector-toggle`。展开实况组只点击 aria-expanded=false 的折叠按钮，不改变当前工作区。
- 几何只读通过 getBoundingClientRect/getComputedStyle 获取。顶部双箭头、普通功能／站点 SVG 或 img、主分组箭头和蓝图底部 Plus SVG 的中心相对 sidebar 左边缘应为独立常量 32px，允许 0.25px 误差，不从被测 CSS 变量生成预期。
- 展开／收起都检查主图标水平中心；普通功能行的 y 坐标与所有导航行 36px 高度保持一致。搜索仅在展开显示，因此不要求搜索之后的站点绝对 y 坐标在收起后相同。
- 中间滚动容器是 `.sidebar-scroll`，功能入口与站点共用它；顶部按钮和蓝图 footer 是 `.sidebar-body` 的独立子项。使用 page.mouse.wheel 产生真实滚动，expect.poll 等待 scrollTop 增大，再比较顶部／底部按钮坐标。
- 每种状态保存 sidebar 截图和几何 JSON 到 testInfo.outputPath 并 attach，失败时由测试输出提供实际坐标。Fixture 内容若不足以溢出，蓝图通过 UI 加站，实况降低 viewport 高度并展开已有组，不通过 store 写入伪造列表。
- 不以合成事件或直接调用 presenter 代替 UI 展开／收起和滚动；本轮覆盖布局，不宣称完整拖拽视觉或投放合同已验收。
