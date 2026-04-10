# X4 Sector Specification

## Purpose
调整星区总览在 stand-alone binding 后的职责：empire 不再提供星区管理，save-binding 的星区管理由 binding Step 2 承担，总览态仅保留布局占位以稳定右侧资源视图。

## MODIFIED Requirements

### Requirement: Sector Management Panel in Overview

系统 MUST 在总览态移除星区管理面板内容，但保留其布局占位。

#### Scenario: 用户查看 empire 总览
- **前提** 用户位于量化生产总览态
- **当** 系统渲染总览布局
- **那么** 系统 SHALL NOT 显示星区创建、重命名、排序、连接或空间站分配管理入口
- **并且** 系统 SHALL 保留原星区管理面板所在区域的布局占位
- **并且** 右侧资源视图 SHALL NOT 因星区管理面板移除而横向扩张

#### Scenario: 用户使用 save-binding 数据源
- **前提** 用户在量化生产中选择 `save-binding` 数据源
- **当** 用户需要管理 binding 星区
- **那么** 系统 SHALL 引导用户使用 save binding Step 2
- **并且** SHALL NOT 在星区总览占位区域提供重复的 binding group 管理入口
