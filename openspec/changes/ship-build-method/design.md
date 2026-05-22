# Material Method 设计文档

## 架构影响

### 数据模型

**`ShipBlueprint` 类型变更**：
- 新增 `materialMethod: string` 必填字段
- 位置：`src/types/x4.ts:812-822`
- 影响范围：所有 blueprint 相关的创建、读取、迁移逻辑

**版本升级**：
- `CURRENT_SHIP_BLUEPRINT_VERSION: 2 → 3`
- 位置：`src/store/logic/storageVersions.ts:3`

### 迁移层

**`stateMigrations.ts` 改造**：
- `normalizeBlueprintList` 函数（Line 350-368）
- 为旧 blueprint 添加默认 `materialMethod: 'default'`
- 保持向后兼容，旧数据可正常加载

### Store 层

**`useShipBuildStore.ts` 改造**：
- 新增 `setMaterialMethod(method: string)` 方法
- 新建 blueprint 时设置默认值
- 材料计算触发逻辑

### 组件层

**`ShipBuildPanelMaterials.vue` 改造**：
- 移除内部 `ref('default')` 状态
- 改为绑定 blueprint 数据
- xenon 过滤逻辑修正
- 自动选择逻辑更新

## 设计决策

### 1. 字段必填而非可选

**决策**：`materialMethod` 为必填字段，不使用 `materialMethod?: string`

**理由**：
- 所有 blueprint 都需要明确的方法选择
- 避免组件层处理 undefined 的复杂逻辑
- 迁移时统一设置默认值，数据一致性更好
- 简化类型系统，减少运行时 null check

**影响**：
- 新建 blueprint 必须初始化该字段
- 迁移逻辑必须为旧数据补充默认值

### 2. xenon 过滤基于飞船本体判断

**决策**：仅根据飞船本体 `production` 判断是否允许 xenon，不考虑装备是否有 xenon cost

**理由**：
- 生产方法是飞船固有属性，装备的 cost 方法是依赖项
- 装备可能在多种飞船上使用，不应决定飞船的生产方法选择
- 符合游戏逻辑：只有 Xenon 飞船才能使用 xenon 方法建造
- 用户理解更清晰："这艘飞船能不能用 xenon 建造" 而不是 "这个装备是否支持 xenon"

**分支逻辑**：
```
飞船本体 production 包含 xenon → 允许 xenon 候选（包括装备的 xenon cost）
飞船本体 production 不包含 xenon → 过滤所有 xenon（包括装备的 xenon cost）
```

### 3. 自动选择立即持久化

**决策**：当候选变化导致当前方法无效，自动选择后立即调用 `setMaterialMethod` 持久化

**理由**：
- 用户切换飞船时可能触发自动选择，应自动保存避免丢失
- 保持 blueprint 数据与 UI 显示同步
- 减少用户手动保存的负担

**触发场景**：
- 从 Xenon 飞船切换到非 Xenon 飞船
- blueprint 加载时发现方法不在候选中

### 4. Store 方法而非直接修改 blueprint

**决策**：通过 `store.setMaterialMethod(method)` 更新，而非组件直接修改 `blueprint.materialMethod`

**理由**：
- 保持 Store 单一职责，控制所有 blueprint 修改
- 自动触发 dirty 状态标记
- 自动触发材料重新计算
- 符合 Pinia reactive pattern

**实现**：
```typescript
setMaterialMethod(method: string) {
  if (!this.blueprint) return
  this.blueprint.materialMethod = method
  this.forceDirty = true
  // 材料计算已在 computed 中自动响应 blueprint 变化
}
```

### 5. 候选去重保持首次出现顺序

**决策**：使用 `Set` 去重，但按首次出现顺序 push 到 array

**理由**：
- 保证候选列表顺序稳定（飞船本体 → 装备 → 存储物品）
- 用户看到的选项顺序一致，体验更好
- 避免 Set 遍历顺序可能导致的随机性

**实现**（保持现有逻辑不变）：
```typescript
const options: string[] = []
const optionSet = new Set<string>()
// 收集逻辑使用 if (optionSet.has(method)) return; optionSet.add(method); options.push(method)
```

## 异常与告警

### 无效方法设置

**场景**：用户通过某种方式（如浏览器 console）调用 `setMaterialMethod('invalid_method')`

**处理**：
- 不做严格验证，允许设置
- 后续计算时会 fallback 到默认方法
- 原因：候选列表可能在不同飞船间变化，不希望阻止用户保存偏好

### 候选为空

**场景**：所有 cost 都被过滤（理论上不应发生）

**处理**：
- fallback 到 `['default']`
- 保证 UI 总有选项可用

### Blueprint 无效

**场景**：`setMaterialMethod` 被调用但 `blueprint` 为 null

**处理**：
- 立即返回，不做任何操作
- 不抛出错误，避免阻塞其他逻辑

## 数据流

### 初始化流程

```
用户加载 blueprint
↓
Store 执行迁移（如需要）
↓
Blueprint.materialMethod 确定值（迁移默认或已有值）
↓
组件加载，计算 materialMethodOptions
↓
检查 blueprint.materialMethod 是否在候选中
↓
在候选中 → 使用保存值
不在候选中 → 自动选择第一个并持久化
```

### 用户切换方法流程

```
用户在下拉框选择新方法
↓
触发 onChange
↓
调用 store.setMaterialMethod(newMethod)
↓
Blueprint.materialMethod 更新
↓
forceDirty = true
↓
Computed 材料数据自动重新计算
↓
UI 显示新方法的材料明细
↓
用户保存 blueprint（显式或自动）
↓
数据持久化到 localStorage
```

### 切换飞船流程

```
用户选择新飞船
↓
Blueprint.shipId 更新
↓
SelectedShip.value 变化
↓
materialMethodOptions computed 重新计算
↓
新候选可能不包含当前 materialMethod
↓
自动选择第一个有效方法
↓
调用 store.setMaterialMethod 自动持久化
↓
材料重新计算
↓
UI 更新
```

## 文件修改清单

### 类型定义

- `src/types/x4.ts` (Line 812-822)
  - `ShipBlueprint` 接口添加 `materialMethod: string`

### 版本与迁移

- `src/store/logic/storageVersions.ts` (Line 3)
  - `CURRENT_SHIP_BLUEPRINT_VERSION: 2 → 3`

- `src/store/logic/stateMigrations.ts` (Line 350-368)
  - `normalizeBlueprintList` 添加默认值设置

### Store 层

- `src/store/useShipBuildStore.ts`
  - 新建 blueprint 默认值设置
  - 新增 `setMaterialMethod(method: string)` 方法

### 组件层

- `src/components/ship-build/ShipBuildPanelMaterials.vue`
  - Line 21: 移除 `const materialMethod = ref('default')`
  - Line 88-187: 修改 `materialMethodOptions` xenon 过滤逻辑
  - Line 189-192: 修改自动选择逻辑，添加持久化调用
  - Line 527: 改为绑定 blueprint 数据或调用 store 方法

## 关键注意事项

1. **迁移覆盖**：确保所有旧 blueprint 都获得默认值，包括 bucket 中的多个 blueprint
2. **类型必填**：新建 blueprint 时必须设置 `materialMethod`，不能依赖默认 undefined
3. **自动持久化时机**：自动选择时立即持久化，避免用户切换飞船后丢失方法设置
4. **xenon 判断精确**：只检查 `production` 数组，不检查其他属性
5. **候选顺序稳定**：保持收集顺序（飞船 → 装备 → 存储），不改变现有逻辑
6. **编译验证**：完成后必须运行 `npm run build` 确保无类型错误