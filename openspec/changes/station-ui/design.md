# Design Specification: StationDashboard

## 1. 组件架构 (Component Architecture)

### 1.1 StationDashboard.vue (Main Container)
- **职责**: 管理视图状态（viewMode）、聚合 Store 数据、协调各子组件的渲染。
- **状态**: 
  - `viewMode`: `'materials' | 'time' | 'workers'` (目前固定为 `'materials'`)。
- **计算属性**:
  - `groups`: 一个包含总计信息和模块拆解信息的数组。每个元素包含 `title`, `value`, `items`。

### 1.2 StationModuleDetail.vue (Group Component)
- **职责**: 这是一个双层结构的组件，合并了分组标题与内容列表。
- **Props**: 
  - `title`: 分组标题名称（如“总建设费用”或“硅矿精炼厂”）。
  - `count`: 模块数量（仅在 `variant="module"` 时有效）。
  - `value`: 分组右侧显示的数值（Cr）。
  - `items`: 该分组下的物料列表数据。
  - `variant`: `'summary' | 'module'`，决定标题的视觉风格。
- **实现细节**:
  - 内部使用 `CollapsibleDetailList` 实现折叠效果。
  - 直接在列表插槽中渲染物料行，视觉风格对齐 `StationWareFlow` 但移除操作栏。

## 2. 视觉规范 (Visual Specification)

### 2.1 字体与颜色映射 (Font & Color Mapping)
仪表盘的视觉风格必须严格对齐 `StationWareFlow` 系列组件：

| 元素 (Element) | 参考来源 (Reference) | 视觉效果 (Style) |
| :--- | :--- | :--- |
| **总建设成本标题** | `WareFlowGroup` 分组标题 | `text-sm font-bold text-slate-300` |
| **产线标题 (名称)** | `WareFlow` 资源项主行名称 | `text-sm font-medium text-slate-200` |
| **产线标题 (符号 x)** | `WareFlow` 明细行符号 | `opacity-30 scale-90 text-slate-500` |
| **产线标题 (数量)** | `WareFlow` 资源项主行名称 | `text-sm font-medium text-slate-200` |
| **价格 (总计/模块)** | `WareFlow` 负值状态 (`value-neg`) | `text-sm font-bold font-mono text-red-400` |
| **材料明细名称** | `WareFlow` 明细行产线名 | `text-xs font-normal text-slate-400` |
| **材料明细价格** | `WareFlow` 明细行产线成本 | `font-mono font-medium text-red-400/70` |
| **材料明细数量** | `WareFlow` 明细行数量 | `font-mono text-slate-500` |
| **材料明细符号 x** | `WareFlow` 明细行符号 | `opacity-30 scale-90 text-slate-500` |

### 2.2 布局规范 (Layout Specification)
- **Header 布局**:
  - 左侧: `header-title` (text-base font-bold text-slate-100)。
  - 右侧: `header-right-group` (flex items-center gap-4)，包含 `view-mode-switcher`。
  - **移除**: 标题右侧不再显示 `[Cr]` 样式的单位标识。

### 2.3 逻辑说明
- **颜色选择**: 由于建设成本属于“支出”范畴，其价格颜色统一采用 `red-400` 系，以区别于收入。
- **标题格式**: 产线分组标题采用 `模块名称 x 数量` 格式。
- **弱化符号**: 产线标题中的 `x` 符号通过降低透明度和缩放进行弱化，但数量部分保持与名称一致的视觉强度。

### 2.4 analyzeStation 函数 (New)
- **位置**: `src/store/logic/analyzeStation.ts`
- **职责**: 将空间站原始模块数据转换为结构化的仪表盘数据。
- **输入**:
  - `modules`: `StationModule[]` (原始模块列表)
  - `priceMultiplier`: `number` (0-100)
- **处理逻辑**:
  1. **模块合并**: 使用 Map 按 `moduleId` 聚合模块，叠加 `count`。
  2. **模块排序**: 按照 `modules` 中的顺序对聚合后的模块进行排序。
  3. **材料计算**: 为每个聚合模块计算其建设材料需求。
  4. **材料排序**: 每个模块内部的材料列表，以及总计材料列表，均按 `ware.tier` 降序排序，若 `tier` 相同则按 `name` 字母升序排序。
  5. **汇总生成**: 生成“总建设费用”分组。
- **输出数据结构**:
  ```typescript
  {
    totalCost: number,
    summaryItems: Array<{ id: string, count: number, price: number }>,
    moduleGroups: Array<{
      id: string,
      count: number,
      value: number,
      items: Array<{ id: string, count: number, price: number }>
    }>
  }
  ```

### 2.5 i18n 规范
- **原则**: 翻译工作应在 UI 组件层完成，逻辑函数 `analyzeStation` 仅返回原始 ID 与数值。
- **键名**:
  - `ui.materials_view`: "Materials" (英文) / "材料视图" (中文)
  - `ui.time_view`: "Time" (英文) / "时间视图" (中文)
  - `ui.workers_view`: "Workers" (英文) / "工人统计" (中文)
  - `ui.total_build_cost`: "总建设费用"
- **原则**: 严禁在组件中使用 `|| 'Fallback'` 硬编码文案。

## 3. 样式方案 (Styling)

- **容器**: 使用 `bg-slate-900/40` 背景，搭配 `backdrop-blur-sm` 和 `border-slate-800`。
- **字体**: 数值部分使用 `font-mono` 以确保对齐。
- **配色**:
  - 费用值使用 `text-slate-200`（中性）或根据 `PriceSlider` 调整后的颜色。
  - 分组标题高亮使用 `text-sky-400`。
