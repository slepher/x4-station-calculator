# Button Tooltip Specification

## Purpose
Optimize the interaction and content of Favorite and Lock buttons in StationWareflow, ensuring tooltips persist on click and displaying detailed buffer information based on production/consumption context.

## Requirements

### Requirement: Tooltip Persistence
系统SHALL确保 Fav (优先级) 和 Lock (锁定) 按钮的 Tooltip 在被点击时不会自动消失。

#### Scenario: 切换状态时 Tooltip 保持
- **前提** 用户将鼠标悬停在 Fav 或 Lock 按钮上，Tooltip 已显示
- **当** 用户点击该按钮切换状态 (如改变优先级或锁定状态)
- **那么** Tooltip 应当保持显示，并即时更新内容反映新状态
- **并且** 只有当鼠标移开时 Tooltip 才消失

### Requirement: Tooltip Placement
当用户悬停在收藏按钮（FavoriteButton）上时，tooltip **MUST** 向左侧弹出；当用户悬停在锁定按钮（LockButton）上时，tooltip **MUST** 向右侧弹出。

#### Scenario: Hover Favorite Button
- **前提** StationWareFlow 页面已渲染收藏按钮
- **当** 用户将鼠标悬停在收藏按钮上
- **那么** tooltip 向左侧弹出
- **并且** tooltip 内容与样式保持不变

#### Scenario: Hover Lock Button
- **前提** StationWareFlow 页面已渲染锁定按钮
- **当** 用户将鼠标悬停在锁定按钮上
- **那么** tooltip 向右侧弹出
- **并且** tooltip 内容与样式保持不变

### Requirement: No Behavior Regression
变更 tooltip 弹出方向时，按钮点击与禁用行为 **MUST** 保持原有一致。

#### Scenario: Button Interaction Unchanged
- **前提** 收藏/锁定按钮具备可点击与禁用态
- **当** 用户执行点击、切换状态或触发禁用态操作
- **那么** 行为与变更前保持一致

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
- **那么** 如果仅有产出，显示 "Long" 或 "Short" (无 Res 后缀)
- **并且** 如果有消耗，则根据情况附加 "+ Res" (使用 "Res" 代替 "Resource Buffer" 以节省空间)
- **并且** 描述文本应准确反映当前的缓冲策略组合

### Requirement: 文本与布局优化
系统SHALL优化 Tooltip 的文本长度和列宽，以适应有限的显示空间。

#### Scenario: 英文文本精简
- **前提** 当前语言为英文
- **当** 显示缓冲类型描述时
- **那么** 应使用缩写形式: "Long Buffer" -> "Long", "Short Buffer" -> "Short", "Resource Buffer" -> "Res"
- **并且** 组合显示时应为 "Long + Res" 格式

#### Scenario: 列宽自适应
- **前提** Tooltip 正在渲染
- **当** 计算列宽时
- **那么** Label 列应至少为 80px 以容纳 "No Demand"
- **并且** Hours 列应至少为 70px 以容纳 "12h + 2h"
- **并且** 整体布局应紧凑，避免不必要的留白或换行
