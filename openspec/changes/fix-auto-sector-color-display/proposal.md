# 修复分组颜色清空与覆盖尺寸

## Why
颜色picker消费与SVG绘制均未落实当前规范，M3.2严格断言已失败。

## What Changes
按真实picker事件把显式透明清空为undefined，保持提交/重载；coverage填色六边形采用2/3半径。

## Impact
SectorGroupCard颜色事件消费与MapSectorGroupColorLayer，必要局部presenter；独立Unit及M3.2新构建复验。
