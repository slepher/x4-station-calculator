# sector-hub-transport Tasks

## Implementation

- [x] 1. 创建 transit route 纯逻辑模块
  - [x] 1.1 从 map clusters/sectors 构建 sector edge 图
  - [x] 1.2 支持 gate edge：星门数 +1，距离不计
  - [x] 1.3 支持 superhighway edge：星门数不加，端点直线距离只作为明细距离
  - [x] 1.4 生成不重复 sector 的候选路径
  - [x] 1.5 返回搜索上限内的候选路径，不默认固定截断为 3 条
  - [x] 1.6 未选船时按普通距离、星门数、枚举顺序选择最优路径
  - [x] 1.7 输出路径段、terminal、普通距离、superhighway 距离、engine/highway 摘要指标与问题节点

- [x] 2. Highway 路径替代实现
  - [x] 2.1 创建 highway spline 线性插值模块（弧长计算、最近点投影）
  - [x] 2.2 在 segment 展开阶段，对 sector 内普通空间段生成 highway 替代
  - [x] 2.3 对每条 highway 检查方向适合性（P_entry param < P_exit param）
  - [x] 2.4 实现距离过滤规则（直达 < approach + exit → 剔除）
  - [x] 2.5 实现 gate 紧贴 highway 捷径（<1km 阈值，移除 approach/exit 段）
  - [x] 2.6 输出 highway 替代段，保持 `highwayAlternative` 结构

- [x] 2. 创建 transit transport presenter
  - [x] 2.1 从 active binding 解析当前 transit group 与 hub station
  - [x] 2.2 从 `connectedGroupIds` 组装 `Sector Group` route rows
  - [x] 2.3 从当前 group anchor sector 与 coverage sectors 组装 `Station` sector groups
  - [x] 2.4 计算 station production 产线数量并排序
  - [x] 2.5 统一收集无法完整计算的目标到问题组
  - [x] 2.6 保持 presenter 输出为 Vue 直接渲染结构

- [x] 3. 创建运输栏 Vue 组件
  - [x] 3.1 渲染 `Sector Group` 分类摘要与展开明细
  - [x] 3.2 渲染 `Station` 分类的 sector 层与 station 列表层
  - [x] 3.3 渲染 `问题组`
  - [x] 3.4 使用 km 与 0.1 精度显示距离和坐标
  - [x] 3.5 处理空态

- [x] 4. 接入 live transit 页面
  - [x] 4.1 在 live transit 页面使用 presenter
  - [x] 4.2 将右侧 `StationDashboard` 替换为运输栏组件
  - [x] 4.3 保留左侧 transit hub build/module 列表

- [x] 5. i18n 文案
  - [x] 5.1 更新 `src/locales/en.json`
  - [x] 5.2 更新 `src/locales/zh-CN.json`
  - [x] 5.3 highway 段 i18n（highway 段标签、与高速同行的动作文案）

- [x] 6. Build validation
  - [x] 6.1 运行 `npm run build`
  - [x] 6.2 若出现编译错误，修复后重新运行 `npm run build`

- [x] 7. Build validation (highway)
  - [x] 7.1 运行 `npm run build`
  - [x] 7.2 若出现编译错误，修复后重新运行 `npm run build`

- [x] 8. 地图高速环路星门高亮
  - [x] 8.1 将 `maps.highwayRings` 接入地图 link 生成层
  - [x] 8.2 仅当跨 cluster gate line 两端 gate 都属于环路时标记高亮
  - [x] 8.3 高亮 gate line 去重后只绘制一次
  - [x] 8.4 使用黄色与普通 gate line 1.5 倍线宽渲染

## Notes

- 本任务清单不包含测试代码编写与测试执行；测试工作由 `/x4:test` 或相关测试 workflow 处理。
- 不修改 Rust parser。
- `sector.highways`（蓝色环道）与 `cluster.sector_links`（superhighway 绿色六角门）是两种独立机制。
- Highway 替代仅在 segment 展开阶段生效，不参与 route builder 的 sector 级图搜索。
