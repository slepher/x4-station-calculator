# auto-sector-group-one-virtual-station Proposal

## Why

Map binding 需要在自动分组阶段直接编辑虚拟生产空间站，而不是依赖旧 Step 3 页面直接修改 binding。现有 Step 3 的虚拟空间站拖拽路径也缺少 draft 化、重新计算保留、未分组提示和 `lockedWares` / `warePriority` 复制约束。

## What Changes

- 新增 Map-only Virtual Station tab。
- 在 store 中维护 virtual station drafts，并从现有 binding 无 `saveStationCode` station plans 初始化。
- 支持 blueprint station / 空白空间站拖拽创建 virtual station draft。
- 支持已放置 virtual station 再拖动、删除和按当前 groups 实时重算归属。
- 提交时先应用 auto groups，再同步 virtual station drafts。
- 保留 virtual trade station 地图拖动能力，但只更新 group draft position，不修改 `sectorMacro`。

## Impact

- 影响 Map binding 自动分组面板。
- 影响 virtual station 的 draft、overlay 和提交应用数据流。
- 不迁入 save station 绑定、save station 导入、trade station 绑定或 station plan 详细编辑。
