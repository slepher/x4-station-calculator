# auto-sector-group-one-map Tasks

## 1. Map 面板集成

- [ ] Map binding-sector 使用 `AutoSectorGroupPanel layout="tabs"`
- [ ] `MapSavePanel` 的 `binding-sector` 层不再渲染 `MapBindingSectorGroup`
- [ ] Map 面板读取 live store 共享 draft
- [ ] Map 面板挂载和 tab 切换不调用分组算法或 `initAutoGroupDraft()`
- [ ] 实现 Hub / Allocation / Trade Station 三视图
- [ ] Hub 编辑态禁用 Allocation 和 Trade Station
- [ ] 确认态隐藏 draft tabs 并显示进入 station binding 的按钮

## 2. Map 事件

- [ ] Coverage/candidate/connected pill 在 map view emit `focus-sector`
- [ ] Anchor/trade station pill 在 map view emit `focus-sector`
- [ ] Assignment sector name 在 map view emit `focus-sector`
- [ ] Live view 点击 pill 不 emit `focus-sector`
- [ ] `MapSavePanel` 转发 `focus-sector` 和 `fit-sectors`
- [ ] `MapWorkbenchView` 根据事件居中地图

## 3. Compact UI 与 drag sort

- [ ] Map view 使用适配侧栏的 compact 样式
- [ ] Pill 在 360px 侧栏内不溢出
- [ ] Map group card 收紧 padding、header、label、pill gap 和 jump row 间距
- [ ] Map 添加枢纽使用 `HubAddMenu` 默认/侧栏入口和定位按钮
- [ ] Live 添加枢纽使用 `HubAddMenu mode="overlay"`
- [ ] Hub list 支持 drag sort
- [ ] Drag sort 使用 drag handle 和虚线 placeholder
- [ ] Drag sort 只更新 groups 数组顺序
- [ ] Drag sort 不触发计算、不改变 coverage/connection/jumpRange

## 4. Hub color 状态与算法

- [ ] `BindingSectorGroup` 和 draft group 保留 `color`
- [ ] 实现 30 色 UI palette 和 27 色 auto palette
- [ ] 保留有效已有颜色
- [ ] 对缺色、新增或冲突 hub 重分配
- [ ] 避开自身 anchor/coverage faction 色
- [ ] 避开 5 跳内 hub color 和 hub faction 色
- [ ] 允许 5 跳外颜色复用
- [ ] 交互后单次只影响当前 hub color

## 5. Color UI 与持久化

- [ ] Group card 标题显示色块
- [ ] 编辑态色块打开颜色选择器
- [ ] 预设色更新 draft 并关闭 popover
- [ ] 透明色清空 `group.color`，不得保存透明色值
- [ ] Confirm 时写入 `BindingSectorGroup.color`
- [ ] `normalizeState()` 保留 group color

## 6. Map overlay

- [ ] Binding 模式从 shared draft 构建 `sectorGroupColorMap`
- [ ] 非 binding 模式从 persisted active binding 构建 `sectorGroupColorMap`
- [ ] 有 color 的 coverage sector 绘制内部六边形
- [ ] 无 color 不绘制内部六边形
- [ ] 保持 faction owner、hub color、resource pie 的渲染层级

## 7. 构建验证

- [ ] 实现完成后运行 `npm run build`
