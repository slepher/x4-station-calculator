# Hub 色卡与地图染色 — 设计方案

## 架构概览

```
src/
├── store/logic/hubColor.ts          # 色板定义 + 三阶段分配算法
├── store/useSaveBindingStore.ts     # continue: 添加 color 到 normalizeState
├── components/empire/sector-overview/
│   └── SectorGroupCard.vue          # continue: 添加色卡控件
├── components/empire/presenters/
│   └── useAutoSectorGroupPresenter.ts # continue: 计算时调用分配算法
├── composables/useMapSvgSectors.ts  # continue: 接收 sectorGroupColorMap，绘制内部六边形
├── components/map/layers/
│   └── MapSectorLayer.vue           # continue: 渲染内部六边形
└── types/x4.ts                      # continue: BindingSectorGroup 加 color
```

## 参考

- `src/components/test/ColorTestPage.vue`：仅作为 `vue-color` 选色器、预设色板、popover 交互和样式覆写的参考页面；正式功能仍在 `SectorGroupCard.vue` 与 presenter/store 链路中实现。

## 数据模型

### BindingSectorGroup（`types/x4.ts`）

```ts
export interface BindingSectorGroup {
  // ... existing fields
  color?: string  // HEX like "#F44E3B"
}
```

### GroupDraftInfo（`store/logic/autoGroup.ts`）

```ts
interface GroupDraftInfo {
  // ... existing fields
  color?: string
}
```

### normalizeState（`useSaveBindingStore.ts`）

在 group 映射中添加：

```ts
color: group.color
```

## 色板定义（`store/logic/hubColor.ts`）

```ts
// UI 展示用：30 色
export const HUB_PALETTE: string[] = [
  '#F44E3B', '#FE9200', '#FCDC00', '#DBDF00', '#A4DD00', '#68CCCA', '#73D8FF', '#AEA1FF', '#FDA1FF', '#FFFFFF',
  '#D33115', '#E27300', '#FCC400', '#B0BC00', '#68BC00', '#16A5A5', '#009CE0', '#7B64FF', '#FA28FF', '#000000',
  '#9F0500', '#C45100', '#FB9E00', '#808900', '#194D33', '#0C797D', '#0062B1', '#653294', '#AB149E', 'transparent',
]

// 自动分配用：27 彩色
export const HUB_COLORFUL: string[] = [
  '#F44E3B', '#FE9200', '#FCDC00', '#DBDF00', '#A4DD00', '#68CCCA', '#73D8FF', '#AEA1FF', '#FDA1FF',
  '#D33115', '#E27300', '#FCC400', '#B0BC00', '#68BC00', '#16A5A5', '#009CE0', '#7B64FF', '#FA28FF',
  '#9F0500', '#C45100', '#FB9E00', '#808900', '#194D33', '#0C797D', '#0062B1', '#653294', '#AB149E',
]
```

## 分配算法

```
stabilizeHubColors(groups):
  1. fixed = []
  2. For each group with color:
       if color is valid against self faction colors (ΔE > 5)
          and not duplicate with fixed/5-hop hub colors (ΔE > 5):
         fixed.add(group.color)
       else:
         mark for reassignment
  3. For each null/new/conflicting group:
       group.color = pickHubColor(group, fixed)
       fixed.add(group.color)

stabilizeEditedHubColor(group, groups):
  1. Used only after [计算] and before submit.
  2. One user operation can add one hub or change coverage for one hub.
  3. If new coverage sectors were added and every newly added coverage faction color has ΔE > 5 from group.color:
       keep group.color.
  4. If group is new, color is null, or the current color conflicts with self faction colors / 5-hop hub context:
       group.color = pickHubColor(group, fixed colors from other hubs)
  5. Never change colors of other hubs in this interactive path.

pickHubColor(group, fixedColors):
  1. selfFactionColors = anchor sector faction + coverage sector factions
     ownerless/missing/unparseable colors are skipped
  2. Stage 1 candidates:
       For threshold in [20, 15, 10, 5, 0]:
         candidates = HUB_COLORFUL filtered by ΔE(candidate, every selfFactionColor) >= threshold
         Stop when candidates.length >= 5
  3. Stage 2 avoidColors:
       fixed colors of 5-hop hubs
       central/anchor sector faction colors of 5-hop hubs
  4. For threshold in [20, 15, 10, 5]:
       valid = candidates filtered by ΔE(candidate, every avoidColor) >= threshold
       If valid not empty: return maximin(valid, avoidColors)
  5. Return maximin(candidates, avoidColors)
  6. Fallback only when no candidate can be parsed: generate random color
```

- `ΔE` = culori `differenceCiede2000()`
- `maximin(candidates, existing)`: 选与 existing 中最近颜色的距离最大者
- 只比较 5 跳以内 hub；5 跳外 hub 允许重复颜色
- 随机颜色：用 `hsl(random, 50-80%, 35-65%)` 生成，确保可用性

## UI — SectorGroupCard 色卡

### 位置

`group-title-row` 内，group name 之后、详情按钮之前。

```html
<div class="group-title-row">
  <span class="group-name">{{ group.name }}</span>
  <button class="color-chip" :style="{ background: group.color }" @click="openPicker" />
  <button v-if="showSelectGroupButton" class="..." @click="selectGroup">详情</button>
</div>
```

### 色卡样式

- 16×16 圆角方块 (`border-radius: 4px`)
- 有颜色：`background: group.color`
- 无颜色：`border: 1px dashed #475569; background: transparent`
- 编辑态：`cursor: pointer`
- 非编辑态：`pointer-events: none`

### 选色器

**SketchPicker 组件配置：**

```html
<SketchPicker
  :model-value="group.color || '#3b82f6'"
  :preset-colors="HUB_PALETTE"
  :disable-alpha="true"
  @update:model-value="onColorUpdate"
/>
```

**Popover 行为：**

```html
<div class="popover" @click="(e) => {
  if ((e.target as HTMLElement).closest('.preset-color')) closePopover()
}">
  <SketchPicker ... />
</div>
```

- CSS 覆写：260px 宽、10×3 Grid、选中蓝环
- 点预设色块 → `group.color` 更新并 dismiss
- 点透明预设 → `group.color = undefined` 并 dismiss；不保存 `0x00000000`
- SV/Hue 取色区拖拽不 dismiss
- 点外部 overlay / Esc → dismiss

## 计算集成

在 `runCalculationFromEditInput()` 或等效位置：

```
计算完成后：
  collect anchor/coverage faction colors
  collect 5-hop hub color and anchor faction context
  stabilizeHubColors(result.groups)
```

点击 [计算] 后到提交前：

```
新增 hub:
  stabilizeEditedHubColor(newGroup, result.groups)

调整某 hub 覆盖星区:
  stabilizeEditedHubColor(changedGroup, result.groups)
```

该交互路径一次只处理当前被调整的一个 hub，不做全局颜色重排。

从已保存 binding 恢复为 result 时不单独补色；缺色 group 保持缺色状态，直到用户点击 [计算] 后进入统一的 `stabilizeHubColors(result.groups)` 流程。

## 地图染色

采用独立 layer 架构，避免 Hub 内六边形污染 `MapSectorLayer` 的 faction polygon / resource pie / badge / hover target 等职责。

### 文件结构

```
src/components/map/layers/
├── MapSectorLayer.vue             # faction sector polygon + resource pie + badge
└── MapSectorGroupColorLayer.vue   # hub coverage 内六边形（独立 layer）
```

### 数据流

- `useMapSvgSectors` 输出 `clusterPolygons`（已含各 sector 中心坐标、半径）
- `AutoSectorGroupMapPanel` ← `useAutoSectorGroupPresenter.sectorGroupColorMap`（provide）
- `MapSvgCanvas` inject `sectorGroupColorMap` → 传给 `MapSectorGroupColorLayer`
- `MapSectorGroupColorLayer` 接收 `clusterPolygons` + `sectorGroupColorMap` + `hexPoints`，渲染全尺寸六边形替代 faction 色（fill-opacity 0.35, no stroke）

### 渲染层级

```
<MapSectorLayer />              <!-- faction/base sector polygon -->
<MapSectorGroupColorLayer />    <!-- hub color inner hex -->
<MapOverlayLayer />             <!-- station overlays -->
```

覆盖星区互斥，一个星区最多属于一个 hub，因此 `sectorGroupColorMap` 不需要处理多 hub 同 sector 优先级。`color` 为 undefined 时不生成内部六边形；透明预设也通过 undefined 表示。

## 样式覆写（SketchPicker）

```css
.vc-sketch-picker { width: 260px; }
.presets { display: grid; grid-template-columns: repeat(10, 1fr); gap: 3px; padding: 10px 10px 8px; }
.preset-color { width: 100% !important; height: auto !important; aspect-ratio: 1; margin: 0 !important; }
.preset-color[aria-selected="true"] { box-shadow: 0 0 0 2px #1e293b, 0 0 0 4px #60a5fa !important; z-index: 1; }
```

需在 `main.ts` 中引入：
```ts
import 'vue-color/style.css'
```
