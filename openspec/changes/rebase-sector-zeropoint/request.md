# rebase-sector-zeropoint Change Request

## 目标

修正星区内部坐标系的原点与缩放语义，使地图数据、前端星区投影、以及存档兴趣点坐标使用一致的 sector center 定义，不再隐含依赖 `0,0,0` 作为星区内部原点。

## 已确认方案（审核重点）

### 星区中心点

- sector 中心不再固定为 `0,0,0`
- 系统改为收集该 sector 下所有 zone 的三维坐标，基于这些点生成包围盒
- 包围盒中心再吸附到最近的 `64000` 倍数网格
- 吸附后的结果作为 sector 的 `raw_center_pos`

### 星区内部缩放

- sector 内部缩放不是由网页端自由决定
- 地图处理链负责产出 sector 的基础缩放语义，前端消费同一语义并在必要时按同一规则重算
- 缩放范围需要包含所有 zone 坐标，而不仅仅是星门或 `shcon`

### 星区点位投影

- `cluster_gates`、`zones`、`highways`、sector 内站点等局部投影，都必须按“相对 `raw_center_pos` 偏移后再乘 `scale_per_radius`”计算
- `sy` 继续使用屏幕 Y 轴翻转语义，即 `-(z - center_z) * scale`

### 地图数据结构

- sector 新增 `raw_center_pos: { x, y, z }`
- zone 取消旧的 `position` 字段
- zone 的 `raw_sector_pos` 保留原始局部坐标，并补齐 `y`
- sector 输出字段顺序需要调整为：`raw_local_pos` → `raw_world_pos` → `raw_center_pos` → `normalized` → … → `regions` → `resources`

### 存档坐标统一

- `saveParser.post.ts` 需要按新的 sector center 语义重算存档兴趣点和站点位置
- 存档 POI 坐标统一收敛为 `position`
- `position` 额外写入 `tx`、`ty`，供地图直接消费，不再在渲染层临时现算
- 地图上的 save POI、站点放置、拖拽预览都必须使用同一套 sector center 投影规则，避免错位

### Tooltip 展示

- sector tooltip 需要显示星区中心坐标
- 展示格式为 `(xxkm, xxkm)`，数值取整

## 边界

### In Scope

- 地图生成脚本中的 sector center、scale、局部投影规则
- 地图运行时坐标换算与 sector 局部投影消费
- sector / zone 输出结构调整
- 存档 POI 与站点位置后处理规则同步
- sector tooltip 中心坐标展示

### Out of Scope

- 大地图级别 viewport 缩放规则
- 历史缓存存档的强制迁移策略
- 其他非坐标语义的地图性能优化文档

## 验收标准（DoD）

1. 生成后的 sector 数据包含 `raw_center_pos`
2. `raw_center_pos.x/z` 基于所有 zone 坐标包围盒中心并吸附到最近 `64000` 倍数
3. sector 内部 `scale_per_radius` 的范围计算包含所有 zone 坐标，而不只依赖星门
4. `zones[*]` 不再输出 `position`，并且 `raw_sector_pos` 包含 `x/y/z/sx/sy`
5. `cluster_gates`、`highways`、zone、sector 内站点的 `sx/sy` 语义统一为“相对 center 后缩放”
6. 存档 POI 与存档站点统一使用 `position` 字段，并预写入 `position.tx/ty`
7. 地图消费存档 POI 时直接读取 `position.tx/ty`，不再直接从 `x/z` 现算
8. 站点放置和拖拽预览在非 `0,0,0` 原点的 sector 中不发生错位
9. sector tooltip 显示 `(xxkm, xxkm)` 形式的中心坐标

## 未决项

无
