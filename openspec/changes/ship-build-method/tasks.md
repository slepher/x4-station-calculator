# Material Method 实现任务清单

## 任务分解

### 1. 类型定义与版本升级

- [x] 1.1 在 `src/types/x4.ts` Line 812-822 的 `ShipBlueprint` 接口中添加 `materialMethod: string` 必填字段
- [x] 1.2 在 `src/store/logic/storageVersions.ts` Line 3 将 `CURRENT_SHIP_BLUEPRINT_VERSION` 从 `2` 改为 `3`

### 2. 迁移逻辑

- [x] 2.1 在 `src/store/logic/stateMigrations.ts` Line 350-368 的 `normalizeBlueprintList` 函数中添加 `materialMethod` 默认值设置：
  ```typescript
  materialMethod: typeof blueprint.materialMethod === 'string' 
    ? blueprint.materialMethod 
    : 'default'
  ```

### 3. Store 层改造

- [x] 3.1 在 `src/store/useShipBuildStore.ts` 中找到新建 blueprint 的位置（如 `createBlueprint`、`saveAsBlueprint` 等函数），添加默认值设置 `materialMethod: 'default'`
- [x] 3.2 在 `src/store/useShipBuildStore.ts` 中新增 `setMaterialMethod(method: string)` 方法：
  - 更新 `blueprint.materialMethod`
  - 设置 `forceDirty = true`
  - 无需手动触发重新计算（computed 会自动响应）

### 4. 组件层状态管理

- [x] 4.1 在 `src/components/ship-build/ShipBuildPanelMaterials.vue` Line 21 移除 `const materialMethod = ref('default')` 局部状态
- [x] 4.2 在 `ShipBuildPanelMaterials.vue` 中添加计算属性或通过 props/store 访问 `blueprint.materialMethod`
- [x] 4.3 修改下拉框绑定（Line 527）：从 `v-model="materialMethod"` 改为调用 store 方法或绑定 blueprint 数据
- [x] 4.4 添加初始化逻辑：
  - 如果 `blueprint.materialMethod` 在 `materialMethodOptions` 候选中，使用保存值
  - 否则使用 `materialMethodOptions[0]` 或 `'default'`

### 5. Xenon 过滤逻辑修正

- [x] 5.1 在 `src/components/ship-build/ShipBuildPanelMaterials.vue` Line 88-187 的 `materialMethodOptions` computed 中添加 xenon 判断逻辑：
  - 在函数开始处检查飞船本体是否支持 xenon：
    ```typescript
    const shipHasXenon = selectedShip.value?.production.some(p => p.method === 'xenon')
    ```
  - 修改所有 `if (method === 'xenon') return` 为：
    ```typescript
    if (method === 'xenon' && !shipHasXenon) return
    ```
  - 保持其他过滤逻辑不变（如 `if (optionSet.has(method)) return`）

### 6. 自动选择与持久化

- [x] 6.1 在 `ShipBuildPanelMaterials.vue` Line 189-192 的自动选择逻辑中添加持久化调用：
  - 自动选择后立即调用 `store.setMaterialMethod(selectedMethod)`
  - 添加 watch 确保 blueprint.materialMethod 与显示状态同步

### 7. 构建验证

- [x] 7.1 执行 `npm run build` 验证编译无错误
- [x] 7.2 如有 TypeScript 类型错误，修复并重新构建直到通过

## 依赖顺序

1. **步骤 1-2**（类型与迁移）：必须最先完成，为后续改造奠定基础
2. **步骤 3**（Store）：依赖步骤 1 的类型定义
3. **步骤 4-6**（组件）：依赖步骤 3 的 Store 方法
4. **步骤 7**（构建验证）：最后执行，确保所有改造正确

## 实现注意事项

1. **字段必填**：新建 blueprint 时必须显式设置 `materialMethod`，不能依赖 TS 默认值
2. **xenon 判断位置**：在最开始计算 `shipHasXenon`，避免在每个过滤点重复判断
3. **自动持久化时机**：watch 或 computed 变化后立即调用 `setMaterialMethod`，避免延迟
4. **候选顺序不变**：不修改收集顺序，保持飞船 → 装备 → 存储的逻辑
5. **迁移覆盖完整**：确保 `normalizeBlueprintList` 中每个 blueprint 都获得默认值

## 验证要点

实现完成后，开发者应在本地验证：

1. 加载旧 blueprint（version < 3）能自动获得 `materialMethod: 'default'`
2. Xenon 飞船的候选列表包含 xenon 方法
3. 非 Xenon 飞船的候选列表不包含 xenon 方法
4. 切换方法后 blueprint 被标记为 dirty
5. 保存并重新加载 blueprint，方法保持不变
6. 切换飞船导致方法不在候选中时，自动选择第一个有效方法并持久化
7. `npm run build` 无编译错误

## 任务范围边界

**实现范围**：
- 仅包含代码修改（src/**）
- 包含构建验证（npm run build）

**不包含**：
- 测试代码编写（属于 `/x4:test` scope）
- E2E 测试执行（属于 `/x4:test-run` scope）
- 文档更新（已在本文档中完成）