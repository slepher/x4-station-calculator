# station-binding 实施任务

- [x] 1. `SavedEmpiresState.savePlans` 顶层字段
- [x] 1.1 在 `x4_empire_data` 根对象中新增 `savePlans` 同级字段与版本号
- [x] 1.2 以 `empireId + gameGuid` 实现 `SaveBindingPlan` 唯一键
- [x] 1.3 为旧数据提供空 `savePlans` 默认迁移
- [x] 1.4 让当前 empire 的激活 `bindingKey` 与 `selectedArchiveTime` 可恢复

- [x] 2. SaveBinding 数据模型
- [x] 2.1 定义 `SaveBindingPlan`
- [x] 2.2 定义 `GroupSaveBinding`
- [x] 2.3 定义 `StationSaveBinding`
- [x] 2.4 为 `StationSaveBinding` 增加可选 `position: { x, y, z }`
- [x] 2.5 将 `missing_at_selected_time` 之类状态定义为运行态派生结果，而不是持久化字段

- [x] 3. 地图与 save 查询基础能力
- [x] 3.1 为 save `tradestation` 与玩家空间站提供按 `gameGuid + time` 的可复用查找接口
- [x] 3.2 在地图 store 或相关逻辑层补充 sector 邻接与 `N` 跳搜索能力
- [x] 3.3 提供按 `sectorMacro + jumpRange` 计算 `coverageSectorMacros` 的纯逻辑函数

- [x] 4. EmpireStore savePlans action
- [x] 4.1 新增创建/选择 `SaveBindingPlan` 的 action
- [x] 4.2 新增 `selectedArchiveTime` 切换 action
- [x] 4.3 新增 group hub binding 的绑定、解绑、跳数更新 action
- [x] 4.4 新增已有 empire station 与 save 玩家站的绑定、解绑 action
- [x] 4.5 实现"一个 save 玩家站在同一 `SaveBindingPlan` 内只能绑定到一个 empire station"的占用校验
- [x] 4.6 新增 station binding `position` 的写入、清除与更新 action

- [x] 5. 直接导入 save station
- [x] 5.1 在 coverage 内 save 玩家站候选上提供"导入为新 station"动作
- [x] 5.2 导入时调用 `empireStore.createStation(...)` 创建独立 empire station
- [x] 5.3 导入完成后为新 station 建立 `StationSaveBinding`

- [ ] 6. 空闲 empire station 直接放置
- [x] 6.1 在目标帝国星区下提供空闲 empire station 列表
- [ ] 6.2 支持将空闲 empire station 直接拖拽到地图（UI 交互）
- [ ] 6.3 拖拽后按小空间站尺寸渲染
- [ ] 6.4 将拖拽得到的 `position: { x, y, z }` 写入 binding，调用 `setStationBindingPosition`

- [x] 7. Binding selector / composable
- [x] 7.1 新增统一的 binding view-model 层，拼接 `empireStore + saveStore + mapStore`
- [x] 7.2 输出"用户所在空间站所属的所有星区"列表
- [x] 7.3 输出选中 save 星区在指定跳数下的过滤星区、空间站列表与地图包围盒
- [x] 7.4 输出目标帝国星区下的可绑定 empire station 与空闲 station 列表
- [x] 7.5 输出当前 `selectedArchiveTime` 下的 binding 失效提示

- [ ] 8. 地图工作台交互
- [x] 8.1 用 binding 界面替换地图上原帝国空间站弹出界面
- [ ] 8.2 提供 `selectedArchiveTime` 切换入口（UI 下拉选择不同存档时间）
- [x] 8.3 实现"三段式"流程：选择 binding -> save 星区列表 -> 跳数过滤结果
- [x] 8.4 进入第三段后自动缩放/平移地图到过滤星区最大范围
- [ ] 8.5 实现 Bind Hub Mode：为 sectorGroup 绑定 save tradestation 并计算 coverage

- [x] 9. 列表与操作区 UI
- [x] 9.1 第一段显示 binding plan 选择与创建
- [x] 9.2 第二段显示 save 星区列表（带搜索、空间站标签）
- [x] 9.3 第三段显示过滤后的星区与空间站列表（POI 风格）
- [x] 9.4 底部显示空闲 empire station 列表
- [x] 9.5 提供解绑与"当前 time 下失效"提示

- [ ] 10. 构建验证
- [ ] 10.1 完成所有实现后执行 `npm run build`
- [ ] 10.2 若构建失败，修复后重新构建直至通过或记录 blocker