# ship-build-method 变更请求

## 目标

为船只建造材料方法选择添加持久化支持，用户选择的 `materialMethod` 应保存到 `ShipBlueprint` 并在重新加载时恢复。同时修复 xenon 方法的过滤逻辑：只有飞船本体支持 xenon 生产时才允许选择 xenon 方法。

## 已确认方案（审核重点）

### 1. 数据模型变更

**`ShipBlueprint` 类型**（`src/types/x4.ts:812-822`）：
- 新增 `materialMethod: string` 字段（**必填字段**，非可选）
- 不使用可选类型，所有 blueprint 都必须显式存储此值

**版本升级**：
- `CURRENT_SHIP_BLUEPRINT_VERSION` 从 `2` 升至 `3`（`src/store/logic/storageVersions.ts:3`）

### 2. 迁移逻辑

**位置**：`src/store/logic/stateMigrations.ts:350-368` `normalizeBlueprintList` 函数

**规则**：
- 旧数据（version < 3）的 blueprint 自动设置 `materialMethod: 'default'`
- 新数据直接读取 `blueprint.materialMethod` 字段（必填）

### 3. xenon 过滤逻辑

**位置**：`src/components/ship-build/ShipBuildPanelMaterials.vue:88-187` `materialMethodOptions` computed

**变更前**：无条件过滤所有 xenon 方法

**变更后**：
- **判断条件**：检查 `selectedShip.value?.production` 中是否存在 `method === 'xenon'`
- **行为分支**：
  - 如果飞船本体支持 xenon → 保留 xenon 方法（包括从装备、consumables、drones、missiles 中收集的 xenon）
  - 如果飞船本体不支持 xenon → 过滤掉所有 xenon 方法（保持原有逻辑）

**候选来源**（不变）：
1. 飞船本体生产方法：`selectedShip.value?.production[].method`
2. 装备 cost 方法：`shipBlueprint.connections[].group` 中主装备和护盾
3. 存储物品 cost 方法：`shipBlueprint.storage` 中的 deployables、countermeasure、drones、missiles

**去重规则**（不变）：使用 Set 去重，保持首次出现顺序

### 4. 组件层改造

**位置**：`src/components/ship-build/ShipBuildPanelMaterials.vue`

**状态管理**：
- 移除组件内部 `const materialMethod = ref('default')` (Line 21)
- 改为绑定 `props.shipBlueprint?.materialMethod` 或通过 store 访问

**初始化逻辑**：
- 如果 blueprint 已有 `materialMethod` 且在 `materialMethodOptions` 候选中 → 使用保存值
- 否则 → 使用 `materialMethodOptions[0]` 或 `'default'`

**用户交互**：
- 用户切换方法时 → 调用 store 方法 `setMaterialMethod(method)` 持久化
- 方法切换立即触发材料重新计算

### 5. Store 层方法

**新增方法**：`setMaterialMethod(method: string)` 
- 更新当前 `blueprint.materialMethod`
- 触发材料重新计算

**新建 blueprint 默认值**：
- 创建新 blueprint 时默认设置 `materialMethod: 'default'`

### 6. 自动选择逻辑（Line 189-192）

**位置**：`ShipBuildPanelMaterials.vue:189-192`

**触发时机**：当 `materialMethodOptions` 变化导致当前方法不在候选中

**行为**：
- 自动选择第一个有效方法 `materialMethodOptions[0]`
- 如果候选为空则 fallback 到 `'default'`
- 自动选择后立即持久化

## 边界

### In Scope

- `ShipBlueprint.materialMethod` 字段添加（必填）
- 版本升级与迁移逻辑
- xenon 过滤逻辑修复（基于飞船本体生产方法判断）
- 组件层状态管理与持久化
- Store 层 `setMaterialMethod` 方法
- 新建 blueprint 的默认值设置

### Out of Scope

- 装备配装逻辑变更
- 其他 blueprint 字段变更
- E2E 测试编写（属于 `/x4:test` scope）
- UI 样式调整

## 验收标准（DoD）

1. **数据持久化**：
   - 用户选择材料方法后，保存 blueprint 并重新加载，方法保持不变
   - 新建 blueprint 默认方法为 `'default'`

2. **迁移兼容**：
   - 加载 version=2 的旧 blueprint，自动设置 `materialMethod: 'default''
   - 迁移后保存的 blueprint version=3

3. **xenon 方法选择**：
   - Xenon 飞船（production 包含 xenon 方法）→ 材料方法下拉框中 xenon 可选
   - 非 Xenon 飞船（production 不包含 xenon）→ 材料方法下拉框中 xenon 不可选

4. **候选来源完整性**：
   - 方法候选包括飞船本体、装备、consumables、drones、missiles 的所有方法（除被 xenon 过滤规则排除）
   - 去重正确，无重复选项

5. **自动选择**：
   - 当前方法不在候选中时（如切换飞船导致方法不再可用），自动选择第一个有效方法并持久化

6. **编译验证**：
   - `npm run build` 成功，无 TypeScript 类型错误

## 未决项

无