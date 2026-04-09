# user-save-binding Tasks

## Imported from station-binding

- [x] 1. `EmpirePlan.saveBindings[]` 字段
- [x] 2. SaveBinding 数据模型
- [x] 3. 地图与 save 查询基础能力
- [x] 4. EmpireStore saveBindings action
- [x] 5. 直接导入 save station
- [x] 6. 空闲 empire station 直接放置
- [x] 7. Binding selector / composable
- [x] 8. 地图工作台交互
- [x] 9. Stage 3 绑定流程
- [x] 10. 列表与操作区 UI
- [x] 11. 构建验证
- [x] 12. 审查问题修复
- [x] 13. Free Sector/Station 拖拽功能
- [x] 14. Stage 2 星区组重构
- [x] 15. Stage 3 自由空间站与星区列表重构
- [x] 16. 虚拟中转站限制
- [x] 17. 构建验证
- [x] 18. Coverage 格式重构
- [x] 19. 绑定规则完善
- [x] 20. 构建验证
- [x] 21. Binding POI 视觉与拖拽权限对齐
- [x] 22. Step 3 显示收敛与去重
- [x] 23. Step 2 交互重构与连接星区编辑
- [x] 24. Step 1 标题与查看/绑定交互重构

## Binding State Clarification

- [x] B1.1 绑定激活仅影响绑定图标显示，不参与首页容器高亮
- [x] B1.2 `MapSavePanel` 独占管理 `activeArchiveId`
- [x] B1.3 地图层仅切换预览 archive，不再通过事件回写 `activeArchiveId`
- [x] B1.4 root 面包屑仅切导航，不承担旧的 active 恢复职责

## Step 3 Breakdown

- [x] 22.1 调整 Step 3 主列表：save station 为主显示对象，正常绑定 empire station 不再独立显示
- [x] 22.2 删除底部重复的 existing bindings / 第二套明细来源
- [x] 22.3 为有 `position` 且无 `saveStationCode` 的 empire station 显示名称与 `x,z` 坐标
- [x] 22.4 为有 `position` 且当前 time 失效的绑定对象只提供解绑动作
- [x] 22.5 绑定菜单中，已绑定到其他 save station 的候选置灰且不可点击
- [x] 22.6 绑定菜单中，已放置未绑定候选使用独立背景色区分
- [x] 22.7 绑定后以 save station 结果视图收敛，placed 补位项从列表中消失
- [x] 22.8 移除 Step 3 的第二套重复详情来源
- [x] 22.9 同一 empire station 不再同时作为 placed 项与 bound 项重复显示
- [x] 22.10 普通 empire 站与虚拟中转站统一为同一套 binding 结构，不再依赖 `free` 字段
- [x] 22.11 Step 3 的解绑与转绑统一改为清理旧 binding，旧对象直接回归自由
- [x] 22.12 Step 3 绑定菜单只用背景色和置灰表达状态，去掉“已设置位置/虚拟中转站”等备注文字
- [x] 22.13 已拖拽到地图但未绑定的候选在菜单中也视为不可绑定
- [x] 22.14 Step 3 绑定菜单 Y 轴对齐 `station-item`，并在空间不足时改为向上弹出
- [x] 22.15 Step 3 绑定菜单滚动条样式与 Step 2 统一
- [x] 22.16 从 Step 3 导入 save station 时仅使用 `module_id` 导入全部模块
- [x] 22.17 save station 指向不存在 empire station 时显示“绑定异常”，并允许在菜单中清理坏 binding
- [x] 22.18 从异常绑定状态导入/转绑时，先释放旧坏 binding 再落入新 binding
- [x] 22.19 模块搜索面板与 Step 3 导入共享默认排序规则，不再通过拍平搜索结果复用排序
- [x] 23.21 Step 2 中被其他 empire sector 占用的定位/范围星区不能进入当前 coverage，但仍显示在 candidate 中且不显示 `+`

## Save Parser Shape

- [ ] P1. 为 `PlayerStationConstruction` 增加 `id`
- [ ] P2. 为 `player station` 增加 `component_id` / `cargo` / `reservation`
- [ ] P3. 为 `player station` 增加 `buildstorage_code`，并保留 sector 顶层 `player_buildstorages`
- [ ] P4. `buildstorage` 仅解析 `inprogress`，输出 `cargo` / `reservation` / `constructions` / `progress`
- [ ] P5. `buildstorage.progress` 仅保留 `start` / `end` / `sequenceindex`
- [ ] P6. 使用 `buildstorage/buildtasks/inprogress/build/@component = station/@id` 建立 `station_code/buildstorage_code` 引用
- [ ] P7. parser 输出的 `id` / `component_id` 去掉外层 `[]`
- [ ] P8. `SectorData` 下按 `code` 唯一的实体集合改为 `snake_case` 的 map
- [ ] P9. `BuildStorageRef` 重命名为 `BuildStorageEntry`
- [ ] P10. `player_buildstorages[*].constructions[*]` 补齐 `equipments`
- [ ] P11. 所有 station / player_buildstorage 的 `modules` / `equipments` 改为 `Record<ref, entry>`
- [ ] P12. `postProcessRustSaveArchive()` 为 `modules` 补 `module_id`，为 `equipments` 补 `equipment_id`
