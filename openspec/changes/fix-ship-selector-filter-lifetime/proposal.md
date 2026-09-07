# 修复选船筛选生命周期

## Why
Selector 的 v-if 卸载导致 local filters 和 immediate watcher 在重新进入时重置，违反已接受方案。

## What Changes
最小调整组件或筛选状态生命周期，保留同船级取消后的筛选；确认、跨船级取消和蓝图载入仍遵循现有显式规则。

## Impact
优先限制在 ShipBuildView 生命周期调整与聚焦验证；不改存储格式，不全面重构选船界面。
