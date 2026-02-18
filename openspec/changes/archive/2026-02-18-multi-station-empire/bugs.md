# Bugs: 多空间站帝国规划模式

## Bug 位置索引

| Bug | 所在文件 | 函数/位置 | 状态 |
|-----|---------|----------|------|
| Bug #1 | `SmartSaveDialog.vue` | `handleDiscard()` | ✅ 已修复 |
| Bug #2 | `SmartSaveDialog.vue` | `handlePrimaryAction()` | ✅ 已修复 |
| Bug #3 | `useEmpireStore.ts` | `activeStationId` 持久化 | ✅ 已修复 |
| Bug #4 | `useEmpireStore.ts` | 自动保存机制 | ✅ 已修复 |
| Bug #5 | `useEmpireStore.ts` | 删除逻辑 | ✅ 已修复 |
| Bug #6 | `useEmpireStore.ts` | `activeStationId` 持久化 | ✅ 已修复 |
| Bug #7 | `SmartSaveDialog.vue` | `handlePrimaryAction()` | ✅ 已修复 |

---

## SmartSaveDialog.vue 相关 Bug

### Bug #1: 新建功能仅新建空间站，未新建帝国

**位置**: `src/components/SmartSaveDialog.vue` - `handleDiscard()` 函数

**问题描述**: 点击"丢弃并新建"只创建了新空间站，而非新帝国。

**问题代码**:
```typescript
const handleDiscard = () => {
  if (props.storeType === 'logicFlow') {
    logicFlowStore.clearAll()
  } else {
    empireStore.createStation(t('menu.default_station_name'), 'industrial')  // ❌ 应为 createEmpire
  }
  emit('close')
}
```

**修复状态**: ✅ 已修复 (2026-02-18)

---

### Bug #2: 另存为功能同时保存了当前帝国并另存为新帝国

**位置**: `src/components/SmartSaveDialog.vue` - `handlePrimaryAction()` 函数

**问题描述**: 另存为时错误地修改了当前帝国的名称并保存。

**问题代码**:
```typescript
if (empireStore.activeEmpire) {
  empireStore.activeEmpire.name = nameToSave  // ❌ 错误修改当前帝国名称
  empireStore.saveToStorage()                  // ❌ 错误保存当前帝国
}
```

**修复状态**: ✅ 已修复 (2026-02-18)

---

### Bug #7: 保存并新建没有创建新帝国

**位置**: `src/components/SmartSaveDialog.vue` - `handlePrimaryAction()` 函数

**问题描述**: 点击"保存并新建"只保存了当前帝国，没有创建新帝国。

**问题代码**:
```typescript
} else if (props.intent === 'NEW') {
  if (empireStore.activeEmpire) {
    empireStore.updateEmpireName(nameToSave)
    empireStore.saveEmpire()
  }
  // ❌ 缺少：创建新帝国的逻辑
}
```

**对比 logicFlow 分支**:
```typescript
if (props.intent === 'NEW') {
  logicFlowStore.clearAll()  // ✅ 清空并创建新的
}
```

**修复状态**: ✅ 已修复 (2026-02-18)
  - 修改文件: `src/components/SmartSaveDialog.vue` - `handlePrimaryAction()` 添加 `createEmpire()` 调用
  - 验证测试: ✅ 通过

**复现测试**: ✅ 已验证修复

---

## useEmpireStore.ts 相关 Bug

### Bug #3: 新建帝国后再点击新建变成新建空间站

**位置**: `src/store/useEmpireStore.ts` - `activeStationId` 持久化

**问题描述**: 刷新页面后 `activeStationId` 丢失，导致 tab 状态错误。

**修复内容**:
- 添加 `activeStationId` 到 `SavedEmpiresState`
- `loadData` 恢复 `activeStationId`
- `saveEmpire` 保存 `activeStationId`
- 添加 `sessionStorage` 实时跟踪当前 tab
- `selectStation` 实时持久化到 `sessionStorage`
- `loadEmpire` 清除 `sessionStorage`

**修复状态**: ✅ 已修复 (2026-02-18)

---

### Bug #4: 新建帝国后修改名字，加载时发现帝国在列表

**位置**: `src/store/useEmpireStore.ts` - 自动保存机制

**问题描述**: 未保存的帝国出现在加载列表中。

**复现步骤**:
1. 点击"新建"创建新帝国
2. 修改帝国名字为"帝国A"
3. 不点击保存，直接点击"加载"
4. 观察加载列表：发现"帝国A"在列表中

**修复状态**: ✅ 已验证 (2026-02-18) - 测试通过

---

### Bug #5: 删除帝国后刷新，帝国还在

**位置**: `src/store/useEmpireStore.ts` - 删除逻辑

**问题描述**: 删除帝国后刷新页面，帝国仍然存在。

**复现步骤**:
1. 创建并保存一个帝国
2. 在加载列表中选择该帝国点击删除
3. 刷新页面
4. 观察结果：被删除的帝国仍然存在

**修复状态**: ✅ 已验证 (2026-02-18) - 测试通过

---

### Bug #6: 刷新页面后 tab 切换回帝国总览

**位置**: `src/store/useEmpireStore.ts` - `activeStationId` 持久化

**问题描述**: 刷新页面后 tab 切换回帝国总览，而非之前选中的空间站。

**修复状态**: ✅ 已修复 (与 Bug #3 相同修复)

---

## 测试文件索引

| 文件 | 内容 |
|------|------|
| `empire-crud.spec.ts` | 帝国 CRUD 全面测试（创建、读取、更新、删除、Tab 状态持久化） |
| `station-tabs.spec.ts` | 空间站标签栏交互测试（标签切换、新建分站、分站菜单、工具栏切换） |
| `bug-verification.spec.ts` | Bug 修复验证测试（已修复的 Bug #1、#2） |
| `bug-reproduction.spec.ts` | Bug 复现测试（待修复的 Bug #7） |

| Bug | 测试文件 | 测试用例 |
|-----|---------|---------|
| Bug #1 | `bug-verification.spec.ts` | `Bug #1 验证: 新建功能应创建新帝国` |
| Bug #2 | `bug-verification.spec.ts` | `Bug #2 验证: 另存为不应修改当前帝国` |
| Bug #3 | `empire-crud.spec.ts` | `Bug #3 - 连续新建应创建独立帝国` |
| Bug #4 | `empire-crud.spec.ts` | `Bug #4 - 未保存的帝国不应出现在加载列表` |
| Bug #5 | `empire-crud.spec.ts` | `Bug #5 - 删除帝国后刷新应消失` |
| Bug #6 | `empire-crud.spec.ts` | `Bug #6 - 刷新页面后应停留在之前选中的空间站` |
| Bug #7 | `bug-reproduction.spec.ts` | `Bug #7 复现: 保存并新建没有创建新帝国` |
