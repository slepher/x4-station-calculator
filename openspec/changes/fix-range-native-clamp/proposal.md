# 同步双阶段滑块原生值

## Why
重复越界input只emit相同的规范化值，父prop不变时不会触发DOM回写，原生控件状态残留越界值。

## What Changes
在现有共享输入规范化路径同步原生值，input和commit复用；保留事件生命周期、全宽max及数量政策。

## Impact
仅X4DualPhaseRangeSlider及聚焦Unit。影响Storage的四种物品和Fit调用者，新构建后原M10.3拖动及有限消费者验证。
