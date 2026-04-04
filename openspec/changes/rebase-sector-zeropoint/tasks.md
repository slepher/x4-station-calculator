# rebase-sector-zeropoint Tasks

## Phase 1: 地图生成链

### T1.1 重定义 sector center

- [x] 收集 sector 下所有 zone 的三维坐标
- [x] 基于 zone 点集计算包围盒中心
- [x] 将 `x/z` 吸附到最近的 `64000` 倍数
- [x] 输出 `sector.raw_center_pos`

### T1.2 重算 sector 内部缩放

- [x] 将全部 zone 坐标纳入 sector 点集范围
- [x] 保留 gate 对 sector 半径的贡献
- [x] 基于相对新 center 的最大半径重算 `scale_per_radius`

### T1.3 同步局部投影输出

- [x] 更新 `cluster_gates[*].raw_local_pos.sx/sy`
- [x] 更新 `zones[*].raw_sector_pos.sx/sy`
- [x] 更新 `highways[*].entry_sr/exit_sr/spline_sr`
- [x] 更新 sector 内站点 `raw_sector_pos.sx/sy`

### T1.4 调整地图数据结构

- [x] 移除 `zones[*].position`
- [x] 为 `zones[*].raw_sector_pos` 补齐 `y`
- [x] 调整 sector 序列化字段顺序

## Phase 2: 前端坐标消费链

### T2.1 收口 sector 局部投影逻辑

- [x] 在坐标工具中实现 `raw_center_pos` 优先消费
- [x] 为旧数据提供按 zone 点集推导 center 的兜底逻辑
- [x] 统一 gate / overlay / preview 的 sector 局部投影入口

### T2.2 修正放置与预览错位

- [x] 站点放置 overlay 改为使用统一坐标工具
- [x] 拖拽预览改为使用统一坐标工具

### T2.3 增强 sector tooltip

- [x] 在 tooltip 中显示 sector center
- [x] 显示格式改为 `(xxkm, xxkm)` 且取整

## Phase 3: 存档坐标同步

### T3.1 统一存档条目坐标结构

- [x] 存档 POI / 站点统一使用 `position`
- [x] `position` 保留 `x/y/z`
- [x] 在后处理阶段写入 `position.tx/ty`

### T3.2 对齐新的 sector center 语义

- [x] 存档后处理按 zone + sector center 计算最终位置
- [x] 地图消费 save POI 时直接读取 `position.tx/ty`
- [x] 坐标列表与 tooltip 改为读取 `position`

## Phase 4: 文档与验证

### T4.1 补充变更文档

- [x] 更新本 change 的 `request.md`
- [x] 更新本 change 的 `design.md`
- [x] 补充受影响 specs 的 delta spec

### T4.2 构建变更范围验证说明

- [x] 记录坐标工具与存档后处理单测覆盖点
- [x] 记录该变更不包含历史缓存迁移策略
