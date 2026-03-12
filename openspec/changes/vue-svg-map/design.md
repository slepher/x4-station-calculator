# vue-svg-map 设计说明

## 设计目标
在不破坏现有地图入口（`maps` tab、`?router=maps`）的前提下，将地图渲染迁移到 Vue 组件化 SVG，并把 i18n 与交互能力内聚到前端运行时。

## 1. 架构概览

### 1.1 组件分层
- `MapWorkbenchView`：地图页面容器，持有缩放/拖拽状态与控制条 UI。
- `MapSvgCanvas`（新增）：负责 SVG 图元渲染（cluster/sector/links/stations/labels）。
- `useMapRenderModel`（新增 composable）：将 `maps.json` 转为可直接绘制的扁平图元模型。

### 1.2 数据来源
- 结构数据：`src/assets/x4_game_data/8.0-Diplomacy/data/maps.json`
- 文本数据：`src/assets/x4_game_data/8.0-Diplomacy/locales/<lang>.json`
- 文本主键：地图实体的 `nameId`

## 2. SVG 渲染策略

### 2.1 图层顺序
- 背景层（底色）
- cluster/sector 几何层
- links/highways 线层
- 站点点位层
- 标签层（cluster/sector 名称）

### 2.2 样式策略
- 默认沿用当前静态图的视觉参数（线宽、透明度、标签字号）。
- 交互状态（hover/selected）通过 class 切换，不改底层数据结构。

### 2.3 当前视觉参数（已落地）
- 画布基准尺寸按 `1.8x` 放大（相对最初 3600x2600），以降低最小缩放百分比并保持图元相对比例不变。
- 标签字号：
  - 单 sector cluster 标签固定 `18px`。
  - 多 sector 标签按 `14 * sector_radius_ratio`，并设置最小字号 `8px`。
  - 标签垂直定位使用 `text-before-edge`（顶部基线）以避免中英文高度差导致漂移。
- 星门视觉：
  - 门点半径、门点描边、跨 cluster 门连线统一按 `1.5x` 放大。

## 3. i18n 策略

### 3.1 文本解析
- `resolveLabel(nameId, fallbackName)`：
  - 命中当前语言：返回 `locale[nameId]`
  - 未命中：返回 `fallbackName`
  - 再未命中：返回 `nameId`

### 3.2 响应式更新
- 标签文本由 `computed` 依赖当前语言状态生成。
- 语言切换后直接重渲染文本层，不触发地图数据再计算。

## 4. 交互模型

### 4.1 缩放
- `minScale = viewportWidth / mapWidth`（宽度贴合）。
- `maxScale` 按“cluster 半屏高度目标”计算。
- 在上述 `maxScale` 结果上施加倍率系数 `2x`，提升最大放大范围。
- 支持缩放条与滚轮同步更新。

### 4.2 平移
- 鼠标左键拖拽更新 `panX/panY`。
- 约束边界避免地图完全拖离可视区域。

### 4.3 缩放锚点
- 滚轮缩放使用鼠标坐标反算内容坐标，保持锚点稳定，减少跳动。

## 5. 迁移步骤
1. 新增 `MapSvgCanvas`，先渲染 cluster 主图层与名称。
2. 接入 i18n 文本解析函数，验证语言切换。
3. 补齐 sector/links/stations 图层并校准视觉。
4. 将 `MapWorkbenchView` 从 `<img maps.svg>` 完全切换到 `<MapSvgCanvas>`。
5. 清理静态图片渲染路径（保留生成脚本作为数据参考）。

## 6. 风险与对策
- 风险：图元数量上升导致渲染卡顿。
  - 对策：图层拆分 + `computed` 缓存 + 降低无效响应式依赖。
- 风险：缩放边界与不同屏幕尺寸不一致。
  - 对策：统一通过视口尺寸重算 `min/max scale`，并在 resize 时更新。
- 风险：i18n key 兼容问题（空格格式差异）。
  - 对策：读取时统一标准化 key（去空格）后查表。
