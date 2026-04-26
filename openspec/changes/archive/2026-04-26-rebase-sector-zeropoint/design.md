# rebase-sector-zeropoint Design

## Architecture

本次变更围绕“sector 内部原点重定义”展开，分成三层同步：

1. 地图处理链负责产出新的 sector center 与局部投影基线。
2. 前端坐标工具负责消费 `raw_center_pos`，并为未重生成数据提供同规则兜底重算。
3. 存档后处理链负责把 save POI / 站点位置转换成与当前地图一致的 `position + tx/ty` 语义。

## Decisions

### D1: Sector Center 改为 zone 包围盒中心并吸附 64000 网格

**决策**：sector center 由该 sector 全部 zone 的三维坐标包围盒中心决定，其中 `x/z` 必须吸附到最近的 `64000` 倍数，`y` 保持包围盒中心原值。

**理由**：

- 旧的 `0,0,0` 原点对大量星区并不对应真实的内部几何中心
- 仅使用星门或 `shcon` 会遗漏 sector 其他 zone 对内部尺度的贡献
- 吸附到固定网格后，center 具有稳定性，避免因细微坐标波动导致 center 漂移

### D2: Sector 内部缩放基于“全部 zone + gate”相对新中心的最大半径

**决策**：`scale_per_radius` 的重算范围必须至少覆盖所有 zone 与 cluster gate 的局部点，且半径计算相对 `raw_center_pos` 进行。

**理由**：

- 缩放语义必须与新的原点定义一致，否则 `sx/sy` 与 sector 范围会互相矛盾
- 如果继续以旧原点或不完整点集计算，前端会出现 sector 内点位偏移或边界被压缩的问题

### D3: 前端统一通过坐标工具消费 sector center

**决策**：前端不再在各处直接写 `x * scale / -z * scale`，统一改为坐标工具函数处理。

**数据流**：

1. 优先读取 `sector.raw_center_pos`
2. 若旧数据没有该字段，则从 `sector.zones[*].raw_sector_pos` 按同一规则兜底推导 center
3. 使用 `(x - center_x, z - center_z)` 与 `scale_per_radius` 生成 sector 内局部 ratio
4. 再进入 cluster ratio 与 screen 坐标换算

**影响点**：

- zone / gate / highway 局部点
- 存档 POI 叠加层
- 站点放置 overlay
- 拖拽预览 overlay

### D4: 存档后处理预写入 `position.tx/ty`

**决策**：`saveParser.post.ts` 在构建 `position` 时直接写入 `tx`、`ty`，地图渲染层只消费预处理结果。

**理由**：

- 避免渲染层重复推导 sector scale / center
- 保证 save POI 与 sector/gate/highway 使用同一版本的坐标语义
- 让存档条目坐标结构统一为 `position`

### D5: 地图数据结构显式记录 center 与局部点语义

**决策**：

- sector 显式记录 `raw_center_pos`
- zone 取消 `position`
- zone 的 `raw_sector_pos` 承担原始局部坐标与预计算投影结果

**理由**：

- 避免一个 zone 同时暴露两套局部坐标字段，导致消费端混用
- `raw_center_pos` 让生成物可审计，也便于 tooltip 和调试输出直接读取

### D6: Tooltip 用 km 显示 center

**决策**：sector tooltip 用 `(xxkm, xxkm)` 显示中心点的 `x/z`，数值取整，不直接暴露原始米级浮点数。

**理由**：

- tooltip 目标是帮助用户快速理解 sector 中心位置，而不是调试精度坐标
- km 级别更适合地图 UI

## Affected Artifacts

### 地图生成链

- `scripts/processor/map/generator.py`
- `scripts/processor/step1_map/generator.py`
- `scripts/x4_data_map_processor.py`

### 前端坐标消费链

- `src/components/map/utils/coordinates.ts`
- `src/composables/useMapSvgLinks.ts`
- `src/composables/useMapSvgOverlays.ts`
- `src/components/map/MapWorkbenchView.vue`
- `src/components/map/MapSvgCanvas.vue`
- `src/components/map/MapSectorTooltip.vue`

### 存档后处理链

- `src/workers/saveParser.post.ts`
- `src/types/saveArchive.ts`
- `src/store/useSaveStore.ts`

## Risks

### R1: 旧缓存数据与新中心语义不一致

如果 `maps.json` 或 IndexedDB 中仍保留旧结构，前端需要依赖兜底重算逻辑，短期内会存在“源码逻辑已切换但静态产物未重生成”的过渡态。

### R2: 隐式 `0,0,0` 假设遗漏

任何仍然手写 `x * scale` / `-z * scale` 的位置都可能继续错位，因此必须集中收口到坐标工具函数。
