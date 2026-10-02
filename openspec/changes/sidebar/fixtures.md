# Sidebar fixture

当前布局回归不需要额外 patch。两用例均使用现有 `loadLiveBindingFixture(page)` 注入 db、构造当前版本 archives、reload 并通过 UI 设置语言；蓝图再通过 UI 切换模式和添加站点，实况通过 UI 展开现有分组。不直接改普通业务状态或手写 archive。
