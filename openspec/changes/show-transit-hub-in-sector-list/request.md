# show-transit-hub-in-sector-list Request

## 目标

星区列表（侧边栏 station 列表）中被选为 transit hub 的空间站不再被隐藏，照常显示为普通 station。

## 已确认方案

- 删除 `liveStationResolver.ts` 中 `deriveBindingStationsFromRecords()` 对 transit hub station 的排除逻辑。
- 运输栏 `Station` 分类的过滤逻辑保持不变（transit hub 在运输栏中已有 `Sector Group` 分类展示，不在 `Station` 分类重复出现）。
- transit hub station 在 sidebar 中会出现两次：一次是 `transit` 类型 tab，一次是 `station` 类型 tab。两者 ID 不同，不冲突。

## 边界

### In Scope

- 移除 `deriveBindingStationsFromRecords()` 中的 transit hub 排除逻辑。
- 更新相关 OpenSpec 文档。

### Out of Scope

- 不修改运输栏 `Station` 分类的过滤逻辑。
- 不修改其他 consumer 中与 transit hub 相关的逻辑。

## 验收标准（DoD）

- transit hub station 出现在侧边栏星区列表的 station 项中。
- `npm run build` 通过。
