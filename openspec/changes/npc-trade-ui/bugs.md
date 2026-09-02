# Bugs

## 2026-09-01 virtual-station-group-key-mismatch

- 症状：
  - 玩家空间站选择器的每个 sector group 通常只显示唯一 `tradeStation`，已整理的 virtual `stationPlans` 缺失。
- 根因：
  - `resolveVirtualStationGroupId()` 将 auto-group 临时 `group.id` 写入 `stationPlan.groupId`，但 binding group 的稳定键与所有读取方均使用 `group.sectorMacro`。
- 修复方向：
  - draft 写入 binding 时统一使用命中 group 的 `sectorMacro`，不在 NPC presenter 中兼容错误 ID。
- 回归检查：
  - 当前 nested store workflow 没有可独立调用的正确单元测试 seam；在 `/x4:verify` 使用 live-binding fixture 验证同组多个 station options。

## 2026-09-01 npc-trade-station-selector-source-and-label

- 症状：
  - 左侧 sector group 显示多个玩家空间站，市场报价二级菜单却只有 tradeStation。
  - 空间站 option 重复显示相同 station/sector 名，选中后仍保留“选择空间站”占位项。
  - 缺少持久化 position 的虚拟站显示距离未知。
- 根因：
  - NPC presenter 自行读取 `stationPlans + tradeStation`，没有复用左侧 `orderedStationsBySector`。
  - Vue 无条件渲染占位项，并在 station label 后再次拼接 sector label。
  - 虚拟站只读取持久化 position，没有使用地图星区中心。
- 修复方向：
  - 复用左侧分组结果，按实际站 code 去重；option 只渲染一次 presenter label，选中后隐藏占位项；虚拟站从有效 map sector 数据计算中心，不以 `(0,0,0)` fallback。
- 回归检查：
  - `tests/unit/npc-trade-ui/npc-trade-workbench.spec.ts` 锁定 option 标签和占位项行为；构建校验 presenter/store 类型连接。

## 2026-09-01 npc-trade-jump-cache-horizon

- 症状：
  - 最大跳数输入 13 后，玩家买入仍可能显示没有匹配报价。
- 根因：
  - UI 允许 0–99，但 presenter 只查询 `sector_reachability.json`；该静态缓存由 `MAX_REACHABILITY_JUMP = 5` 生成，超过 5 跳均被当成未知并过滤。
- 修复方向：
  - 市场报价复用 `mapSectorGraph.ts` 的动态图计算，静态缓存的 5 跳范围继续只服务原有预计算用途；`X4NumberInput` 不设置最大值。
- 回归检查：
  - `tests/unit/npc-trade-ui/npc-trade-jumps.spec.ts` 验证 7 跳目标在范围 5 时不可达、范围 13 时距离为 7。
