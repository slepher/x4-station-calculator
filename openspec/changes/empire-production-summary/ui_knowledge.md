# UI Knowledge: Empire Production Summary

本文档记录 `empire-production-summary` 变更在 Web Integration Tests 中使用的 UI 定位器与交互流程。

## 1. 通用流程定位器

| 元素 | 定位器 | 说明 |
|------|--------|------|
| 新建按钮 | `.btn-tool` + `hasText: /新建|New/` | 新建帝国 |
| 分站新增按钮 | `.add-btn` | 在标签栏新增空间站 |
| 模块搜索框 | `.search-box .search-input` | 需先 `focus()` 再 `fill()` |
| 搜索结果项 | `.results-popover .result-item` | 取首项点击 |
| 帝国总览标签 | `.overview-tab` | 进入帝国视图 |
| 分站标签 | `.station-tab` | 返回分站视图 |
| 资源列表主容器 | `.list-wrapper` | Empire 面板 |
| 分组容器 | `.group-container` | 产品/运营/补给 |
| 单项流容器 | `.flow-wrapper` | 资源行 |

## 2. 开关与视图控制

| 元素 | 定位器 | 说明 |
|------|--------|------|
| 开关按钮 | `.toggle-chip` | ON/OFF 芯片按钮 |
| 工人运算开关 | `.toggle-chip` + `.first()` | 绿色激活态 `active-green` |
| 站内补给开关 | `.toggle-chip` + `.nth(1)` | 蓝色激活态 `active-blue` |
| 经济视图按钮 | `.view-mode-btn` + `hasText: /经济|Economy/` | 切换经济视图 |

## 3. 补给优先归类场景（新增）

### 场景目标
验证当 `medicalsupplies` 同时可能进入候选和补给时，只归入补给组。

### 推荐断言定位器
| 断言对象 | 定位器 |
|----------|--------|
| 产品组中的医疗物资 | `.group-container` + `has: .group-title(/产品|Products/)` → `.flow-wrapper` + `hasText: /医疗物资|Medical Supplies/` |
| 运营组中的医疗物资 | `.group-container` + `has: .group-title(/运营|Operations/)` → `.flow-wrapper` + `hasText: /医疗物资|Medical Supplies/` |
| 补给组中的医疗物资 | `.group-container` + `has: .group-title(/补给|Supply/)` → `.flow-wrapper` + `hasText: /医疗物资|Medical Supplies/` |

### 交互步骤
1. 新建帝国并新增空间站1，添加 `Clay` 模块。
2. 开启工人运算与站内补给。
3. 新增空间站2，添加 `Medical` 模块（命中医疗物资产线）。
4. 进入帝国总览，按组断言 `Medical Supplies` 仅在补给组出现。

### 当前执行观测（2026-02-19）
- 构建最新 `dist` 后执行用例：`Medical Supplies` 仅出现在补给组，产品组与运营组均为 0。
- 若出现“代码已修改但 E2E 结果未更新”，优先检查是否先执行了 `npm run build`（Playwright 当前使用 `npm run preview`）。
