# Hub 色卡与地图星区染色 (auto-sector-group-color)

## 目标

为自动星区划分中的每个 hub 分配颜色（色卡），并在 Live Production 的地图六边形上对覆盖星区染色，让用户直观区分各 hub 的管辖范围。

本变更依赖 `auto-sector-group-merged` 的 `GroupDraftInfo`、`BindingSectorGroup`、SectorGroupCard 和地图渲染层。

## 已确认方案

### 1. 色板

- 固定 30 色色板：27 彩色（取自 CompactPicker 默认按色系 9×3 排列）+ 白/黑/透明
- SketchPicker UI 展示为 10 列 × 3 行 Grid
- 自动分配仅从 27 彩色中选择；白/黑/透明仅能由用户从色卡选择
- 透明是清空颜色的预设：选择透明等同于 `color = undefined`，不保存为 `0x00000000` 或其他透明色值

### 2. 颜色自动分配与稳定策略

颜色仅用于地图上的 hub 管辖范围区分，不代表用户业务选择。用户可以通过色卡调整预设颜色，但颜色不可锁定：预设颜色会被保存以保持相对稳定，但后续 [计算] 或提交前交互调整仍可在发现冲突时修改它。

**颜色稳定总览**

| 时机 | 处理范围 | 规则 |
|------|----------|------|
| Clean slate / Incremental / [计算] | 可批量处理多个 hub | 先保留满足约束的既有颜色，再为缺色、新增、冲突 hub 分配颜色 |
| [计算] 后到提交前：新增 hub | 仅新增 hub | 只为新增 hub 分配颜色，不改变其他 hub |
| [计算] 后到提交前：调整覆盖星区 | 仅当前 hub | 只判断并可能重分配当前 hub，不改变其他 hub |
| 色卡选色 | 仅当前 hub | 更新当前 hub 的预设颜色；该颜色可持久化，但后续 compute 可在冲突时修改 |
| 从已保存 binding 恢复为 result | 不补色 | 缺色保持缺色，等待下次 [计算] 后补色 |

**Stage 0 — 先判定可保留颜色**

用户点击 [计算] 时，系统先检查每个已有颜色的 hub。已有颜色若同时满足以下条件，则加入固定颜色集合并保持不变：

- 与自身定位星区 faction 色、覆盖星区 faction 色的 ΔE 均 > 5
- 与 5 跳以内 hub 的已固定颜色不重复；重复按 ΔE ≤ 5 判定

点击 [计算] 后到提交之前，用户每次操作只会调整一个 hub：新增一个 hub，或调整一个 hub 的覆盖星区。因此交互态颜色稳定只判断当前被调整的 hub，且一次最多重分配这一个 hub 的颜色。

若当前操作因覆盖计算新增覆盖星区，且新增覆盖星区 faction 色与该 hub 当前颜色 ΔE > 5，则该新增覆盖星区本身不触发重新分配。若新增覆盖星区与当前颜色 ΔE ≤ 5，或当前操作新增 hub，或当前 hub `color` 为 null/undefined，或当前 hub 现有颜色与定位/覆盖星区 faction 色、5 跳内 hub 颜色发生冲突，则仅对当前 hub 即时重新分配颜色。

**Stage 1 — 避开自身定位与覆盖星区 faction 色**

对待分配 hub，从 27 彩色中筛选候选，避开的 faction 色包括：

- hub 中央/定位星区 faction 色
- hub 覆盖星区 faction 色

ownerless、缺失 owner_color 或无法解析的 faction 色不参与避色。

Stage 1 使用逐步降低阈值的方式获得至少 5 个候选：按 ΔE ≥ 20 → 15 → 10 → 5 → 0 依次尝试。达到至少 5 个候选时停止；如果 27 彩色总数仍不足 5 个可用候选，则使用当前可用候选继续 Stage 2。

**Stage 2 — 避开 5 跳内 hub**

Stage 2 只考虑 5 跳以内的 hub，允许与 5 跳外 hub 颜色重复。避色集合包含：

- 5 跳以内已固定或已分配 hub 的颜色
- 5 跳以内 hub 的中央/定位星区 faction 色

对 Stage 1 候选逐步降低 ΔE 阈值，直到找到可用候选：

| 尝试 | 条件 | 说明 |
|------|------|------|
| 1 | 候选色与 5 跳内避色集合 ΔE ≥ 20 | 严格避色 |
| 2 | ΔE ≥ 15 | 放宽 |
| 3 | ΔE ≥ 10 | 再放宽 |
| 4 | ΔE ≥ 5 | 再放宽 |
| 5 | 不做过滤 | 从 Stage 1 候选中 maximin 选最优 |

多个候选可选时，用 maximin 取与避色集合最小距离最大者。批量计算阶段处理一个重分配 hub 后，将其颜色加入已分配集合，再处理下一个 hub；点击 [计算] 后到提交前的交互调整阶段，只处理当前被调整的单个 hub。

**Stage 3 — 极端 Fallback**

仅当颜色解析失败、Stage 1/2 无法产生任何候选时，才随机生成颜色。

- 5 跳外的 hub 色不参与避色
- 允许 5 跳外重复颜色，不做全局唯一性限制
- ΔE 计算使用 culori CIE2000

### 3. 分配时机

- **Clean slate / Incremental 首次计算**：所有 hub 均无颜色 → 按算法分配
- **[计算] 重算**：
  - 先判定可保留颜色
  - 对新增、缺色、或与自身/5 跳内约束冲突的 hub 重分配
  - 已满足约束的 `color` 保留
- **[计算] 后到提交前的交互调整**：
  - 新增 hub 时，只为该新增 hub 分配颜色
  - 调整某 hub 覆盖星区时，只判断并可能重分配该 hub 颜色
  - 一次用户操作最多改变一个 hub 的颜色
- **用户通过色卡选色**：直接覆盖当前 `group.color`，作为新的预设颜色；若选择透明，则清空为 `undefined`

### 4. 数据持久化

| 位置 | 字段 | 说明 |
|------|------|------|
| `BindingSectorGroup` | `color?: string` | 持久化到 localStorage，用于保持颜色相对稳定 |
| `GroupDraftInfo` | `color?: string` | draft 阶段携带 |
| `normalizeState()` | `color: group.color` | 加载时保留 |

旧数据无 `color` 字段不报错，视为"未着色"，下次点击 [计算] 后由颜色稳定流程自动补色。

透明色不持久化为颜色值。用户选择透明时应删除/置空 `color` 字段；地图不绘制该 hub 的内部六边形。

### 5. UI — SectorGroupCard 色卡控件

| 维度 | 说明 |
|------|------|
| 位置 | `group-title-row` 中，group name 与详情按钮之间 |
| 外观 | 16×16 圆角色块；有颜色填充，无颜色虚线边框 |
| 状态覆盖 | 默认态、计算结果态、编辑态**均显示**色卡 |
| 编辑态交互 | 点击色块弹出 SketchPicker（10×3 色板 + SV 取色区）；点预设色 dismiss |
| 非编辑态 | 色块仅展示，不可点击 |

**SketchPicker 配置：**

- 组件：`vue-color` 的 `SketchPicker`
- `disable-alpha`：true（禁用透明度）
- `preset-colors`：`HUB_PALETTE`（30 色）
- 容器宽度：260px
- 预设区：CSS Grid `repeat(10, 1fr)`，间距 3px
- 选中态：`aria-selected="true"` → 蓝色双层 ring（`#1e293b` + `#60a5fa`）
- dismiss 行为：点预设色块关闭，拖拽 SV/Hue 不关闭，ESC/点遮罩关闭
- 点击透明预设时清空 `group.color`

### 6. 地图星区染色

- 覆盖星区从定义上互斥：一个星区最多被一个 hub 覆盖，因此 `sectorGroupColorMap` 不需要处理多 hub 同星区冲突
- 对每个 hub 的 coverage 星区，在 `MapSectorLayer` 六边形中心绘制 2/3 半径的内部填充六边形
- 颜色为对应 hub 的 `color`，无边框
- 当 hub `color` 为 undefined（包括选择透明后）时，不绘制内部六边形
- 渲染层级：faction owner 色之上，resource pie 之下
- 新的 prop：`sectorGroupColorMap: Record<string, string>`（sectorMacro → color）

### 7. 依赖

- `vue-color`：SketchPicker（已安装）
- `culori`：ΔE 计算（已安装）
- 无需新增 npm 依赖

## 边界

In Scope：
- 色卡控件在 SectorGroupCard 中的展示与交互
- 颜色自动分配算法（三阶段 + culori maximin）
- `color` 字段持久化到 `BindingSectorGroup` 和 `GroupDraftInfo`
- `normalizeState()` 兼容 `color` 字段
- 地图六边形 2/3 区域染色
- 旧数据兼容（无 color 不报错）
- i18n 文案

Out of Scope：
- Terraforming / Research / Blueprint Recipe
- `MapBindingSectorGroup` 交互改造
- 颜色在 Live transit / EmpireWareFlowsDashboard 中的展示
- 色差阈值 UI 可配置

## 验收标准

1. 自动分组生成后每个 hub 有可用于地图区分的颜色
2. hub 颜色优先避开自身定位/覆盖星区 faction 色；ownerless 不参与避色
3. 5 跳以内 hub 颜色优先区分，允许与 5 跳外 hub 颜色重复
4. SectorGroupCard 在所有状态下显示色卡，编辑态可打开 SketchPicker 选色
5. 色卡选色后颜色持久化，reload 不丢失；选择透明时清空颜色且不绘制地图染色
6. [计算] 后满足约束的已有颜色保留；新增、缺色或冲突 hub 自动重分配
7. 用户调整的预设颜色可被后续 compute 在冲突时修改，不存在锁定颜色
8. 点击 [计算] 后到提交前，新增 hub 或调整覆盖星区时，一次最多自动改变当前被调整的一个 hub 颜色
9. 从已保存 binding 恢复为 result 时不单独补色；缺色 group 在下次 [计算] 后补色
10. 地图上各 hub coverage 星区 2/3 中心区域显示对应颜色；覆盖星区互斥，无需多 hub 颜色冲突处理
11. `npm run build` 通过

## 未决项

无
