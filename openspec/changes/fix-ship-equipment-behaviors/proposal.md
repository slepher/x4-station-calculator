# 修复船舶装备有效行为

## Why
M10.2 在真实UI上复现唯一候选补满/清空、group步长、turret/engine字段及travel摘要缺失。

## What Changes
两个独立实现合同：FIT修复target领域数量操作与presenter点击语义；DETAILS恢复既有计算数据的完整展示。无共享源码写入依赖，分别验证。

## Impact
Fit/store/presenter 与 Equipment/presenter 分别归属，旧测试及helper冻结，统一构建后独立E2E复验。布局争议不在范围内。
