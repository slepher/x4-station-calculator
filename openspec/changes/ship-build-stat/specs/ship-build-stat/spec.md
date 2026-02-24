# Ship Build Stat Specification

## Purpose
为“船只建造”中列属性区新增双档位展示（简略/详细），并将字段集合分别对齐到两张参考截图；在无详细数据源阶段提供可回归的占位展示，同时移除固定高度限制。

## ADDED Requirements

### Requirement: Ship Stats Mode Switch

#### Scenario: Render Two Modes In Middle Stats Panel
- **前提**：用户已在“船只建造”视图中选择任意飞船。
- **当**：页面渲染中列“配装后船体属性”区域。
- **那么**：显示 `简略` 与 `详细` 两个档位切换入口。

#### Scenario: Switch Between Summary And Detail
- **前提**：中列属性区可见。
- **当**：用户点击任一档位按钮。
- **那么**：中列属性区切换到对应档位内容。

### Requirement: Summary Metrics Match Preview-2

#### Scenario: Show Summary Field Set
- **前提**：用户处于 `简略` 档位。
- **当**：属性列表渲染。
- **那么**：字段集合与截图 2 对齐。
- **并且**：至少包含 `船体/护盾/雷达范围/武器爆发输出值/炮塔平均输出值/集装仓储/M级泊位数量/M级飞船容量/S级泊位数量/S级飞船容量`。
- **并且**：右侧至少包含 `速度/助推器助推速度/巡航速度/船员/单位/导弹/可投放设备/干扰弹`。

### Requirement: Detail Metrics Match Preview-1

#### Scenario: Show Detail Field Set
- **前提**：用户处于 `详细` 档位。
- **当**：属性列表渲染。
- **那么**：字段集合与截图 1 对齐。
- **并且**：覆盖 `简略` 全部字段。
- **并且**：新增字段至少包含 `再充率/再充延迟/编组平均护盾容量/武器持续性输出值/固体仓储/液体仓储/冷凝态仓储/加速/助推加速度/助推时长/助推回充率/巡航加速度/巡航加力时间/平移速度/平移加速度/水平转向/俯仰/横滚`。

### Requirement: Detail Placeholder Without Data Source

#### Scenario: Show Placeholder Values In Detail Mode
- **前提**：详细属性数据源尚未接入。
- **当**：用户切换到 `详细` 档位。
- **那么**：详细字段按“字段名 + 单位 + 占位值（如 `--`）”展示。

#### Scenario: Show Pending Hint In Detail Mode
- **前提**：详细属性数据源尚未接入。
- **当**：用户处于 `详细` 档位。
- **那么**：界面显示“详细属性待接入”提示文案。

### Requirement: Adaptive Height In Stats And Selection Areas

#### Scenario: Middle Stats Panel Uses Adaptive Height
- **前提**：中列属性区已渲染。
- **当**：显示简略或详细内容。
- **那么**：中列属性区不使用固定高度限制。

#### Scenario: Selected Summary Area Uses Adaptive Height
- **前提**：用户已选择飞船并显示已选详情区。
- **当**：详情区渲染。
- **那么**：详情区不使用固定高度限制。

### Requirement: Localization And Testability

#### Scenario: Localized Labels For Mode And Pending Hint
- **前提**：应用启用多语言。
- **当**：渲染档位按钮与待接入提示。
- **那么**：显示文本来自 i18n 键。

#### Scenario: Stable Test Locators For Stats Mode
- **前提**：需要自动化回归档位切换。
- **当**：页面渲染属性区。
- **那么**：为属性区与档位按钮提供稳定 `data-testid`。
