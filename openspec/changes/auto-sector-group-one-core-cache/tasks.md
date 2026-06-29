# auto-sector-group-one-core-cache Tasks

## 1. 数据生成脚本

- [x] 新增 `scripts/generate_sector_reachability.ts`
- [x] 使用 `getopts` 支持 `--version <version>` 和 `--help`
- [x] 解析版本到 `src/assets/x4_game_data/<folderName>/data/maps.json`
- [x] 复用现有 sector graph 构建逻辑，保持单向 superhighway 排除规则一致
- [x] 对所有地图 sector 生成 `0..5` 跳 reachability
- [x] 输出稳定排序的 `sector_reachability.json`
- [x] 打印版本、source 数量、target 数量、输出路径等生成统计

## 2. Game data 加载

- [x] 增加 `SectorReachability` 类型定义
- [x] 在 `GameDataFiles` 中加入 `sectorReachability`
- [x] 在 `loadGameDataFiles()` 中加载 `sector_reachability.json`
- [x] 在 game data store 中暴露当前版本 reachability

## 3. Auto-sector-group 距离接入

- [x] 新增 reachability 查表 helper，统一返回 `number | null`
- [x] `buildAssignmentResult()` 改为使用 reachability 查距
- [x] standalone upsert 和派生 options 改为使用 reachability 查距
- [x] jumpRange 变更后的 assignment 重建改为使用 reachability 查距
- [x] `computeGroupGraph()` / MST 候选边改为使用 reachability 查距
- [x] confirm 写入 coverage entries 时使用 reachability 写入 jump
- [x] 移除 auto-sector-group assignment 路径中的重复运行时 BFS

## 4. Presenter / Vue 数据传递

- [x] presenter 从 game data store 读取 reachability 并传入领域函数
- [x] Sector group card 统一 pill 距离判断改为使用 reachability
- [x] 保持现有页面布局、按钮、card、pill 和 option 操作流程不变
- [x] 将 `jumpRange` 和 `bridgeSearchJumpRange` 的有效计算范围限制到 `0..5`

## 5. 构建验证

- [x] 运行 `vite-node scripts/generate_sector_reachability.ts --version 8.0`
- [x] 运行 `vite-node scripts/generate_sector_reachability.ts --version 9.0`
- [x] 检查两个版本均生成 `data/sector_reachability.json`
- [x] 运行 `npm run build`
