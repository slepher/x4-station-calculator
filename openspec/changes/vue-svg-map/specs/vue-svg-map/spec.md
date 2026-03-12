# Vue SVG Map Specification

## Purpose
将地图页升级为 Vue 组件渲染 SVG，并在图内提供可扩展交互与 i18n 标签能力。

## ADDED Requirements

### Requirement: Vue-driven SVG Rendering
系统 MUST 使用 Vue 组件按 `maps.json` 渲染地图 SVG 图元，而非仅依赖静态图片渲染。

#### Scenario: 地图页渲染由组件驱动
- **前提** 用户进入 `maps` 视图
- **当** 地图组件挂载
- **那么** 系统 SHALL 通过 Vue 组件生成 `<svg>` 与地图图元
- **并且** SHALL 不依赖静态图片内置文本作为唯一名称来源

### Requirement: NameId-based I18n Labels
系统 MUST 基于 `nameId` 显示地图标签，并随当前语言实时切换。

#### Scenario: 当前语言存在翻译
- **前提** 某地图实体存在 `nameId` 且当前语言包包含该 key
- **当** 标签渲染
- **那么** 系统 SHALL 显示当前语言文本

#### Scenario: 当前语言缺失翻译
- **前提** 当前语言包缺失某 `nameId`
- **当** 标签渲染
- **那么** 系统 SHALL 按 `name -> nameId` 回退显示

#### Scenario: 语言切换实时生效
- **前提** 地图已渲染完成
- **当** 用户切换界面语言
- **那么** 系统 SHALL 在不重新生成静态 SVG 文件的前提下更新标签文本

### Requirement: Map Zoom Constraints
系统 MUST 提供满足约束的地图缩放行为。

#### Scenario: 最小缩放适配宽度
- **前提** 地图视口尺寸已知
- **当** 缩放值为最小
- **那么** 系统 SHALL 使地图宽度适配视口宽度

#### Scenario: 最大缩放达到 cluster 半屏目标
- **前提** 地图视口高度已知
- **当** 缩放值为最大
- **那么** 系统 SHALL 使单个 cluster 视觉高度约等于半屏高度
- **并且** SHALL 支持在该结果基础上应用最大缩放倍率系数（当前为 2x）

#### Scenario: 左下角缩放条
- **前提** 地图组件已加载
- **当** 用户查看地图控制区
- **那么** 系统 SHALL 在左下角显示比例尺缩放条

### Requirement: Pointer Interactions Inside SVG
系统 MUST 在地图视图内支持拖拽平移与滚轮缩放交互。

#### Scenario: 鼠标拖拽平移
- **前提** 用户按住鼠标左键并在地图上移动
- **当** 拖拽发生
- **那么** 系统 SHALL 平移地图视图

#### Scenario: 滚轮缩放锚点
- **前提** 用户在地图区域滚动鼠标滚轮
- **当** 缩放发生
- **那么** 系统 SHALL 以鼠标当前位置为缩放锚点

### Requirement: Label And Stargate Visual Calibration
系统 MUST 提供一致的标签与星门视觉标定策略。

#### Scenario: 单 sector 标签字号
- **前提** cluster 仅包含一个 sector
- **当** 渲染标签
- **那么** 系统 SHALL 使用 `18px` 标签字号

#### Scenario: 多 sector 标签字号
- **前提** cluster 包含多个 sector
- **当** 渲染标签
- **那么** 系统 SHALL 按 `14 * sector_radius_ratio` 计算字号
- **并且** SHALL 施加最小字号下限 `8px`

#### Scenario: 标签顶部基线定位
- **前提** 渲染 sector 标签
- **当** 计算文字对齐
- **那么** 系统 SHALL 使用顶部基线对齐（`text-before-edge`）以降低跨语言高度差带来的偏移

#### Scenario: 星门图元放大
- **前提** 渲染 cluster gate 点位与跨 cluster 连线
- **当** 应用视觉样式
- **那么** 系统 SHALL 将相关半径与线宽统一按 `1.5x` 放大

### Requirement: Entry Compatibility
系统 MUST 保持现有地图入口兼容。

#### Scenario: Toolbar maps tab
- **前提** 用户位于主工作区
- **当** 点击 `maps` tab
- **那么** 系统 SHALL 进入地图视图并展示 SVG 地图

#### Scenario: URL 参数入口
- **前提** 地址栏包含 `?router=maps`
- **当** 应用初始化
- **那么** 系统 SHALL 直接进入地图视图
