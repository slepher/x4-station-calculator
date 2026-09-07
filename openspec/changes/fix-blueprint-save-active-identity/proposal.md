# 修复保存后的活动帝国身份

## Why
saveEmpire只同步savedEmpires.activeId，初始化优先消费activeView.activeEmpireId，两份身份不一致。

## What Changes
在领域保存事务同步活动帝国身份，审查另存生成新站点ID时的活动站点与派生缓存；不通过切换UI或loadEmpire掩盖问题。

## Impact
仅Blueprint store与focused Unit，M15.1和必要M7.1消费者新构建后验证。
