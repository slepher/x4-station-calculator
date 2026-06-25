# sector-hub-transport-ship Tasks

## Implementation

- [x] 1. 增加非持久运输船选择状态
  - [x] 1.1 在 `useLiveProductionStore` 增加 `selectedTransitTransportBlueprintId`
  - [x] 1.2 增加设置/清空 selected blueprint id 的 action
  - [x] 1.3 确保该状态不进入 localStorage 或 binding persistence

- [x] 2. 创建运输船 travel profile 纯逻辑
  - [x] 2.1 从 ship-build 收藏蓝图、ship map、equipment map 过滤 freighter/transporter 候选
  - [x] 2.2 排除缺失 ship/equipment/有效 engine 的不可用蓝图
  - [x] 2.3 聚合 `V_base`、`V_travel`、`t_charge`、`t_attack`、`t_release`
  - [x] 2.4 计算加速距离与减速距离
  - [x] 2.5 输出按飞船分组的候选 view model，按 cargo 和巡航速度排序

- [x] 3. 创建 segment 耗时与吞吐量计算纯逻辑
  - [x] 3.1 实现长距离 `charge + attack + cruise + release` 公式
  - [x] 3.2 实现短距离峰值速度公式
  - [x] 3.3 对 `D <= 0` 返回 0
  - [x] 3.4 跳过 `gate-transit` 与 `superhighway` 耗时
  - [x] 3.5 实现耗时与 `m3/h` 格式化

- [x] 4. Highway 耗时计算
  - [x] 4.1 实现 highway 段固定速度（12,000 m/s）耗时公式
  - [x] 4.2 S/M 船允许 highway，L/XL 禁用 highway
  - [x] 4.3 未选船时默认非 highway 方案
  - [x] 4.4 实现按船型构造候选池后再按真实耗时选择最终路线
  - [x] 4.5 gate 紧贴 highway（<1km）的 approach/exit 段移除
  - [x] 4.6 highway-approach 使用 skipRelease 模式（上高速无减速）
  - [x] 4.7 highway-exit 使用标准 charge+attack+cruise+release 模型

- [x] 5. 扩展 transit transport presenter
  - [x] 5.1 接入 ship-build 蓝图、ship、equipment 数据源
  - [x] 5.2 输出左侧运输船候选分组、空态、未选择提示状态
  - [x] 5.3 校验当前 selected blueprint 是否仍可用；不可用时提供清空信号
  - [x] 5.4 为 Sector Group row 和 segments 增加嵌套 `travel`
  - [x] 5.5 为 Station sector group 增加 `travel` 与 `hideSectorHeader`
  - [x] 5.6 为 Station row 增加 local/total/throughput `travel`
  - [x] 5.7 对接 highway 替代方案，输出 highway travel 估算
  - [x] 5.8 选择运输船后按 L/XL 与 S/M 不同候选指标筛选，再按候选 route 的真实耗时选择最终展示路径
  - [x] 5.9 每条候选使用自身 segment 端点独立计算 highway 替代

- [x] 6. 实现左侧运输船选择 UI
  - [x] 6.1 在 transit hub 建筑区下方接入选择组件或区域
  - [x] 6.2 渲染无候选提示与前往 ship-build 操作
  - [x] 6.3 渲染有候选未选择提示
  - [x] 6.4 渲染飞船分组、引擎列表和参数 chips
  - [x] 6.5 选择蓝图时调用 `useLiveProductionStore` action

- [x] 7. 扩展右侧运输路线 UI
  - [x] 7.1 Sector Group 摘要渲染耗时和单程吞吐量 metric chip
  - [x] 7.2 Sector Group 明细普通空间段渲染耗时列
  - [x] 7.3 Station 同星区隐藏 sector header，仅渲染 station row 估算
  - [x] 7.4 Station 跨星区 sector row 渲染耗时，明细渲染普通空间段耗时
  - [x] 7.5 Station row 渲染星区内耗时、总耗时、单程吞吐量
  - [x] 7.6 未选择运输船时不渲染新增耗时/吞吐量 UI

- [x] 8. i18n 文案
  - [x] 8.1 更新 `src/locales/en.json`
  - [x] 8.2 更新 `src/locales/zh-CN.json`
  - [x] 8.3 覆盖选择区、chips、耗时、单程吞吐量、空态与前往 ship-build 文案

- [x] 9. Build validation
  - [x] 9.1 运行 `npm run build`
  - [x] 9.2 若出现编译错误，修复后重新运行 `npm run build`

- [ ] 10. Build validation (highway)
  - [x] 10.1 运行 `npm run build`
  - [x] 10.2 若出现编译错误，修复后重新运行 `npm run build`

## Notes

- 本任务清单不包含测试代码编写与测试执行；测试工作由 `/x4:test` 或相关测试 workflow 处理。
- 不修改 Rust parser。
- Highway 段使用固定速度 12 km/s，superhighway 段不计时。
- 不持久化 selected transport blueprint。
