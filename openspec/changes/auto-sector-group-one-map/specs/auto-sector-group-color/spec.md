# Hub Color Specification

## Purpose

定义自动星区划分中 hub 颜色的自动分配、持久化、UI 交互和地图染色行为。

## ADDED Requirements

### Requirement: Color Auto-Assignment

系统 MUST 在自动分组计算时为缺色、新增或颜色冲突的 hub 分配颜色，并尽量保持已有颜色稳定。颜色仅用于地图显示区分，不代表用户业务选择。用户通过色卡调整的是预设颜色，不是不可更改颜色；系统 MAY 在后续 compute 中修改存在冲突的预设颜色。

#### Scenario: Existing automatic color preserved when valid
- **前提** 某 hub 已有 `color` 值
- **并且** 该颜色与自身定位星区、覆盖星区 faction 色均不满足冲突判定
- **并且** 该颜色与 5 跳以内已固定 hub 颜色均不满足冲突判定
- **当** 用户点击 [计算]
- **那么** 系统 SHALL 保留该 `color`
- **并且** SHALL 将该颜色作为后续 hub 的固定避色输入

#### Scenario: Existing automatic color reassigned when conflicting
- **前提** 某 hub 已有 `color` 值
- **并且** 该颜色与自身定位星区、覆盖星区 faction 色满足冲突判定
- **或** 该颜色与 5 跳以内已固定 hub 颜色满足冲突判定
- **当** 用户点击 [计算]
- **那么** 系统 SHALL 重新为该 hub 分配颜色

#### Scenario: Color conflict threshold
- **前提** 系统比较两个可解析颜色
- **当** 两个颜色的 CIE2000 ΔE < 10
- **那么** 系统 SHALL 判定为颜色冲突
- **当** 两个颜色都具备足够 chroma 可比较 hue，并且 OKLCH hue 距离 < 10°
- **那么** 系统 SHALL 判定为颜色冲突
- **当** ΔE ≥ 10，并且 hue 不参与比较或 OKLCH hue 距离 ≥ 10°
- **那么** 系统 SHALL NOT 判定为颜色冲突

#### Scenario: User preset color can be recomputed
- **前提** 用户通过色卡为某 hub 选择过预设颜色
- **并且** 后续 [计算] 或提交前交互发现该颜色与自身 faction 色或 5 跳内 hub 颜色冲突
- **当** 系统执行颜色稳定流程
- **那么** 系统 MAY 修改该 hub 的颜色
- **并且** 系统 SHALL NOT 将用户选择视为不可更改颜色

#### Scenario: Stage 1 — avoid self and coverage faction colors
- **前提** 某 hub 需要分配颜色
- **并且** 其定位星区或覆盖星区存在可解析 faction 色
- **当** 系统从 27 彩色候选池中分配颜色
- **那么** 系统 SHALL 避开该 hub 的定位星区 faction 色
- **并且** SHALL 避开该 hub 的覆盖星区 faction 色
- **并且** ownerless、缺失 owner_color 或无法解析的 faction 色 SHALL NOT 参与避色
- **并且** 系统 SHALL 按 ΔE ≥ 20 → 15 → 10 → 5 → 0 逐步降低阈值，直到获得至少 5 个候选或无进一步放宽空间
- **并且** SHALL 将剩余候选传递给 Stage 2

#### Scenario: Stage 2 — gradually avoid 5-hop hub context
- **前提** Stage 1 产生 N 个候选（N > 0）
- **并且** 存在 5 跳内的其他 hub
- **当** 系统尝试分配
- **那么** 系统 SHALL 只使用 5 跳以内 hub 作为避色输入
- **并且** SHALL 允许与 5 跳外 hub 颜色重复
- **并且** 避色输入 SHALL 包含 5 跳以内已固定/已分配 hub 颜色
- **并且** 避色输入 SHALL 包含 5 跳以内 hub 的中央/定位星区 faction 色
- **并且** 系统 SHALL 先尝试 ΔE ≥ 20 过滤
- **并且** 若无候选 SHALL 逐步放宽至 15 → 10 → 5
- **并且** 若多个候选通过当前阈值 SHALL maximin 选最优

#### Scenario: Stage 2 — no 5-hop hubs
- **前提** Stage 1 产生 N 个候选
- **并且** 不存在 5 跳内其他 hub
- **当** 系统分配
- **那么** 系统 SHALL 直接取第一个候选

#### Scenario: New coverage faction does not conflict
- **前提** 某 hub 已有自动颜色
- **当** 用户在 [计算] 后到提交前调整该 hub 覆盖星区，并因覆盖计算新增覆盖星区
- **并且** 新增覆盖星区 faction 色与该 hub 颜色不满足冲突判定
- **那么** 该新增覆盖星区 SHALL NOT 单独触发该 hub 重分配
- **并且** 系统 SHALL NOT 改变其他 hub 的颜色

#### Scenario: New coverage faction conflicts
- **前提** 某 hub 已有自动颜色
- **当** 用户在 [计算] 后到提交前调整该 hub 覆盖星区，并因覆盖计算新增覆盖星区
- **并且** 新增覆盖星区 faction 色与该 hub 颜色满足冲突判定
- **那么** 系统 SHALL 仅对该 hub 即时重新分配颜色
- **并且** 系统 SHALL NOT 改变其他 hub 的颜色

#### Scenario: New hub gets color
- **前提** 用户在编辑态新增 hub draft
- **当** 用户在 [计算] 后到提交前完成新增 hub 操作
- **那么** 系统 SHALL 仅为该新增 hub 分配颜色
- **并且** 系统 SHALL NOT 改变其他 hub 的颜色

#### Scenario: Interactive edit affects at most one hub color
- **前提** 用户已点击 [计算] 且尚未提交
- **当** 用户新增一个 hub 或调整一个 hub 的覆盖星区
- **那么** 系统 SHALL 只判断当前被调整的 hub 是否需要重新分配颜色
- **并且** 单次操作 SHALL NOT 自动改变超过一个 hub 的颜色

#### Scenario: Missing saved color waits for calculation
- **前提** 系统从已保存 binding 恢复为 result
- **并且** 某 group 的 `color` 为 null 或 undefined
- **当** result 构建完成
- **那么** 系统 SHALL NOT 单独为该 group 补色
- **当** 用户点击 [计算] 后进入颜色稳定流程
- **那么** 系统 SHALL 为该缺色 group 分配颜色

### Requirement: Color Card UI

系统 MUST 在 SectorGroupCard 中展示 hub 色卡，支持在编辑态打开颜色选择器。

#### Scenario: Color swatch visible in all states
- **前提** SectorGroupCard 渲染
- **当** group 有 `color`
- **那么** 系统 SHALL 在标题行显示 16×16 色块，填充该颜色
- **当** group 无 `color`
- **那么** 系统 SHALL 显示虚线边框透明色块

#### Scenario: Edit state opens SketchPicker
- **前提** SectorGroupCard 处于编辑态
- **当** 用户点击色卡
- **那么** 系统 SHALL 以 popover 方式打开 SketchPicker
- **并且** SketchPicker SHALL 展示 30 色预设色板（10×3 Grid）
- **并且** 当前颜色 SHALL 有蓝色选中环

#### Scenario: Preset click dismisses popover
- **前提** SketchPicker popover 已打开
- **当** 用户点击预设色块
- **那么** 系统 SHALL 更新 `group.color` 并关闭 popover

#### Scenario: Transparent preset clears color
- **前提** SketchPicker popover 已打开
- **当** 用户点击透明预设色块
- **那么** 系统 SHALL 将 `group.color` 置为 undefined
- **并且** SHALL NOT 保存 `0x00000000` 或其他透明色值
- **并且** 地图 SHALL NOT 为该 hub 绘制内部六边形

#### Scenario: Non-edit state swatch is static
- **前提** SectorGroupCard 不在编辑态
- **当** 用户点击色卡
- **那么** 系统 SHALL NOT 打开选择器

### Requirement: Color Persistence

系统 MUST 持久化 group 颜色并在加载时正确恢复。

#### Scenario: Color saved to localStorage
- **前提** 用户确认自动分组草案
- **当** 系统调用 `createAutoGroups`
- **那么** 每个 `BindingSectorGroup` SHALL 携带 `color` 字段写入 localStorage

#### Scenario: Color restored on reload
- **前提** localStorage 中存在带 `color` 的 group
- **当** 系统初始化 store
- **那么** `normalizeState()` SHALL 保留 `color` 字段

#### Scenario: Legacy data without color
- **前提** 旧数据 group 无 `color` 字段
- **当** 系统加载
- **那么** `normalizeState()` SHALL NOT 报错
- **并且** group 的 `color` 为 `undefined`
- **并且** 下次计算时 SHALL 自动分配

### Requirement: Map Sector Coloring

系统 MUST 在 binding 界面的地图上用 hub 颜色标记其覆盖星区；普通地图模式不显示 persisted binding 的 hub 覆盖星区染色。

#### Scenario: Coverage sectors are mutually exclusive
- **前提** 自动星区划分结果存在多个 hub
- **当** 系统构建 `sectorGroupColorMap`
- **那么** 每个 sector SHALL 至多映射到一个 hub 颜色
- **并且** 系统 SHALL NOT 需要处理多个 hub 同时覆盖同一 sector 的颜色优先级

#### Scenario: Inner hexagon drawn for coverage sectors
- **前提** 某 hub 有颜色且 coverage 包含 sector S
- **当** 地图渲染 S
- **那么** 系统 SHALL 在六边形中心绘制 2/3 半径的内部六边形
- **并且** 填充色为 hub 的 `color`，无边框
- **并且** 无颜色时 SHALL NOT 绘制内部六边形

#### Scenario: No color maps to no overlay
- **前提** 某 hub 无颜色
- **当** 地图渲染其 coverage 星区
- **那么** 系统 SHALL NOT 绘制内部六边形

#### Scenario: Render order
- **前提** 地图渲染星区
- **当** 系统绘制图层
- **那么** faction owner 色 SHALL 在最底
- **并且** hub 染色 SHALL 在其上
- **并且** resource pie 覆盖 SHALL 在最顶
