# UI Knowledge: empire-view-ui-change

本文档仅覆盖 `test_tasks.md` 中定义的交互与断言所需定位器。

## 1. 标题与视图切换

| 元素 | 定位器 | 说明 |
|------|--------|------|
| 面板标题 | `.header-title` | 标题文本断言使用 |
| 视图切换按钮组 | `.view-mode-switcher` | 资源/经济切换容器 |
| 视图按钮 | `.view-mode-btn` | 使用文案 `/资源|数量|Resource|Quantity/` 与 `/经济|Economy/` 过滤 |
| 每小时标签（应移除） | `.header-badge` | 本变更后应不存在或不含目标文案 |

## 2. 帝国明细数量样式（目标结构）

| 元素 | 定位器 | 说明 |
|------|--------|------|
| 明细行名称容器 | `.item-name` | 明细左侧主容器 |
| 数量文本 | `.item-name .qty` | 数量部分 |
| x 符号 | `.item-name .symbol` | 固定 `x` |
| 名称文本 | `.item-name .name` | 站点名 |

断言要点：
1. 结构顺序为 `.qty` → `.symbol` → `.name`。
2. `.symbol` 文本值为 `x`。
3. 两个入口（帝国总览、空间站帝国缺口明细）都使用相同结构。

## 3. 帝国总览入口

| 元素 | 定位器 | 说明 |
|------|--------|------|
| 帝国总览标签 | `.overview-tab` | 进入帝国总览 |
| 资源项容器 | `.flow-wrapper` | 选择可展开的资源行 |
| 分组容器 | `.group-container` | 用于按组定位 |

## 4. 空间站帝国资源入口

| 元素 | 定位器 | 说明 |
|------|--------|------|
| 显示缺口开关 | `[data-testid="toggle-show-empire-gaps"]` | 推荐稳定定位 |
| 帝国缺口分组 | `.empire-gap-group` | 帝国运营/帝国补给分组容器 |
| 分组项容器 | `.flow-wrapper` | 可展开的缺口项 |

## 5. 测试数据建议

为保证可展开明细，建议至少准备两个空间站，并确保存在同一资源的帝国汇总贡献项。  
如需在 E2E 中稳定复现，优先复用现有 `empire-production-summary` 与 `empire-gap-display` 的测试建站步骤。

## 6. 本次验证记录

- Unit:
  - `tests/unit/empire-view-ui-change/empire-view-ui-change.spec.ts`
- E2E:
  - `tests/e2e/empire-view-ui-change/ui-change.spec.ts` 中：
    - `帝国总览去标签与标题后缀验证`
    - `空间站帝国资源区域去标签与标题后缀验证`
    - `帝国明细站点数量样式一致性验证`

注意：Playwright 使用 `npm run preview`，若断言仍命中旧文案，需先执行一次 `npm run build`。
