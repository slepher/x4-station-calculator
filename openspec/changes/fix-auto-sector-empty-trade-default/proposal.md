# 修复空交易站候选的默认选择

## Why
Presenter 对已知空候选数组直接continue，导致手动非玩家hub缺少明确要求的virtual默认值。

## What Changes
在共享默认选择入口按已知空候选业务状态设置virtual；复用已存在的reset语义，审查所有调用方。

## Impact
仅现有AutoSectorGroup presenter与focused Unit。Live/Map消费者由M3.1/M3.2原用例验证。
