# Station Tabs Specification

## Purpose
增强标签栏模块的交互能力，在保留标签切换与菜单行为的基础上支持空间站标签拖拽重排。

## MODIFIED Requirements

### Requirement: 分站标签 (Station Tabs)
每个分站 SHALL 对应一个动态标签：
- 显示分站名称和类型图标
- 选中状态有明显的背景色区分
- 支持右键菜单操作
- 支持拖拽重排空间站标签顺序

#### Scenario: 分站标签显示
- **前提** 帝国中存在分站
- **当** 用户查看标签栏时
- **那么** 每个分站 SHALL 显示为一个标签
- **并且** 标签 SHALL 显示分站名称和类型图标（如 🏭 工业、📦 补给）

#### Scenario: 切换分站
- **前提** 用户正在查看帝国总览或其他分站
- **当** 用户点击某个分站标签
- **那么** activeStationId SHALL 设为该分站 ID
- **并且** 内容区域 SHALL 显示该分站的三列布局视图

#### Scenario: 拖拽重排分站标签
- **前提** 帝国中存在多个分站
- **当** 用户将分站 A 标签拖拽到分站 B 标签之后
- **那么** 标签栏 SHALL 按新顺序展示分站标签
- **并且** 分站 A 与分站 B 在 `stations` 中的顺序 SHALL 同步更新
- **并且** activeStationId SHALL 继续指向拖拽前已激活的分站 ID
