# production-ui Specification

## Purpose

扩展 live save-binding 工作台的固定导航，使用户可以进入市场报价页面。

## ADDED Requirements

### Requirement: Live Binding Market Offers Navigation

系统 SHALL 在 live save-binding 侧栏提供“市场报价”固定入口，并将其路由到独立 workbench mode。

#### Scenario: 入口位置

**前提** 用户处于 live save-binding 工作台
**当** 侧栏固定入口渲染
**那么** “市场报价” MUST 位于“总览”之后
**并且** “市场报价” MUST 位于“蓝图配方”之前

#### Scenario: 切换市场报价页面

**前提** 用户处于 live save-binding 工作台
**当** 用户点击“市场报价”
**那么** active binding workbench mode MUST 切换为市场报价
**并且** 内容区域 MUST 渲染 NPC trade workbench

#### Scenario: 蓝图帝国不显示入口

**前提** 用户处于 blueprint/empire 工作台
**当** 侧栏固定入口渲染
**那么** 系统 MUST NOT 显示“市场报价”入口
