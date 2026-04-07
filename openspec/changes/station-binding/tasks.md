# station-binding 实施任务

- [x] 1. `EmpirePlan.saveBindings[]` 字段
- [x] 1.1 在 `EmpirePlan` 对象中新增 `saveBindings` 字段
- [x] 1.2 以 `gameGuid` 为唯一键实现 `SaveBindingPlan`（移除 `key` 和 `empireId` 字段）
- [x] 1.3 通过 `active: boolean` 标识当前激活的 binding
- [x] 1.4 为旧数据提供空 `saveBindings` 默认迁移

- [x] 2. SaveBinding 数据模型
- [x] 2.1 定义 `SaveBindingPlan`（含 `gameGuid`、`active`、`selectedArchiveTime`、`groupBindings`）
- [x] 2.2 定义 `GroupSaveBinding`（含 `tradestationBinding`、`stationBindings[]`）
- [x] 2.3 定义 `StationSaveBinding`（含可选 `position: { x, y, z }`）
- [x] 2.4 将 `stationBindings` 嵌套在 `GroupSaveBinding` 内，而非顶层数组
- [x] 2.5 将 `missing_at_selected_time` 状态定义为运行态派生结果，而非持久化字段

- [x] 3. 地图与 save 查询基础能力
- [x] 3.1 为 save `tradestation` 与玩家空间站提供按 `gameGuid + time` 的可复用查找接口
- [x] 3.2 在地图 store 或相关逻辑层补充 sector 邯接与 `N` 跳搜索能力
- [x] 3.3 提供按 `sectorMacro + jumpRange` 计算 `coverageSectorMacros` 的纯逻辑函数

- [x] 4. EmpireStore saveBindings action（均以 `gameGuid` 为标识符）
- [x] 4.1 新增 `createBinding(gameGuid)` 和 `getBindingByGameGuid(gameGuid)` action
- [x] 4.2 新增 `setSelectedArchiveTime(gameGuid, archiveTime)` 切换 action
- [x] 4.3 新增 group hub binding 的绑定、解绑、跳数更新 action（使用 `gameGuid`）
- [x] 4.4 新增已有 empire station 与 save 玩家站的绑定、解绑 action
- [x] 4.5 实现"一个 save 玩家站在同一 `GroupSaveBinding` 内只能绑定到一个 empire station"的占用校验
- [x] 4.6 新增 station binding `position` 的写入、清除与更新 action

- [x] 5. 直接导入 save station
- [x] 5.1 在 coverage 内 save 玩家站候选上提供"导入为新 station"动作
- [x] 5.2 导入时调用 `empireStore.createStation(...)` 创建独立 empire station
- [x] 5.3 导入完成后在 `GroupSaveBinding.stationBindings[]` 中建立 `StationSaveBinding`

- [x] 6. 空闲 empire station 直接放置
- [x] 6.1 在目标帝国星区下提供空闲 empire station 列表（排除已绑定 save 站的）
- [x] 6.2 支持将空闲 empire station 直接拖拽到地图（UI 交互）
- [x] 6.3 拖拽后按小空间站尺寸渲染（复用现有 placement preview）
- [x] 6.4 将拖拽得到的 `position` 写入 `GroupSaveBinding.stationBindings[]` 中，不写入 `EmpirePlan`

- [x] 7. Binding selector / composable
- [x] 7.1 新增统一的 binding view-model 层，拼接 `empireStore + saveStore + mapStore`
- [x] 7.2 输出"用户所在空间站所属的所有星区"列表
- [x] 7.3 输出选中 save 星区在指定跳数下的过滤星区、空间站列表与地图包围盒
- [x] 7.4 输出目标帝国星区下的可绑定 empire station 与空闲 station 列表
- [x] 7.5 输出当前 `selectedArchiveTime` 下的 binding 失效提示

- [x] 8. 地图工作台交互
- [x] 8.1 用 binding 界面替换地图上原帝国空间站弹出界面
- [x] 8.2 提供 `selectedArchiveTime` 切换入口（UI 下拉选择不同存档时间）
- [x] 8.3 实现"三段式"流程：选择 binding -> save 星区列表 -> 绑定操作
- [x] 8.4 进入第三段后自动缩放/平移地图到过滤星区最大范围

- [x] 9. Stage 3 绑定流程
- [x] 9.1 绑定星区：将 save 星区绑定到帝国星区（选择现有或新建）
- [x] 9.2 绑定星区后显示该帝国星区的空闲空间站列表
- [x] 9.3 绑定中转站：将 empire station 绑定到 save tradestation
- [x] 9.4 绑定空间站：将 save 玩家站绑定到已有 empire station
- [x] 9.5 导入空间站：将 save 玩家站导入为新 empire station

- [x] 10. 列表与操作区 UI
- [x] 10.1 第一段显示 binding plan 选择与创建
- [x] 10.2 第二段显示 save 星区列表（带搜索、空间站标签）
- [x] 10.3 第三段显示过滤后的星区与空间站列表（POI 风格，只显示有玩家站的星区）

- [x] 11. 构建验证
- [x] 11.1 完成所有实现后执行 `npm run build`
- [x] 11.2 构建通过

- [x] 12. 审查问题修复
- [x] 12.1 修复 selectedArchiveTime 回退逻辑，使用 gameGuid 最新存档
- [x] 12.2 bindStationToSaveStation() 添加占用校验并返回 boolean

- [x] 13. Free Sector/Station 拖拽功能
- [x] 13.1 为 `GroupSaveBinding` 新增 `free?: boolean` 字段
- [x] 13.2 为 `StationSaveBinding` 新增 `free?: boolean` 字段
- [x] 13.3 修改 MapBindingPanel 列表：已绑定的 free sector/station 仍显示在 free 列表
- [x] 13.4 已绑定的 free 项显示星区 tag（从 `sectorMacro` 解析）和清除按钮（x）
- [x] 13.5 修改 MapWorkbenchView：添加 `bindingOverlays` computed，从 `saveBindings` 构建覆盖层
- [x] 13.6 修改 `stopDrag`：处理 free sector 和 free station 的 drop 逻辑
- [x] 13.7 添加 free station 落点限制：`coverageSectorMacros` 范围检查，范围外鼠标显示禁止符号
- [x] 13.8 添加清除逻辑：sector 的 x 清除整个 `groupBinding`，station 的 x 清除 `stationBinding`
- [x] 13.9 验证构建通过

- [x] 14. Stage 2 星区组重构
- [x] 14.1 重构列表结构：上方帝国星区，下方存档星区
- [x] 14.2 Empire sector 添加绑定按钮及弹出菜单
- [x] 14.3 菜单组1：筛选后未绑定的存档星区候选（超过10个提示搜索筛选）
- [x] 14.4 菜单组2：地图可见星区候选（面积>50%，超过10个提示调整缩放）
- [x] 14.5 绑定后展开 empire sector：跳数、范围星区、备选星区、取消|确定
- [x] 14.6 范围星区药丸：点击 x 移到备选
- [x] 14.7 备选星区药丸：点击 + 移到范围
- [x] 14.8 确定后折叠显示范围星区药丸
- [x] 14.9 Save sector 显示归属星区药丸标签
- [x] 14.10 已绑定时绑定按钮转为取消绑定按钮
- [x] 14.11 修复：切换编辑星区时显示新定位星区
- [x] 14.12 修复：跳数变更时正确计算覆盖星区
- [x] 14.13 修复：候选星区显示其他组绑定的橙色药丸

- [x] 15. Stage 3 自由空间站与星区列表重构
- [x] 15.1 重构列表结构：上方自由空间站列表，下方定位星区和范围星区列表
- [x] 15.2 修改"空闲空间站"为"自由空间站"命名（i18n）
- [x] 15.3 自由空间站列表：包含无 stationBinding 的 empire station、无 sectorId 的 station、未放置的虚拟中转站
- [x] 15.4 定位星区和范围星区列表：每个星区用药丸显示，点击可 focus
- [x] 15.5 星区下显示：save 玩家站 + 已放置的 free station（并排）
- [x] 15.6 即使星区没有 save 空间站，也显示星区药丸
- [x] 15.7 拖拽放置后：空间站从自由列表移到对应星区下显示

- [x] 16. 虚拟中转站限制
- [x] 16.1 虚拟中转站只能拖拽到定位星区（sectorMacro）
- [x] 16.2 落点检查：鼠标位置 sectorMacro 必须等于定位星区
- [x] 16.3 绑定限制：只能与定位星区下的 save 空间站绑定

- [x] 17. 构建验证
- [x] 17.1 完成实现后执行 `npm run build`
- [x] 17.2 构建通过

- [x] 18. Coverage 格式重构
- [x] 18.1 修改 `CoverageSectorEntry` 类型：`{ref: string, jump: number}`
- [x] 18.2 更新 draft 和 binding 中的 coverage 格式
- [x] 18.3 更新相关 computed 和函数

- [x] 19. 绑定规则完善
- [x] 19.1 更新 freeStations computed：判断基于 stationBinding 而非 sectorId
- [x] 19.2 更新绑定菜单候选对象：包含已放置未绑定空间站、自由空间站、虚拟补给站
- [x] 19.3 绑定对象不可重叠校验（已在 bindStationToSaveStation 中实现）
- [x] 19.4 虚拟补给站绑定 save station 支持
- [x] 19.5 绑定/移除时同步更新 station.sectorId
- [x] 19.6 已放置虚拟补给站显示在星区下
- [x] 19.7 已放置虚拟补给站可被定位星区的 save station 绑定

- [x] 20. 构建验证
- [x] 20.1 完成实现后执行 `npm run build`
- [x] 20.2 构建通过