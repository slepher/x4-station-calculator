# active-binding-archive 需求

## 目标

绑定追踪 GUID（`selectedArchiveTime = null`）时，自动选择该 GUID 下**最新的有效存档**，而非最新的存档。消除持久化 `isValid`/`isCompatible` 快照导致的数据与实现不匹配问题。

## 已确认方案（审核重点）

### 存档选择逻辑

- `getLatestArchiveMetaForGuid` 从 `savedArchivesState.list` 中筛选 `guid` 匹配的条目后，必须**运行时校验** `parser_version` 是否为当前版本，而非依赖存储的 `meta.isValid`。
- 实现：`isArchiveParserVersionValidByString(item.parser_version)` 替代 `item.isValid`。

### isValid/isCompatible 不持久化

- `ArchiveMeta` 类型中删除 `isValid` 和 `isCompatible` 字段。
- `buildArchiveMeta` 不再写入 `isValid` 和 `isCompatible`。
- `createStubArchiveFromMeta` 运行时计算：
  - `isValid` ← `isArchiveParserVersionValidByString(meta.parser_version)`
  - `isCompatible` ← `normalizeVersion(meta.version) === normalizeVersion(currentVersion)`
- `buildArchiveGroups` 接受 `currentVersion` 参数，由 `rebuildArchivesFromState` 传入 `gameDataStore.currentVersion`。
- `SaveArchive.isValid` / `SaveArchive.isCompatible` 保留（全量存档的运行时字段，加载/导入时设置）。

### UI 绑定图标

- `MapSaveArchiveList.getLatestTime` 改为在 `group.saves` 中取最新有效存档的时间，而非按时间排序取第一条。
- 实现：`group.saves.find(s => s.isValid)?.meta.time` 替代 `group.saves[0]?.meta.time`。

### 测试

- 单元测试：`migrateEmpireStateToCurrent` 移除 `activeStationId`、`sectors`、`sectorLinks`、`sectorId`、`location`。
- E2E 测试：两个同 GUID 存档（新无效 parser=v4、旧有效 parser=v5），验证绑定选中旧有效存档、空间站正常载入、地图面板显示无效标记。

## 边界

### In Scope

- `getLatestArchiveMetaForGuid` 筛选逻辑修复
- `ArchiveMeta` 删除 `isValid`/`isCompatible`
- `createStubArchiveFromMeta` 运行时计算 isCompatible
- `MapSaveArchiveList.getLatestTime` 修复
- E2E 测试验证

### Out of Scope

- `selectedArchiveTime` 固定时间戳路径（`selectArchive`）的存档选择逻辑
- 存档导入/导出中的版本兼容逻辑
- `SaveArchive.isValid`/`.isCompatible` 的运行时设置逻辑

## 验收标准（DoD）

1. `getLatestArchiveMetaForGuid` 使用 `isArchiveParserVersionValidByString` 做运行时校验，而非 `item.isValid`。
2. `ArchiveMeta` 类型不再包含 `isValid` 和 `isCompatible`。
3. `createStubArchiveFromMeta` 运行时计算 `isCompatible`，不依赖 `meta.isCompatible`。
4. `MapSaveArchiveList.getLatestTime` 返回最新有效存档的时间。
5. E2E 测试通过：两个存档（新无效、旧有效）场景下绑定选中有效存档。
6. 无 TypeScript 编译错误。
7. 构建通过（`npm run build`）。

## 未决项

无
