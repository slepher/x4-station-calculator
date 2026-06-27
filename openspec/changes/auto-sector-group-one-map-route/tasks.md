# auto-sector-group-one-map-route Tasks

## Implementation

- [x] 1. 创建 hub link route 预计算数据结构
  - [x] 1.1 定义 hub link route entry/cache 类型
  - [x] 1.2 定义基于 `sectorA + posA + sectorB + posB` 的稳定路径 key，避免 A-B 与 B-A 重复
  - [x] 1.3 定义全局单份 cache 与 binding/draft 过滤视图
  - [x] 1.4 定义缺端点、缺路径与候选 problem 的记录方式

- [x] 2. 在 live production store 中预计算 binding routes
  - [x] 2.1 从 persisted `activeBinding.groups` 遍历 `connectedGroupIds`
  - [x] 2.2 解析两端 transit hub station sector 与 position
  - [x] 2.3 调用 `sector-hub-transport` route candidate 算法
  - [x] 2.4 过滤 `problems.length > 0` 的候选用于地图绘制
  - [x] 2.5 按两端 `sectorMacro` 字母序确定 color group 与 route color
  - [x] 2.6 在 active binding、archive 或 map data 切换时重建 binding cache

- [x] 3. 在 live production store 中维护全局 routes
  - [x] 3.1 binding/draft link 集合扫描时只计算全局 cache 中缺失的 link
  - [x] 3.2 删除 link 不删除全局 route entry
  - [x] 3.3 重新添加 link 时复用已有 route entry
  - [x] 3.4 binding/draft 当前 link 集合只过滤显示视图
  - [x] 3.5 group 顺序变化不触发不必要 route 重算

- [x] 4. 改造 transit transport presenter
  - [x] 4.1 `Sector Group` link route row 读取 store 预计算 route entry
  - [x] 4.2 presenter 不再为同一 hub link 重复调用 route builder
  - [x] 4.3 无 ship 时使用预计算 candidates 的默认候选
  - [x] 4.4 有 ship 时在预计算 candidates 上沿用 travel time 选择逻辑
  - [x] 4.5 route entry problems 进入现有问题组
  - [x] 4.6 `Station` 分类保持现有路径计算方式

- [x] 5. 创建地图 hub link route overlay
  - [x] 5.1 为 map canvas 增加 hub link route overlay 输入
  - [x] 5.2 binding-sector 页面使用 draft route cache
  - [x] 5.3 非 binding-sector 页面使用 binding route cache
  - [x] 5.4 将 route segments 转换为地图 screen coordinates
  - [x] 5.5 绘制每条 hub link 的全部有效候选
  - [x] 5.6 同一 link 的所有候选使用同一颜色且不做透明度降级
  - [x] 5.7 缺 group color 时使用稳定 fallback 样式

- [x] 6. 增加星区组连接图层开关
  - [x] 6.1 地图图层控制新增 `Sector Group Links` / `星区组连接`
  - [x] 6.2 非 binding-sector 页面按开关显示或隐藏 hub link route overlay
  - [x] 6.3 binding-sector 页面无视开关并强制显示 draft routes
  - [x] 6.4 确认开关不影响 gate、superhighway、highway ring gate、sector group color 与 resource overlay

- [x] 6.5 修正 link 添加按钮事件，避免点击 `+` 误触发地图 focus

- [x] 7. i18n 文案
  - [x] 7.1 更新 `src/locales/en.json`
  - [x] 7.2 更新 `src/locales/zh-CN.json`

- [x] 8. Build validation
  - [x] 8.1 运行 `npm run build`
  - [x] 8.2 若出现编译错误，修复后重新运行 `npm run build`

- [x] 9. 增加 route lane 偏移消歧
  - [x] 9.1 文档补充同 link 共 lane、不同 link 分 lane、原生连接避让、端点收束、星区内部直连与环形高速通道中线避让规则
  - [x] 9.2 为 lane 分配与端点 taper 编写单元测试
  - [x] 9.3 在 map route view model 中按基础线路分配稳定 lane
  - [x] 9.4 route 主体相对 gate / superhighway / ring-highway 原生连接偏移
  - [x] 9.5 gate / superhighway / sector-internal endpoint 处收束到真实端点并从端点重新展开
  - [x] 9.6 同一 hub link 的多条 candidate 经过同一基础线路时共用 lane
  - [x] 9.7 candidate 在每个 sector visit 内先聚合为进入点到离开点的一条 visual segment
  - [x] 9.8 星区内部聚合 A-B route 统一按端点直连渲染，不再复用普通 highway spline 或绘制中途 gate/highway 折线
  - [x] 9.9 命中 `highwayRingChains` 的环形高速通道保留中线，普通 sector-internal 与 ring-highway 同几何通道归入同一 lane group
  - [x] 9.10 同一 link 在同一 sector 内相同进入点/离开点的多条 candidate 只保留一条可视 route；不同 link 保留多条并分 lane
- [x] 9.11 移除临时 route endpoint debug 日志
- [x] 9.12 运行变更相关单元测试与 build validation

- [x] 10. 将 hub link route 从单色线改为双端颜色双轨线
  - [x] 10.1 文档替换 `sectorMacro` 字母序单色规则，明确无向 link 同时表达两端 group color
  - [x] 10.2 为 map route view model 增加端点颜色 pair
  - [x] 10.3 route layer 使用“半透明 A / 实色 A / 实色 B / 半透明 B”的紧密双轨复合描边
  - [x] 10.4 增加单元测试覆盖端点颜色 pair 传递

## Notes

- 本任务清单不包含测试代码编写与测试执行；测试工作由 `/x4:test` 或相关测试 workflow 处理。
- 不修改 Rust parser。
- 不改变 `sector-hub-transport` route candidate 算法口径。
- 普通 station route 不在本变更中迁移到 store 预计算。
