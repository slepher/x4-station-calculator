# 修复站点 DLC UI

## Why
M16.2 浏览器证据显示标签与禁用输入不符合 station-dlc-tag 规范。

## What Changes
使用已有 DLC 翻译名称；数量输入消费明确的 inactiveByDlc 状态。相关展示组装归 presenter。

## Impact
StationPlanningItem 与其 presenter，聚焦 Unit；原 M16.2 E2E 在新构建后复验。计算过滤继续保留独立失败。
