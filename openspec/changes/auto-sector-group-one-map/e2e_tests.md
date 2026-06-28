# auto-sector-group-one-map E2E Tests

## 1 Map 面板集成

- [ ] 1.1 Map binding-sector 入口：覆盖 `MapSavePanel` 的 binding-sector 层渲染自动分组面板，不再渲染旧 `MapBindingSectorGroup`
- [ ] 1.2 四个 Map tab：覆盖 Hub / Allocation / Trade Station / Virtual Station tab 的显示与切换
- [ ] 1.3 Map tab 切换不计算：覆盖 Map 面板挂载、tab 切换、layer 返回不触发分组算法或 `initAutoGroupDraft()`
- [ ] 1.4 Virtual Station 不受状态限制：覆盖 Hub edit/result 态下 Virtual Station tab 始终可用
- [ ] 1.5 确认态：覆盖确认完成后隐藏 draft tabs，并显示进入 station binding 的 group 按钮

## 2 地图联动与布局

- [ ] 2.1 focus-sector：覆盖 coverage/candidate/connected、anchor/trade station、assignment sector 点击后地图居中
- [ ] 2.2 Live 不触发地图事件：覆盖 Live context 点击 pill 不 emit `focus-sector`
- [ ] 2.3 compact 样式：覆盖 Map 侧栏下 group card、pill、jump row 不溢出 360px 宽度
- [ ] 2.4 HubAddMenu context：覆盖 Map 使用侧栏入口和定位地图能力，Live 使用 overlay
- [ ] 2.5 drag sort：覆盖 Hub list 拖拽排序只改变 groups 顺序，不触发计算，不改变 coverage/connection/jumpRange

## 3 Hub Color 与 Overlay

- [ ] 3.1 色卡交互：覆盖编辑态色块打开选择器、预设色更新 draft、透明色清空 color
- [ ] 3.2 颜色持久化：覆盖 confirm 写入 group color，透明色不持久化为 `0x00000000`
- [ ] 3.3 地图颜色来源：覆盖 binding 模式使用 shared draft，普通地图模式不显示 persisted active binding 星区组染色
- [ ] 3.4 overlay 层级：覆盖 faction owner、hub color、resource pie 的渲染层级

## 4 Virtual Station Tab

- [ ] 4.1 Map-only tab：覆盖 Map 显示 Virtual Station tab，Live columns 不显示
- [ ] 4.2 blueprint 来源：覆盖 blueprint empire selector、blueprint station list、blank station source 的展示
- [ ] 4.3 grouped list：覆盖 virtual station drafts 按当前 groups 顺序分组显示
- [ ] 4.4 ungrouped list：覆盖未分组 virtual stations 显示在“提交时移除”区域
- [ ] 4.5 文案本地化：覆盖 Virtual Station tab 和相关区域的中英文文案

## 5 Virtual Station Drag 与 Overlay

- [ ] 5.1 blueprint 创建：覆盖从 blueprint station 拖拽创建 virtual station draft，并复制 station plan 必要字段
- [ ] 5.2 blank 创建：覆盖从空白空间站拖拽创建空 module industrial draft
- [ ] 5.3 existing draft 移动：覆盖已存在 virtual station 再拖动只更新自身 draft，不重复创建 plan
- [ ] 5.4 drop 拒绝：覆盖无 group 覆盖 sector 和多 group 命中时拒绝 drop
- [ ] 5.5 删除：覆盖删除按钮只删除 store draft，不直接写 binding
- [ ] 5.6 overlay 激活：覆盖 Map binding 打开后 virtual station overlay 可拖动，不要求 Virtual Station tab 激活

## 6 Virtual Trade Station Drag

- [ ] 6.1 overlay 渲染：覆盖 virtual trade station overlay 从 group trade station draft 渲染
- [ ] 6.2 拖动 position：覆盖拖动只更新 group draft trade station position
- [ ] 6.3 hub sector 限制：覆盖 drop 到非 hub sector 被拒绝
- [ ] 6.4 不修改归属：覆盖拖动不修改 `TradeStationBinding.sectorMacro`、group `sectorMacro`、coverage 或 station plan
- [ ] 6.5 坐标展示：覆盖 Trade Station tab 中 virtual 选项显示当前坐标

## 7 回归风险

- [ ] 7.1 防止 Map 面板操作触发自动计算
- [ ] 7.2 防止 Hub edit 态错误禁用 Virtual Station tab
- [ ] 7.3 防止 virtual station drop 使用 fallback group
- [ ] 7.4 防止 existing virtual station 拖动重复创建 station plan
- [ ] 7.5 防止旧 MapBinding 面板重新进入生产路径
