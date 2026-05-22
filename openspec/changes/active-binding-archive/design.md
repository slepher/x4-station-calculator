# active-binding-archive 设计

## 问题

`getLatestArchiveMetaForGuid` 使用 `meta.isValid`（持久化快照）判断存档有效性。该值在 `CURRENT_PARSER_VERSION` 升级后不会更新，导致绑定可能选中 parser_version 不匹配的无效存档。

同时，`ArchiveMeta` 中持久化的 `isValid`/`isCompatible` 字段在其他地方也被读取为"权威来源"，存在多处数据与实现不匹配的风险。

## 方案

### 1. getLatestArchiveMetaForGuid 运行时校验

**位置**: `src/store/useSaveStore.ts`

```typescript
// 修改前
const matches = list.filter((item) => item.guid === guid && item.isValid)

// 修改后
const matches = list.filter((item) => item.guid === guid && isArchiveParserVersionValidByString(item.parser_version))
```

`isArchiveParserVersionValidByString(item.parser_version)` 比较 `item.parser_version === CURRENT_PARSER_VERSION`，始终使用当前运行时值。

### 2. ArchiveMeta 删除 isVaild/isCompatible

**位置**: `src/types/saveArchive.ts`、`src/store/useSaveStore.ts`

风险：持久化快照可能过期。不应将 `isValid`/`isCompatible` 作为 `ArchiveMeta` 字段持久化到 `localStorage`，所有校验均应运行时计算。

#### 类型变更

```
// ArchiveMeta 删除:
- isValid: boolean
- isCompatible: boolean

// SaveArchive 保留（运行时状态）:
isValid: boolean    // 存档加载时通过 isArchiveParserVersionValid() 设置
isCompatible: boolean  // 存档导入时通过 checkVersionCompatibility() 设置
```

#### buildArchiveMeta 变更

删除 `isValid: archive.isValid` 和 `isCompatible: archive.isCompatible` 两行。

#### createStubArchiveFromMeta 变更

```typescript
function createStubArchiveFromMeta(meta: ArchiveMeta, currentVersion?: string): SaveArchive {
  const isValid = isArchiveParserVersionValidByString(meta.parser_version)
  const isCompatible = currentVersion
    ? normalizeVersion(meta.version) === normalizeVersion(currentVersion)
    : true
  return { ..., isCompatible, isValid }
}
```

#### buildArchiveGroups 变更

```typescript
function buildArchiveGroups(metaList: ArchiveMeta[], currentVersion?: string): Map<string, ArchiveGroup> {
  for (const meta of metaList) {
    const archive = createStubArchiveFromMeta(meta, currentVersion)
    ...
  }
}
```

#### rebuildArchivesFromState 变更

```typescript
function rebuildArchivesFromState() {
  archives.value = buildArchiveGroups(savedArchivesState.value.list, gameDataStore.currentVersion)
}
```

### 3. MapSaveArchiveList.getLatestTime 修复

**位置**: `src/components/map/MapSaveArchiveList.vue`

```typescript
// 修改前
function getLatestTime(group: ArchiveGroup): number | null {
  return group.saves[0]?.meta.time ?? null  // 按时间取第一条
}

// 修改后
function getLatestTime(group: ArchiveGroup): number | null {
  return group.saves.find((s) => s.isValid)?.meta.time ?? null  // 取最新有效存档
}
```

注意：`getLatestTime` 用于 `shouldShowTimeBindActive` 在 UI 上显示绑定图标位置。之前的逻辑总是按时间选择最新存档，与绑定实际选择逻辑不一致。

## 数据流

```
绑定激活（tracking GUID）
  ↓
activateBinding(gameGuid)
  → selectArchiveGroup(gameGuid)
    → getLatestArchiveMetaForGuid(list, guid)  ← 运行时校验 parser_version
      → 返回最新有效存档的 meta
  → restoreSelectedArchive(guid)
    → loadArchiveDetailFromDB(resolvedArchiveId)
    → fullArchive.isValid = isArchiveParserVersionValid(fullArchive)
  → loadPlayerStationRecords()
    → selectedArchive.isValid = true → 正常载入

UI 显示
  ↓
rebuildArchivesFromState()
  → buildArchiveGroups(list, currentVersion)
    → createStubArchiveFromMeta(meta, currentVersion)  ← 运行时计算 isValid/isCompatible
  → MapSaveArchiveList 读取 stub.isValid 显示禁用/有效标记
  → getLatestTime() 返回最新有效存档时间 → 绑定图标定位
```

## 涉及文件

| 文件 | 变更 |
|------|------|
| `src/types/saveArchive.ts` | 删除 `ArchiveMeta.isValid`、`ArchiveMeta.isCompatible` |
| `src/store/useSaveStore.ts` | `getLatestArchiveMetaForGuid` 运行时校验；`buildArchiveMeta` 删除写入；`createStubArchiveFromMeta`/`buildArchiveGroups`/`rebuildArchivesFromState` 线程 currentVersion |
| `src/components/map/MapSaveArchiveList.vue` | `getLatestTime` 取最新有效存档 |
