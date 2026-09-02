# tier-upgrade 实施任务

## 1. Ware 网络与导出规则

- [x] 1.1 在 `scripts/x4_data_processor.py` 中从全部 recipes 推导生产网络 Ware 集合。
- [x] 1.2 仅为生产网络成员计算数值 Tier，并为其他导出商品写入 `tier: null`。
- [x] 1.3 在 Ware 导出对象中写入必填 `transmutable` boolean，不让该字段参与 Tier 判定。
- [x] 1.4 在 `wares_data` 导出边界按 ID 排除 `nividiumgems`，保留原始索引与 recipe 解析。

## 2. 回收模块交替产率

- [x] 2.1 收集生产模块 queue 中全部有效 recipes，并以完整序列总时长统一换算 outputs/inputs 小时率。
- [x] 2.2 将多 queue 模块的 `cycleTime` 写为完整交替序列时长，单 queue 模块保持原行为。
- [x] 2.3 保留 `X4Module.outputs`/`inputs` 聚合模型，不增加 recipe 选择或持久化快照结构。

## 3. 类型与 Logic Flow 边界

- [x] 3.1 将 `X4Ware.tier` 调整为 `number | null`，新增必填 `transmutable: boolean`，同步完整 Ware 构造数据。
- [x] 3.2 在 Logic Flow 候选、预览、节点创建和上游展开入口明确拒绝 `tier === null` 的 Ware。
- [x] 3.3 在 Logic Flow 方案恢复与 BuildPlan snapshot 重建时安全跳过不存在或无 Tier 的 Ware，并保留 warning 行为。

## 4. Station 与 BuildPlan 一致性

- [x] 4.1 保持 Logic Flow 到 Station/BuildPlan 的 module ID 传播，确认目标环境从当前版本 `modulesMap` 读取全部聚合 outputs/inputs。
- [x] 4.2 清理生产流路径中对模块小时率的二次 `cycleTime` 换算，使 Station 与 BuildPlan 使用相同单位。
- [x] 4.3 保持 empire、flow 与 build-plan 持久化结构及 storage version 不变。

## 5. 静态数据生成

- [x] 5.1 使用现有全版本入口重新生成 8.0 Diplomacy 与 9.0 Empire 游戏数据。
- [x] 5.2 确认生成结果满足 Tier、transmutable、nividiumgems 排除及回收模块交替产率契约。

## 6. 构建验证

- [x] 6.1 运行 `npm run build`。
- [x] 6.2 若存在编译错误，修复后重复构建直至通过或形成明确 blocker。
