## Bug: 偏好种族变化不再引起产线变化
- **ID**: BUG-001
- **Description**: 在 `useStationStore` 收敛为“主动重算”后，页面仍通过 `store.settings.racePreference = xxx` 直接修改嵌套字段。该写法不会触发 `settings` 的 computed setter，导致未进入主动重算链路，自动补线与资源流不刷新。
- **Steps to Reproduce**:
  1. 进入任意分站页面
  2. 在工具栏将“偏好种族”从 `argon` 切换到 `terran`
  3. 观察自动补线/产线结果
- **Expected Behavior**: 偏好种族变化后立即触发单站重算，自动补线与资源流同步更新
- **Actual Behavior**: 偏好种族字段变化，但未触发重算，产线结果保持旧值
- **Status**: Verified
- **Related Test**: `tests/unit/station-map-refactory/station-store-proxy.spec.ts` - `updateSetting 修改 racePreference 会同步到 active station`

## Bug: 改变原材料/产品价格设置不会导致价格重新计算
- **ID**: BUG-002
- **Description**: 价格滑条使用 `v-model="store.settings.buyMultiplier/sellMultiplier"` 直接写入 settings 嵌套字段，未经过主动重算入口，导致利润与价格流不刷新。
- **Steps to Reproduce**:
  1. 进入分站资源流页面
  2. 调整“原材料价格”或“产品价格”滑条
  3. 观察利润与经济分组
- **Expected Behavior**: 调整价格倍率后立即触发重算，利润与经济视图同步更新
- **Actual Behavior**: 设置值变化，但利润/经济数据保持旧值
- **Status**: Verified
- **Related Test**: `tests/unit/station-map-refactory/station-store-proxy.spec.ts` - `updateSetting 修改价格倍率会触发利润重算`

## Bug: 改变劳动力数量不会导致效率重新计算
- **ID**: BUG-003
- **Description**: 劳动力控制区原先存在 `v-model="store.settings.manualWorkforce/workforceAuto"` 直写路径，未进入主动重算入口，效率和实际劳动力可能不刷新。
- **Steps to Reproduce**:
  1. 进入分站面板，切换为手动劳动力
  2. 调整劳动力数量
  3. 观察效率百分比
- **Expected Behavior**: 劳动力数量变化后立即触发重算，效率随之变化
- **Actual Behavior**: 数值变化但效率不刷新
- **Status**: Verified
- **Related Test**: `tests/unit/station-map-refactory/station-store-proxy.spec.ts` - `updateSetting 修改手动劳动力会触发效率重算`
