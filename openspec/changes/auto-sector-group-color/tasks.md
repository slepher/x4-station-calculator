# Hub 色卡与地图染色 — 任务列表

## 1. 数据模型

- [x] `BindingSectorGroup` 添加 `color?: string`（`src/types/x4.ts`）
- [x] `GroupDraftInfo` 添加 `color?: string`（`src/store/logic/autoGroup.ts`）
- [x] `normalizeState()` 保留 `color` 字段（`src/store/useSaveBindingStore.ts`）

## 2. 色板与分配算法

- [x] 创建 `src/store/logic/hubColor.ts`，定义 `HUB_PALETTE`（30 色）、`HUB_COLORFUL`（27 色）
- [x] 实现 `stabilizeHubColors()`：先固定满足约束的已有颜色，再重分配缺色/新增/冲突 hub；用户选择的预设颜色不视为不可更改颜色
- [x] 实现 [计算] 后到提交前的单 hub 颜色稳定流程：新增 hub 或调整覆盖星区时，只判断并可能重分配当前 hub
- [x] 实现 Stage 1 自身 faction 避色：
  - 定位星区、覆盖星区 faction 色均参与避色
  - ownerless、缺失 owner_color、无法解析颜色不参与避色
  - 阈值按 ΔE ≥ 20→15→10→5→0 放宽，直到至少 5 个候选或无进一步放宽空间
- [x] 实现 Stage 2 5 跳 hub 避色：
  - 仅考虑 5 跳以内 hub，允许与 5 跳外 hub 颜色重复
  - 避色输入包含 5 跳内已固定/已分配 hub 颜色与其中央/定位星区 faction 色
  - 阈值按 ΔE ≥ 20→15→10→5 放宽，并用 maximin 选最优
- [x] 实现随机颜色 fallback，仅在无可解析候选时使用
- [x] 导出颜色稳定/分配函数供 presenter 使用

## 3. 计算集成

- [x] `runCalculationFromEditInput()` 或等效流程中，计算完成后调用颜色稳定流程
- [x] Clean slate / Incremental 首次分组时也调用颜色稳定流程
- [x] [计算] 后保留满足约束的已有自动颜色；对缺色、新增、或与自身/5 跳内约束冲突的 hub 重分配
- [x] 从已保存 binding 恢复为 result 时不单独补色；缺色 group 等待下次 [计算] 后补色
- [x] [计算] 后到提交前，因覆盖计算新增覆盖星区时：新增覆盖星区 faction 色与当前 hub 颜色 ΔE > 5 不触发当前 hub 重分配；ΔE ≤ 5 时仅重分配当前 hub
- [x] [计算] 后到提交前，新增 hub 时只为新增 hub 分配颜色；单次操作不得自动改变超过一个 hub 的颜色
- [x] 用户通过色卡调整的预设颜色可持久化，但后续 compute 发现冲突时可以修改

## 4. SectorGroupCard 色卡控件

- [x] `group-title-row` 中 group name 右侧添加 16×16 色块
- [x] 有颜色填充，无颜色虚线边框
- [x] 编辑态点击弹出 SketchPicker（`vue-color`），10×3 色板 + SV 取色区
- [x] 非编辑态色块不可点击
- [x] 点预设色块 → 更新 `group.color` + dismiss popover
- [x] 点透明预设 → 清空 `group.color` 为 undefined，不保存 `0x00000000`
- [x] 点外部 / Esc → dismiss
- [x] CSS 覆写 SketchPicker 布局、选中环
- [x] `main.ts` 引入 `vue-color/style.css`

## 5. 地图星区染色

- [x] `useMapSvgSectors.ts` 新增 `sectorGroupColorMap` 参数
- [x] 构建 `sectorGroupColorMap` 时基于覆盖互斥约束：一个星区最多映射一个 hub 颜色，无需处理多 hub 优先级
- [x] 对有 hub 颜色的星区，生成 2/3 半径内部六边形（无边框、仅填充）
- [x] `group.color` 为 undefined 时不生成内部六边形
- [x] `MapSectorLayer.vue` 在 faction owner 色之上渲染内部六边形
- [x] 确保 resource pie 覆盖层在内六边形之上

## 6. i18n

- [x] 添加色卡相关 tooltip key（zh-CN + en）
