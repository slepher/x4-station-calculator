# 恢复船舶建材与性能的规范含义

## Why
共享建材分析漏读现有持久化字段；性能Vue既有公式及单位偏离已接受ship-build-stat定义。

## What Changes
HULL合同独立修共享分析中的hull数量/费用；STATS合同独立修两项面板指标。建造时间、方法选择、其他指标和装备详情接口不变。

## Impact
HULL影响getBuildAnalysis的船舶材料与build plan消费者。STATS影响同一面板的正常/预演比较。聚焦Unit后统一build，M10.4原失败及完整23验证。
