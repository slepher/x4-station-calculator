# 修复 Blueprint DLC 计算输入

## Why
Blueprint 计算依赖丢失 DLC 政策，Map 和 active station 二次计算都重新纳入禁用模块。

## What Changes
在 Blueprint store 统一建立受限模块库与计算模块输入，复用现有 Map 和分析函数；DLC 设置变化重建全部计划派生与聚合。

## Impact
仅 useBlueprintProductionStore 与聚焦 Unit；原始计划持久化不变，Live 和通用计算器不扩域。
