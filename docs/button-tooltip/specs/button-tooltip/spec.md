# Button Tooltip Specification

## Purpose
Optimize the interaction and content of Favorite and Lock buttons in StationWareflow, ensuring tooltips persist on click and displaying detailed buffer information based on production/consumption context.

## ADDED Requirements

### Requirement: Tooltip Persistence
系统SHALL确保 Fav (优先级) 和 Lock (锁定) 按钮的 Tooltip 在被点击时不会自动消失。

#### Scenario: 切换状态时 Tooltip 保持
- **前提** 用户将鼠标悬停在 Fav 或 Lock 按钮上，Tooltip 已显示
- **当** 用户点击该按钮切换状态 (如改变优先级或锁定状态)
- **那么** Tooltip 应当保持显示，并即时更新内容反映新状态
- **并且** 只有当鼠标移开时 Tooltip 才消失

### Requirement: Fav Tooltip 详细缓存信息
系统SHALL在 Fav 按钮的 Tooltip 中增加一列显示具体的缓存小时数，并根据产出/消耗情况动态调整描述文本。

#### Scenario: Tooltip 布局调整
- **前提** 用户查看 Fav 按钮的 Tooltip
- **当** Tooltip 显示时
- **那么** 布局应为 4 列：图标 | 级别名称 | 缓存小时数 | 描述
- **并且** 级别名称列的最小宽度应增加以适应英文 "No Demand" 不换行

#### Scenario: 缓存小时数显示逻辑
- **前提** 系统已获取当前 Ware 的缓冲设置 (AH/BH) 及产出/消耗状态
- **当** 渲染 "缓存小时数" 列时
- **那么** 如果存在产出和消耗，显示 "AH + BH" (如 "12h + 1h")
- **并且** 如果仅存在产出，显示 "AH" (如 "12h")
- **并且** 如果仅存在消耗，显示 "BH" (如 "1h")

#### Scenario: 描述文本动态化
- **前提** 系统已加载翻译文件并拆分了缓冲描述 Key
- **当** 渲染 "描述" 列时
- **那么** 如果仅有产出，显示 "Long Buffer" 或 "Short Buffer" (无 Resource 后缀)
- **并且** 如果有消耗，则根据情况附加 "+ Resource Buffer"
- **并且** 描述文本应准确反映当前的缓冲策略组合
