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
