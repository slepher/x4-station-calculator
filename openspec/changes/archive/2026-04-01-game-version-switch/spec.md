# Spec: Game Version Switch

## Overview

版本管理系统的核心规格，定义数据结构、Store 接口和组件行为。

## Data Structures

### VersionConfig

```typescript
interface VersionConfig {
  version: string        // "8.0" | "9.0"
  beta: boolean          // false | true
  codename: string       // "Diplomacy" | "Empire"
  folder_name: string    // "8.0-Diplomacy" | "9.0-Empire"
  storage_keys: {
    empire: string
    logic_flow: string
    ship_blueprints: string
  }
}
```

### VersionsFile

```typescript
interface VersionsFile {
  current_version: string
  beta: boolean
  versions: VersionConfig[]
}
```

### GameVersionStorage

```typescript
interface GameVersionStorage {
  version: string
  beta: boolean
}
```

## Store Interface: useGameDataStore

### 新增 State

```typescript
// 版本管理
const versionsConfig = ref<VersionConfig[]>([])
const currentVersion = ref<string>('')
const isBeta = ref<boolean>(false)
const folderName = ref<string>('')
const hasStoredVersion = ref<boolean>(false)
```

### 新增 Computed

```typescript
// 当前版本配置
const currentVersionConfig = computed<VersionConfig | undefined>(() => {
  return versionsConfig.value.find(
    v => v.version === currentVersion.value && v.beta === isBeta.value
  )
})

// 版本选项列表（用于 UI）
const versionOptions = computed(() => {
  return versionsConfig.value.map(v => ({
    version: v.version,
    codename: v.codename,
    beta: v.beta,
    label: `${v.version}-${v.codename}${v.beta ? ' (beta)' : ''}`
  }))
})

// 是否需要显示红点
const needsVersionSetup = computed(() => !hasStoredVersion.value)
```

### 新增 Methods

```typescript
// 获取当前版本的 storage key
function getStorageKey(module: 'empire' | 'logic_flow' | 'ship_blueprints'): string

// 切换版本（写入 x4_game_version）
async function setVersion(version: string, beta: boolean): Promise<void>

// 将当前有效版本写入 x4_game_version，但不 reload
function persistVersionSelection(version: string, beta: boolean): void
```

### 修改 initialize()

```typescript
async function initialize() {
  // 1. 读取 versions.json
  const versionsData = await import('@/assets/versions.json')

  // 2. 检查 localStorage['x4_game_version']
  const storedVersion = localStorage.getItem('x4_game_version')
  if (storedVersion) {
    const parsed = JSON.parse(storedVersion) as GameVersionStorage
    currentVersion.value = parsed.version
    isBeta.value = parsed.beta
    hasStoredVersion.value = true
  } else {
    currentVersion.value = versionsData.current_version
    isBeta.value = versionsData.beta
    hasStoredVersion.value = false
  }

  // 3. 动态加载游戏数据
  const config = currentVersionConfig.value
  folderName.value = config?.folder_name || '8.0-Diplomacy'

  // 4. 加载游戏数据文件
  await loadGameDataFiles(folderName.value)

  // 5. 构建各种 map...
}
```

## useGameData.ts Changes

### 移除静态导入

```typescript
// 删除
import waresRaw from '../../assets/x4_game_data/8.0-Diplomacy/data/wares.json'
// ... 其他静态导入
```

### 新增动态加载

```typescript
type GameDataFiles = {
  wares: X4Ware[]
  modules: X4Module[]
  moduleGroups: X4ModuleGroup[]
  consumption: RaceMedicalConsumption
  ships: X4Ship[]
  shipRaces: X4ShipRace[]
  shipTypes: X4ShipType[]
  equipments: X4Equipment[]
  equipmentTypes: X4EquipmentType[]
  slotTags: X4SlotTag[]
  consumables: X4Consumable[]
  drones: X4Drone[]
  missiles: X4Missile[]
}

export async function loadGameDataFiles(folderName: string): Promise<GameDataFiles> {
  const base = `../../assets/x4_game_data/${folderName}/data`

  const [
    wares, modules, moduleGroups, consumption,
    ships, shipRaces, shipTypes,
    equipments, equipmentTypes, slotTags,
    consumables, drones, missiles
  ] = await Promise.all([
    import(`${base}/wares.json`).then(m => m.default),
    import(`${base}/modules.json`).then(m => m.default),
    import(`${base}/module_groups.json`).then(m => m.default),
    import(`${base}/consumption.json`).then(m => m.default),
    import(`${base}/ships.json`).then(m => m.default),
    import(`${base}/ship_races.json`).then(m => m.default),
    import(`${base}/ship_types.json`).then(m => m.default),
    import(`${base}/equipments.json`).then(m => m.default),
    import(`${base}/equipment_types.json`).then(m => m.default),
    import(`${base}/slot_tags.json`).then(m => m.default),
    import(`${base}/consumables.json`).then(m => m.default),
    import(`${base}/drones.json`).then(m => m.default),
    import(`${base}/missiles.json`).then(m => m.default)
  ])

  return { wares, modules, moduleGroups, consumption, ships, shipRaces, shipTypes, equipments, equipmentTypes, slotTags, consumables, drones, missiles }
}
```

### 修改 build 函数

所有 `build*` 函数改为从参数获取数据：

```typescript
export function buildWaresMap(wares: X4Ware[]): Record<string, X4Ware>
export function buildModulesMap(modules: X4Module[]): Record<string, X4Module>
// ... 其他函数同理
```

## Component: VersionSettingsModal

### Props

```typescript
interface Props {
  visible: boolean
}
```

### Emits

```typescript
interface Emits {
  (e: 'close'): void
  (e: 'saved'): void
}
```

### Behavior

1. 显示版本下拉框
2. 如果存在 dirty 模块，显示未保存模块区域，仅列出 dirty 项
3. 未保存模块区域提供多选框与“全选”，默认不勾选任何模块
4. 当至少勾选一个 dirty 模块时，显示 `保存并切换`；否则显示 `切换`
5. 对每个被勾选且 `requiresSaveAsOnSave()` 为 `true` 的模块，显示独立名称输入框，并填充该模块默认名称
6. 若目标版本与当前生效版本相同且 `hasStoredVersion = false`，点击 `切换` 时仅调用 `gameDataStore.persistVersionSelection(version, beta)`，不保存 dirty 模块，也不 reload
7. 若目标版本与当前生效版本相同且 `hasStoredVersion = true`，`切换` 按钮置灰，且不显示保存分支
8. 点击 `保存并切换` 时，仅保存已勾选模块，再调用 `gameDataStore.setVersion(version, beta)`
9. 点击 `切换` 时，不保存任何 dirty 模块，直接调用 `gameDataStore.setVersion(version, beta)`；该分支仅适用于目标版本与当前版本不同的真实切换场景

### Dirty Module Sources

```typescript
const dirtyModules = [
  { key: 'empire', isDirty: empireStore.isDirty, isNew: empireStore.requiresSaveAsOnSave() },
  { key: 'logic_flow', isDirty: logicFlowStore.isDirty, isNew: logicFlowStore.requiresSaveAsOnSave() },
  { key: 'ship_blueprints', isDirty: shipBuildStore.isDirty, isNew: shipBuildStore.requiresSaveAsOnSave() }
]
```

### Save Semantics

```typescript
if (checked.empire) {
  if (empireStore.requiresSaveAsOnSave()) empireStore.saveEmpireAs(inputName.empire)
  else empireStore.saveEmpire()
}

if (checked.logic_flow) {
  if (logicFlowStore.requiresSaveAsOnSave()) logicFlowStore.saveCurrentPlanAs(inputName.logic_flow)
  else logicFlowStore.saveCurrentPlan()
}

if (checked.ship_blueprints) {
  if (shipBuildStore.requiresSaveAsOnSave()) shipBuildStore.saveAsBlueprint(inputName.ship_blueprints)
  else shipBuildStore.saveBlueprint()
}
```

## Component: Version Entry Button

### Props

无

### Behavior

1. 在工具栏导出按钮右边显示独立的版本切换按钮
2. 按钮样式与导出按钮保持一致，颜色为黑色
3. 当 `gameDataStore.needsVersionSetup` 为 true 时在该按钮上显示红点
4. 点击打开 `VersionSettingsModal`
5. 原 `SettingsButton.vue` 不再作为当前入口，但保留组件文件，不删除

## Store Changes

### useEmpireStore

```typescript
// 原
const STORAGE_KEY = 'x4_empire_data'

// 改
function getStorageKey(): string {
  return gameDataStore.getStorageKey('empire')
}
```

### useLogicFlowStore

```typescript
// 原
const stored = localStorage.getItem('x4_logic_flow_plans')

// 改
const stored = localStorage.getItem(gameDataStore.getStorageKey('logic_flow'))
```

### useShipBuildStore

```typescript
// 原
const STORAGE_KEY = 'x4_ship_blueprints'

// 改
function getStorageKey(): string {
  return gameDataStore.getStorageKey('ship_blueprints')
}
```

## i18n Keys

```json
{
  "settings": {
    "gameVersion": {
      "switch": "Switch",
      "saveAndSwitch": "Save and switch",
      "unsavedModules": "Unsaved modules",
      "selectAll": "Select all",
      "saveScopeWarning": "Checked modules will be saved before switching version.",
      "moduleEmpire": "Empire",
      "moduleLogicFlow": "Logic Flow",
      "moduleShipBlueprints": "Ship blueprints",
      "moduleNameLabel": "Name"
    }
  }
}
```

```json
{
  "settings": {
    "gameVersion": {
      "switch": "切换",
      "saveAndSwitch": "保存并切换",
      "unsavedModules": "未保存的模块",
      "selectAll": "全选",
      "saveScopeWarning": "勾选的模块会在切换版本前先保存。",
      "moduleEmpire": "星区规划",
      "moduleLogicFlow": "逻辑组网",
      "moduleShipBlueprints": "舰船配装",
      "moduleNameLabel": "名称"
    }
  }
}
```

## Error Handling

1. `versions.json` 不存在 → 使用默认配置 (8.0 stable)
2. 匹配版本失败 → 降级到第一个版本
3. 游戏数据文件不存在 → 显示错误提示
4. 勾选的 `isNew` 模块名称为空 → 阻止 `保存并切换`
