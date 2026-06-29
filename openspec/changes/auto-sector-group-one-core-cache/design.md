# auto-sector-group-one-core-cache Design

## 总览

本 change 将 auto-sector-group 的星区跳数距离从运行时重复计算改为版本化离线缓存。数据生成阶段为每个游戏版本输出全图 5 跳可达表；运行时 game data store 加载该表，核心算法只做查表和业务过滤。

页面层不获得新的交互语义。Vue/presenter 继续沿用当前 assignment、pill、jumpRange 和确认流程，只把底层距离来源切换为 `sector_reachability.json`。

## 数据文件

新增文件：

```text
src/assets/x4_game_data/<folderName>/data/sector_reachability.json
```

JSON shape：

```ts
export type SectorReachability = Record<string, Record<string, number>>
```

示例：

```json
{
  "cluster_01_sector001_macro": {
    "cluster_01_sector001_macro": 0,
    "cluster_02_sector001_macro": 1
  }
}
```

约束：

- source key 为地图中的 sector macro。
- target key 为 `0..5` 跳内可达 sector macro。
- distance 必须是整数。
- target 不包含 5 跳外星区。
- source 自身必须存在，值为 0。

## 生成脚本

新增 `scripts/generate_sector_reachability.ts`。

运行方式：

```bash
vite-node scripts/generate_sector_reachability.ts --version 8.0
vite-node scripts/generate_sector_reachability.ts --version 9.0
```

参数解析：

- 使用 `getopts`。
- 支持 `-h` / `--help`。
- 支持 `--version <version>`。
- `--version` 缺失时应报错并打印 usage。
- version 到 folderName 的解析应复用项目现有版本配置或既有数据目录约定，避免硬编码仅支持当前两个目录。

生成步骤：

1. 根据 `--version` 找到目标 `src/assets/x4_game_data/<folderName>/data/maps.json`。
2. 使用现有星区图构建逻辑生成有效双向 sector graph。
3. 对每个 sector 执行最大 5 跳 BFS。
4. 写出稳定排序的 JSON，减少无意义 diff。
5. 输出生成统计：版本、source 数量、edge/target 数量、输出路径。

## 距离语义

距离语义必须与现有 auto-sector-group 保持一致：

- 同一 cluster 内 sector 间移动不增加 jump。
- 跨 cluster 可达边增加 1 jump。
- 单向 superhighway 不作为双向可达边。
- 只记录 `distance <= 5`。

运行时查表语义：

```ts
const distance = reachability[sourceSectorMacro]?.[targetSectorMacro]
```

- `typeof distance === 'number'`：target 在 source 的 5 跳能力范围内。
- `distance === undefined`：target 超过 5 跳或不可达。

## Game Data 接入

`GameDataFiles` 增加 `sectorReachability` 字段，加载 `sector_reachability.json`。

`useGameDataStore` 暴露当前版本的 reachability 数据，供 auto-sector-group presenter/store 调用。该数据属于 game data，不属于 save binding 或用户 draft。

## Auto Sector Group 接入

核心计算应将 reachability 作为依赖传入，而不是在 Vue 组件内拼装距离。

需要替换的距离使用场景：

- `buildAssignmentResult()` 生成 current coverage hit 与 extension option。
- standalone upsert 后派生其他 assignment options。
- jumpRange 修改后重建受影响 assignment。
- `computeGroupGraph()` / MST 候选边距离判断。
- Sector group card 统一 pill 中 candidate 与 connected candidate 的距离判断。
- confirm 写入 coverage jump entry 时的 jump 值生成。

保持不变的行为：

- 所有当前命中 group 都作为 options。
- 无当前命中时，只保留 5 跳内最近扩展距离层。
- Standalone 始终最后。
- 显式 Standalone 选择按 `sectorMacro` upsert。
- assignment card 身份和排序保持现有规则。

## 范围值处理

业务上 `jumpRange` 和 `bridgeSearchJumpRange` 的有效范围为 `0..5`。

实现时应在计算入口进行 clamp，确保持久化旧值大于 5 时不会扩大运行时可达能力。UI 如果已有选择范围大于 5，应收敛到 5，但不得改变页面布局和操作流程。

## 失败处理

缺少 `sector_reachability.json` 是数据生成缺失，不应静默退回旧 BFS 并掩盖问题。开发阶段可以通过错误信息提示运行生成脚本；生产构建应在缺文件时失败。

## 设计取舍

- 不采用运行时 lazy cache：手动添加非玩家星区要求任意地图星区都可作为 hub source，离线全图缓存能天然覆盖。
- 不将缓存并入 `maps.json`：独立 JSON 更便于生成、审查和单独验证。
- 不做全距离矩阵：只存 5 跳内 target，符合游戏硬限制并控制文件体积。
