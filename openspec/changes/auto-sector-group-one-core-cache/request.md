# auto-sector-group-one-core-cache Request

## 目标

为自动星区分组引入离线生成的 5 跳星区可达缓存，避免运行时在 assignment、pill、connection 等路径重复计算星区距离。缓存以游戏硬设定为边界：负责运输的船只自动导航最多 5 跳，因为 5 星是游戏中最高技能，每星提供 1 跳导航能力。

本 change 只改变距离数据来源和数据生成流程，不改变当前页面显示结构、assignment 操作逻辑、pill 操作逻辑或确认流程。

## 已确认方案（审核重点）

### 离线缓存生成

- 新增 `scripts/` 下的 TypeScript 脚本，使用 `vite-node` 运行。
- 脚本必须使用 `getopts` 解析参数。
- 脚本必须支持 `--version <version>` 参数，并根据版本解析目标数据目录。
- 脚本输出 `sector_reachability.json` 到对应版本目录的 `data/` 下，例如 `src/assets/x4_game_data/8.0-Diplomacy/data/sector_reachability.json`。
- 脚本必须复用当前项目已有的星区图构建/距离语义，不另起一套不一致的图算法。
- 缓存覆盖该版本地图中的所有星区，包括没有玩家空间站的非玩家星区。
- 缓存只记录 `0..5` 跳内可达星区，超过 5 跳或不可达的目标不得写入。
- 缓存必须按源星区组织，形状为 `sourceSectorMacro -> targetSectorMacro -> jumpDistance`。
- 生成逻辑必须沿用 core change 的规则：单向 superhighway 不得作为双向可达边。

### 运行时读取与使用

- Game data 加载流程必须加载 `sector_reachability.json`，并将其作为当前版本 game data 的一部分提供给领域计算。
- 自动星区分组的 assignment、coverage/candidate 判断、connected candidate 判断和 MST/bridge 候选距离判断应优先使用该缓存。
- 运行时不得为了 auto-sector-group assignment 视图再做全图或重复 BFS。
- 若 `reachability[source][target]` 不存在，领域语义为“超过 5 跳或不可达”，不得生成 absorb option 或 connected candidate。
- 手动添加非玩家星区 hub 时不需要运行时补算；因为离线缓存已经包含所有地图星区。

### 页面行为保持

- 当前页面显示及操作逻辑必须保持不变。
- Assignment card 的生成入口、排序、option 展示、Standalone 作为最后 option、显式选择 Standalone 的幂等语义都保持不变。
- Sector group card 的 coverage、candidate、connected pill 行为保持不变。
- 用户修改 jumpRange、点击 coverage `×`、candidate `+`、transfer `→`、connected `+ / ×` 后，仍按现有流程同步 assignment。
- 本 change 不新增页面、tab、按钮、提示或新的交互模式。

### 5 跳领域边界

- 5 跳是运输船自动导航能力上限，不是单纯 UI 过滤阈值。
- 超过 5 跳的 group 不得生成 absorb option。
- 超过 5 跳的 group anchor pair 不得作为自动连接候选。
- `jumpRange` 与 `bridgeSearchJumpRange` 的有效业务范围不得超过 5。
- 如果已有持久化数据中存在大于 5 的范围值，运行时计算必须按 5 处理；持久化修正是否另行迁移不属于本 change 的首要目标。

## 边界

### In Scope

- 新增 TS 生成脚本和参数解析。
- 基于现有地图数据生成 `sector_reachability.json`。
- Game data store 加载并暴露 reachability 数据。
- auto-sector-group 核心计算改为使用 reachability 缓存。
- 保持 assignment、pill、connection、bridge 的现有展示与操作流程。
- 增加必要类型定义与构建校验。

### Out of Scope

- 不重构 auto-sector-group 页面布局。
- 不改变 assignment card UI 样式和操作文案。
- 不改变地图侧栏、颜色渲染、Live/Map draft 生命周期。
- 不修改 Rust WASM parser。
- 不重新定义运输船技能系统，只使用已确认的 5 跳硬限制。
- 不做运行时全图 NxN 预计算。

## 验收标准（DoD）

- `vite-node scripts/<script-name>.ts --version 8.0` 能为 8.0 数据目录生成 `sector_reachability.json`。
- `vite-node scripts/<script-name>.ts --version 9.0` 能为 9.0 数据目录生成 `sector_reachability.json`。
- 生成结果包含所有地图星区作为 source，包括非玩家星区。
- 每个 source 只包含 `0..5` 跳 target，且 source 到自身距离为 0。
- 运行时 auto-sector-group 使用缓存查距，5 跳外 sector 不再生成 absorb option 或 connected candidate。
- 页面显示结构和用户操作流程与本 change 前保持一致。
- `npm run build` 通过。

## 未决项

- TS 脚本文件名待实现时确定，建议使用 `scripts/generate_sector_reachability.ts`。
- 是否新增 package script 作为便捷入口待实现时确定；基础要求是 `vite-node` 直接运行脚本必须可用。
