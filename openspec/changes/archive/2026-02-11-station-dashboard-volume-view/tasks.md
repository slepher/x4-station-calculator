# 任务：空间站仪表盘空间视图

- [x] **国际化更新 (I18n Updates)**
    - [x] 更新 `src/locales/zh-CN.json` 增加新键值 (`ui.cost_view`, `ui.transport_ships` 等)。
    - [x] 更新 `src/locales/en.json` 增加新键值。

- [x] **逻辑更新 (Logic Updates)**
    - [x] 更新 `src/store/logic/analyzeStation.ts`: 在 `AnalysisItem` 和 `AnalysisGroup` 中增加 `volume` 字段。
    - [x] 更新 `src/store/logic/analyzeStation.ts`: 在 `StationAnalysis` 中计算 `totalVolume`。

- [x] **组件更新 (Component Updates)**
    - [x] 更新 `src/components/StationDashboard.vue`:
        - [x] 增加 `transportShipCapacity` ref (默认 62000)。
        - [x] 实现统计栏的 2x3 网格布局。
        - [x] 增加 `volume` 视图模式并更新切换器。
        - [x] 在空间视图下增加底部的 `VolumeControlSlider` (或类似组件)。
        - [x] **修复**: 将统计栏中的 "Total Needed" 改为 "Workers Needed" (绿色)。
        - [x] **修复**: 将统计栏中的 "Transport Ships" 改为 "Transport Trips"。
        - [x] **修复**: 在空间视图下，将 Summary 的 `is-volume` prop 传递给 `StationModuleDetail`。
        - [x] **修复**: 在空间视图下，更新 Summary 标题为 `ui.total_build_volume`。
    - [x] 更新 `src/components/StationModuleDetail.vue`:
        - [x] 支持 `isVolume` prop。
        - [x] 使用 `text-blue-400` 和 `m³` 单位渲染体积数值。

- [x] **验证 (Verification)**
    - [x] 验证统计栏在不同屏幕尺寸下的布局 (主要是在侧边栏中的固定宽度)。
    - [x] 验证运输船数量计算的准确性。
    - [x] 验证空间视图显示正确的 m³ 数值。
    - [x] 验证空间视图下的 Summary 标题和颜色。

- [x] **持久化 (Persistence)**
    - [x] 将 `transportShipCapacity` 加入 `StationSettings` 并持久化到 LocalStorage (默认 62000)。
