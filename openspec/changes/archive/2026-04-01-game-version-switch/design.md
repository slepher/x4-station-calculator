# Design: Game Version Switch

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI Layer                                 │
├─────────────────────────────────────────────────────────────────┤
│  Version Entry Button (toolbar, right of Export)                 │
│    ├─ black btn-tool variant                                     │
│    ├─ shows red dot if needsVersionSetup                         │
│    └─ opens VersionSettingsModal                                 │
│                                                                  │
│  VersionSettingsModal                                            │
│    ├─ VersionDropdown (version select)                           │
│    ├─ DirtyModuleChecklist (multi-select + select all)           │
│    ├─ SaveAsNameInputs (per checked isNew module)                │
│    └─ Switch / SaveAndSwitch → setVersion()                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Store Layer                                 │
├─────────────────────────────────────────────────────────────────┤
│  useGameDataStore                                                │
│    ├─ versionsConfig: VersionConfig[]                            │
│    ├─ currentVersion: string                                     │
│    ├─ isBeta: boolean                                            │
│    ├─ hasStoredVersion: boolean                                  │
│    ├─ getStorageKey(module): string                              │
│    ├─ setVersion(version, beta): Promise<void>                   │
│    └─ initialize() → loadGameDataFiles(folderName)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
├─────────────────────────────────────────────────────────────────┤
│  src/assets/versions.json                                        │
│    └─ { current_version, beta, versions[] }                      │
│                                                                  │
│  localStorage                                                    │
│    ├─ x4_game_version: { version, beta }                         │
│    ├─ x4_empire_data / x4_empire_data_v9_beta                    │
│    ├─ x4_logic_flow_plans / x4_logic_flow_plans_v9_beta          │
│    └─ x4_ship_blueprints / x4_ship_blueprints_v9_beta            │
│                                                                  │
│  src/assets/x4_game_data/{folder_name}/data/*.json               │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Initialization Flow

```
App mounted
    │
    ▼
useGameDataStore.initialize()
    │
    ├─► load versions.json
    │
    ├─► check localStorage['x4_game_version']
    │       ├─ exists → use stored {version, beta}
    │       └─ missing → use default from versions.json
    │                    set hasStoredVersion = false
    │
    ├─► find matching VersionConfig
    │
    ├─► loadGameDataFiles(folderName)
    │       └─ dynamic import all game data JSONs
    │
    └─► build waresMap, modulesMap, etc.
```

### Version Switch Flow

```
User clicks version entry button
    │
    ▼
VersionSettingsModal opens
    │
    ├─► inspect dirty state of empire / logic_flow / ship_blueprints
    │
    ├─► render red bordered checklist for dirty modules
    │
    ├─► checked dirty module with isNew?
    │       └─ render dedicated name input with module default name
    │
    ▼
User selects version from dropdown
    │
    ▼
User clicks Switch / SaveAndSwitch
    │
    ├─► same version + hasStoredVersion = false
    │      └─ persist x4_game_version only
    │         no dirty-save flow
    │         no reload
    │
    ├─► same version + hasStoredVersion = true
    │      └─ button disabled
    │         no action
    │
    └─► different version
           │
           ├─ optional save selected dirty modules
           │
           └─► gameDataStore.setVersion(version, beta)
                  └─ localStorage.setItem('x4_game_version', JSON.stringify({version, beta}))
                     window.location.reload()
```

### Dirty Save Strategy

```
dirty modules = [empire, logic_flow, ship_blueprints]
    │
    ├─ same version branch
    │   └─ ignored entirely
    │
    └─ different version branch
        │
        ├─ unchecked
        │    └─ ignored during switch
        │
        └─ checked
             ├─ isNew = false → call regular save method
             └─ isNew = true  → require per-module name input, then call save-as method
```

### Storage Key Resolution

```
getStorageKey('empire')
    │
    ▼
find currentVersionConfig
    │
    ▼
return config.storage_keys.empire
    │
    └─► "x4_empire_data" (8.0 stable)
        "x4_empire_data_v9_beta" (9.0 beta)
```

## File Changes

### New Files

| File | Description |
|------|-------------|
| `src/components/SettingsButton.vue` | 设置按钮组件（含红点） |
| `src/components/VersionSettingsModal.vue` | 版本设置弹窗 |

### Modified Files

| File | Changes |
|------|---------|
| `src/assets/versions.json` | 新增版本配置文件 |
| `src/store/useGameDataStore.ts` | 添加版本管理 state 和方法 |
| `src/store/logic/useGameData.ts` | 静态导入改为动态加载 |
| `src/store/useEmpireStore.ts` | 使用动态 storage key |
| `src/store/useLogicFlowStore.ts` | 使用动态 storage key |
| `src/store/useShipBuildStore.ts` | 使用动态 storage key |
| `src/components/StationToolbar.vue` | 添加导出右侧版本切换按钮并承载红点 |
| `src/locales/en.json` | 新增版本切换保存流文案 |
| `src/locales/zh-CN.json` | 新增版本切换保存流文案 |
| `src/components/SettingsButton.vue` | 保留组件文件，但不再作为当前版本入口 |

## Component Design

### Toolbar Version Entry

```vue
<template>
  <button class="btn-tool btn-black btn-version" @click="showVersionSettingsModal = true">
    <SwitchIcon />
    <span>{{ t('menu.version_switch') }}</span>
    <span v-if="needsSetup" class="version-indicator" />
  </button>
</template>
```

补充要求：
- 入口位置固定在导出按钮右侧
- 红点提示从旧 `SettingsButton` 迁移到新版本按钮
- `SettingsButton.vue` 暂时不在工具栏渲染，但保留源码

### VersionSettingsModal.vue

```vue
<template>
  <Modal :visible="visible" @close="$emit('close')">
    <template #header>
      {{ t('settings.gameVersion.title') }}
    </template>

    <div class="version-select">
      <label>{{ t('settings.gameVersion.select') }}</label>
      <select v-model="selectedOption">
        <option
          v-for="opt in versionOptions"
          :key="opt.version + opt.beta"
          :value="opt"
        >
          {{ opt.label }}
        </option>
      </select>
    </div>

    <template #footer>
      <button @click="$emit('close')">{{ t('common.cancel') }}</button>
      <button @click="save" class="primary">{{ t('common.save') }}</button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useGameDataStore } from '@/store/useGameDataStore'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [], saved: [] }>()

const gameDataStore = useGameDataStore()

const versionOptions = computed(() => gameDataStore.versionOptions)
const selectedOption = ref(versionOptions.value[0])

watch(() => props.visible, (v) => {
  if (v) {
    // 重置为当前版本
    selectedOption.value = versionOptions.value.find(
      o => o.version === gameDataStore.currentVersion && o.beta === gameDataStore.isBeta
    ) || versionOptions.value[0]
  }
})

async function save() {
  await gameDataStore.setVersion(selectedOption.value.version, selectedOption.value.beta)
  emit('saved')
}
</script>
```

新增要求：
- 弹窗内部同时访问 `useEmpireStore`、`useLogicFlowStore`、`useShipBuildStore`
- 勾选区默认不选中任何 dirty 模块
- 仅在存在选中项时显示 `保存并切换`
- 红框区域必须明确提示“勾选即会在切换前保存”

## i18n Keys

```json
{
  "settings": {
    "gameVersion": {
      "title": "Game Version",
      "select": "Select game version"
    }
  }
}
```

```json
{
  "settings": {
    "gameVersion": {
      "title": "游戏版本",
      "select": "选择游戏版本"
    }
  }
}
```

## Edge Cases

1. **版本数据不存在**: 显示错误提示，降级到默认版本
2. **勾选的 isNew 模块名称为空**: 阻止 `保存并切换`
3. **dirty 模块存在但未勾选**: 允许直接切换，不额外弹确认
2. **localStorage 损坏**: 解析失败时使用默认配置
3. **切换版本后数据丢失**: 提示用户数据将重置（各版本独立存储）
4. **首次访问**: 显示红点，引导用户设置版本

## Testing Strategy

1. **Unit Tests**
   - `getStorageKey()` 返回正确的 key
   - `setVersion()` 正确写入 localStorage
   - 版本匹配逻辑

2. **E2E Tests**
   - 首次访问显示红点
   - 切换版本后数据隔离
   - 设置保存后红点消失
