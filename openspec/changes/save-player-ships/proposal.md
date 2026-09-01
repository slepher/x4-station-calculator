## Why

存档导入目前没有保存玩家普通舰船，因而无法判断哪些运输船已被空间站或经济任务占用、哪些可以被运营规划复用。需要先把玩家舰船的可验证原始事实纳入 archive，并在 TypeScript 领域层统一派生可用性。

## What Changes

- Rust/WASM parser 从存档提取玩家舰船的身份、所在星区、货舱、指挥官/下属关系、默认行动准则和非默认命令队列。
- 通过连接与 subordinate group 交叉解析舰船的实际指挥官及 assignment role，区分空间站分配、舰队分配和未分配。
- TypeScript store/logic 根据 assignment 与 order facts 派生舰船活动和可用性；默认 `Wait` 视为保持位置基线，经济任务与已确认重复指令视为占用，只有等待类非经济指令的船视为可收回。
- 将 Rust archive parser schema 从 v10 升级到 v11，并同步 TypeScript 的当前 Rust schema 常量；legacy TypeScript parser v3 与 post-process v13 不变。
- 本 change 不接入 planner、presenter 或 Vue 页面；后续网页整合只消费这里形成的 archive 与领域状态。

## Capabilities

### New Capabilities

- `player-ship-availability`: 根据玩家舰船的分配与指令事实派生 assignment、activity 和 availability，供后续规划能力复用。

### Modified Capabilities

- `save-import`: Rust/WASM 存档导入新增玩家舰船原始快照，并更新 archive parser schema 版本。

## Impact

- Rust parser model/core/tests 与生成的 WASM。
- `SaveArchive` TypeScript 类型、Rust archive 版本校验及 archive 恢复测试。
- 玩家舰船领域 store/logic 及其单元测试。
- 不新增 IndexedDB 表，不改变现有 Vue/presenter，也不新增依赖。
