## Why

当前 `StationWareflow` 中的 Fav (优先级) 和 Lock (锁定) 按钮在点击切换状态时，Tooltip 会自动消失，导致用户无法直观确认状态变更结果。此外，Fav 按钮的 Tooltip 信息在英文环境下存在换行问题，且缺乏关键的缓冲小时数 (AH/BH) 信息，使得用户无法准确判断当前的生产/消耗缓冲策略。

## What Changes

*   **交互优化**: Fav 和 Lock 按钮的 Tooltip 点击后不再自动隐藏 (`hideOnClick: false`)。
*   **布局增强**: Fav 按钮 Tooltip 改为 4 列布局，新增一列显示具体的缓冲小时数。
*   **信息丰富化**: 根据产出/消耗状态，动态显示 AH (产品缓冲) 和 BH (资源缓冲) 的组合。
*   **动态描述**: Tooltip 的描述文本根据是否有消耗动态移除冗余的 "+Resource Buffer" 字样。
*   **样式修复**: 增加 Label 列宽度，修复英文 "No Demand" 换行问题。

## Capabilities

### New Capabilities
<!-- Capabilities being introduced. Replace <name> with kebab-case identifier (e.g., user-auth, data-export, api-rate-limiting). Each creates specs/<name>/spec.md -->
- `button-tooltip`: 增强按钮交互体验和信息展示，包括 Tooltip 持久化和动态缓冲信息显示。

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use existing spec names from openspec/specs/. Leave empty if no requirement changes. -->

## Impact

*   `src/components/common/FavoriteButton.vue`: 核心逻辑修改，包括 Tippy 配置、模板结构和 Props 扩展。
*   `src/components/StationWareFlow.vue`: 需要计算并传递 `hasConsumption` 等新 Props。
*   `src/locales/*.json`: 新增拆分后的缓冲描述翻译 Key。
