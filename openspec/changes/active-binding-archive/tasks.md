# active-binding-archive 任务

## 任务列表

### T1: getLatestArchiveMetaForGuid 运行时校验

- 将 `item.isValid` 替换为 `isArchiveParserVersionValidByString(item.parser_version)`
- 文件: `src/store/useSaveStore.ts`
- 验证: 运行时不再依赖存储的 `meta.isValid`

### T2: ArchiveMeta 删除 isValid/isCompatible

- 从 `ArchiveMeta` 类型中删除 `isValid` 和 `isCompatible` 字段
- 从 `buildArchiveMeta` 中删除对应的写入行
- 文件: `src/types/saveArchive.ts`、`src/store/useSaveStore.ts`

### T3: createStubArchiveFromMeta 运行时计算 isCompatible

- 添加 `currentVersion` 参数
- `isCompatible` 由 `normalizeVersion(meta.version) === normalizeVersion(currentVersion)` 计算
- 文件: `src/store/useSaveStore.ts`

### T4: buildArchiveGroups/rebuildArchivesFromState 线程版本号

- `buildArchiveGroups` 接受 `currentVersion` 参数并传入 `createStubArchiveFromMeta`
- `rebuildArchivesFromState` 传入 `gameDataStore.currentVersion`
- 文件: `src/store/useSaveStore.ts`

### T5: MapSaveArchiveList.getLatestTime 修复

- 取最新有效存档代替按时间取第一条
- 文件: `src/components/map/MapSaveArchiveList.vue`

### T6: 构建验证

- `npx vue-tsc --noEmit` 通过
- `npm run build` 通过

### T7: E2E 测试验证（由测试流程处理，不在 apply 范围）

- 两个同 GUID 存档（新无效 parser=v4、旧有效 parser=v5）
- 验证绑定选中旧有效存档
- 验证地图面板显示无效标记
- 验证空间站正常载入

## 依赖顺序

```
T1 → T2 → T3 → T4 → T5 → T6
```

T7（测试）与主流程并行或在其之后执行。
