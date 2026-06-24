# auto-sector-group-one-map E2E Test Tasks

## 1 Map 面板集成

- [✓] 1.1 Map binding-sector 入口：覆盖 `MapSavePanel` 的 binding-sector 层渲染自动分组面板，不再渲染旧 `MapBindingSectorGroup`
  - [✓] 1.1.1 从 live-production 导航到 map binding-sector： loadLiveBindingFixture → 点击 top-view-btn-maps → 点击 map-save-panel-tab → 断言 `[data-testid="map-save-panel"]` 可见 → 断言 `.auto-sector-group-map-panel` 存在
  - [✓] 1.1.2 验证旧 MapBindingSectorGroup 不被渲染：在 binding-sector 层中查找 `.binding-sector-group` → 断言不存在
  - [✓] 1.1.3 验证 close 按钮可用：点击 `[data-testid="map-save-panel-close"]` → 断言 panel 关闭或回到 list 层

- [✓] 1.2 四个 Map tab：覆盖 Hub / Allocation / Trade Station / Virtual Station tab 的显示与切换
  - [✓] 1.2.1 默认 hub tab 激活并显示 group cards：进入 edit 态 → 断言 `.tab-bar` 存在 → hub tab 为 `.active` → `.group-item` 列表可见
  - [✓] 1.2.2 Allocation tab 切换与内容：点击 `.tab-btn:has-text("分配方案")` → 断言 tab 激活 → `.allocation-card` 可见
  - [✓] 1.2.3 Trade Station tab 切换与内容：点击 `.tab-btn:has-text("交易站")` → 断言 tab 激活 → `.trade-station-card` 可见
  - [✓] 1.2.4 Virtual Station tab 切换与内容：点击 `.tab-btn:has-text("虚拟空间站")` → 断言 tab 激活 → `.virtual-station-tab` 可见

- [✓] 1.3 Map tab 切换不计算：覆盖 Map 面板挂载、tab 切换、layer 返回不触发分组算法或 `initAutoGroupDraft()`
  - [✓] 1.3.1 tab 切换后 groups 不变：记录初始 groups 快照 (page.evaluate) → 依次切换 Hub/Allocation/TradeStation/VirtualStation/Hub → 断言 groups 顺序、coverage、connectedGroupIds、jumpRange 均未改变
  - [✓] 1.3.2 关闭再打开 save panel 不触发计算：关闭 panel → 重新打开 → 断言 groups 状态未改变
  - [✓] 1.3.3 从其他 map layer 返回不触发计算：切换 map layer → 返回 binding-sector → 断言 groups 未重新计算

- [✓] 1.4 Virtual Station 不受状态限制：覆盖 Hub edit/result 态下 Virtual Station tab 始终可用
  - [✓] 1.4.1 Virtual Station tab 在编辑态仍可用：编辑态 → 点击 `.tab-btn:has-text("虚拟空间站")` → 断言可切换且内容可见
  - [✓] 1.4.2 Virtual Station tab 在 result 态可用：返回 result 态 → 断言 Virtual Station tab 存在且可点击

- [✓] 1.5 确认态：覆盖确认完成后隐藏 draft tabs，并显示进入 station binding 的 group 按钮
  - [✓] 1.5.1 confirm 后 draft tabs 隐藏：点击确定 → 二次确认 (如有 popup) → 断言 `.tab-bar` 不可见
  - [✓] 1.5.2 显示 station binding 按钮：确认态 → 断言每个 `.group-item` 有进入 station binding 的按钮 → 点击按钮 → 断言进入 station binding 阶段
  - [✓] 1.5.3 确认态不自动进入 station binding：点击确定 → 断言仍停留在 sector-group 视图

## 2 地图联动与布局

- [✓] 2.1 focus-sector：覆盖 coverage/candidate/connected、anchor/trade station、assignment sector 点击后地图居中
  - [✓] 2.1.1 Coverage pill 点击触发 focus-sector：点击 `.pill--coverage` → 断言 map viewport transform/center 发生变化
  - [✓] 2.1.2 Anchor pill 点击触发 focus-sector：点击 `.pill--anchor` → 断言 map viewport 居中到 anchor sector
  - [✓] 2.1.3 Assignment sector name 点击触发 focus-sector：切换到 Allocation tab → 点击 `.allocation-card` 内 sector 名 → 断言 viewport 位置变化

- [✓] 2.2 Live 不触发地图事件：覆盖 Live context 点击 pill 不 emit `focus-sector`
  - [✓] 2.2.1 在 live-production 下点击 pill：保持 live 视图 → 检查 map viewport (若有) → 断言无位置变化
  - [✓] 2.2.2 Live context 下 SectorGroupList 不 emit focus-sector：断言 pill 点击后无 focus-sector 事件传播

- [✓] 2.3 compact 样式：覆盖 Map 侧栏下 group card、pill、jump row 不溢出 360px 宽度
  - [✓] 2.3.1 Save panel 宽度 ≤ 360px：获取 `.map-save-panel` 宽度 → 断言 ≤ 360px
  - [✓] 2.3.2 Group card 内容不溢出：检查 `.group-item` 内 pill → 断言所有 pill 右边界 ≤ group card 右边界
  - [✓] 2.3.3 Group card 紧凑样式：检查 padding/header/label/pill-gap/jump-row → 断言小于 Live 对应值

- [✓] 2.4 HubAddMenu context：覆盖 Map 使用侧栏入口和定位地图能力，Live 使用 overlay
  - [✓] 2.4.1 Map 添加枢纽菜单显示定位按钮：编辑态 click 添加枢纽 → 断言 `.hub-add-menu` 存在且含定位地图按钮
  - [✓] 2.4.2 定位地图按钮功能：click 定位按钮 → 断言菜单关闭且 map viewport 位置改变
  - [✓] 2.4.3 Live 添加枢纽菜单无定位按钮：live-production 编辑态 click 添加枢纽 → 断言 overlay 模式 hub-add-menu → 断言无定位地图按钮

- [✓] 2.5 drag sort：覆盖 Hub list 拖拽排序只改变 groups 顺序，不触发计算，不改变 coverage/connection/jumpRange
  - [✓] 2.5.1 Drag handle 可见：编辑态 → 检查 `.group-item` → 断言 drag handle 存在
  - [✓] 2.5.2 拖拽排序改变 groups 顺序：记录排序前顺序 → Playwright Mouse API 拖拽 (参考 x4-drag-test) → 断言顺序改变
  - [✓] 2.5.3 拖拽不触发计算：排序后 → 断言 groups 的 coverage/connectedGroupIds/jumpRange 与排序前一致
  - [✓] 2.5.4 拖拽过程中 placeholder 可见：mouse.down 后 → 断言虚线 placeholder 存在

## 3 Hub Color 与 Overlay

- [✓] 3.1 色卡交互：覆盖编辑态色块打开选择器、预设色更新 draft、透明色清空 color
  - [✓] 3.1.1 色块可见：编辑态 → 检查 `.group-item` 内色块 → 断言 16×16 色块存在
  - [✓] 3.1.2 有颜色色块 fill 该色：对有 color 的 group → 断言色块非透明虚线边框
  - [✓] 3.1.3 无色色块透明虚线：对无 color 的 group → 断言色块为透明虚线边框
  - [✓] 3.1.4 编辑态点击打开选择器：click 色块 → 断言 SketchPicker 弹出
  - [✓] 3.1.5 预设色更新 draft：click 预设色块 → 断言 popover 关闭且 group 色块颜色更新
  - [✓] 3.1.6 透明色清空 color：click 透明预设 → 断言 group.color 变为 undefined → 色块变透明虚线
  - [✓] 3.1.7 非编辑态色块不可点击：result 态 → click 色块 → 断言选择器不弹出

- [✓] 3.2 颜色持久化：覆盖 confirm 写入 group color，透明色不持久化为 `0x00000000`
  - [✓] 3.2.1 Confirm 写入 color：编辑态设色 → 确定 confirm → page.evaluate 读 saveBindingStore.activeBinding.groups → 断言 color 已写入
  - [✓] 3.2.2 透明色不持久化：设透明 → confirm → 断言持久化 color 不为 0x00000000 或透明值
  - [✓] 3.2.3 Reload 后 color 保持：confirm → reload → 再次导航到 map binding-sector → 断言之前颜色仍显示

- [✓] 3.3 地图颜色来源：覆盖 binding 模式使用 shared draft，非 binding 模式使用 persisted active binding
  - [✓] 3.3.1 Binding 模式颜色来自 draft：编辑态设非默认色 → 检查 map SVG 对应 sector → 断言颜色与 draft 一致
  - [✓] 3.3.2 非 binding 模式颜色来自 persistent：confirm 后退出 binding 编辑 → 切换到非 binding map 视图 → 断言 sector group 颜色仍显示

- [✓] 3.4 overlay 层级：覆盖 faction owner、hub color、resource pie 的渲染层级
  - [✓] 3.4.1 Hub color 内部六边形可见：有 color group 的 coverage sector → 断言 map SVG 内存在内部六边形 (2/3 半径)
  - [✓] 3.4.2 无颜色不绘制六边形：无 color group → 断言对应 coverage sector 无内部六边形
  - [✓] 3.4.3 层级顺序正确：检查 MapSectorGroupColorLayer 渲染 → 断言 faction owner → hub color → resource pie 顺序

## 4 Virtual Station Tab

- [✓] 4.1 Map-only tab：覆盖 Map 显示 Virtual Station tab，Live columns 不显示
  - [✓] 4.1.1 Map tabs layout 显示 Virtual Station tab：map binding-sector → 断言 `.tab-btn:has-text("虚拟空间站")` 存在
  - [✓] 4.1.2 Live columns layout 不显示 Virtual Station tab：live auto sector group → 断言无 Virtual Station tab 按钮

- [✓] 4.2 blueprint 来源：覆盖 blueprint empire selector、blueprint station list、blank station source 的展示
  - [✓] 4.2.1 Blueprint empire selector 可见：Virtual Station tab → 断言 blueprint empire 选择器存在
  - [✓] 4.2.2 Blueprint station list 展示：选择 blueprint empire → 断言 `.free-station-item` 列表出现
  - [✓] 4.2.3 空白空间站来源项：断言存在空白空间站 (modules=[] template) 来源项

- [✓] 4.3 grouped list：覆盖 virtual station drafts 按当前 groups 顺序分组显示
  - [✓] 4.3.1 按 groups 顺序分组：检查 `.virtual-group` → 断言分组顺序与 autoGroupResult.groups 一致
  - [✓] 4.3.2 Item 显示 name/sector/坐标/删除按钮：检查 `.virtual-row` → 断言四项均显示
  - [✓] 4.3.3 Item 不显示 group 名：检查 `.virtual-row` → 断言不包含 group name

- [✓] 4.4 ungrouped list：覆盖未分组 virtual stations 显示在“提交时移除”区域
  - [✓] 4.4.1 未分组区域存在：有未分组 drafts → 断言虚拟空间站列表存在未分组区域
  - [✓] 4.4.2 移除说明文本：检查未分组区域 → 断言含"提交时移除"/"removed on confirm" 说明

- [✓] 4.5 文案本地化：覆盖 Virtual Station tab 和相关区域的中英文文案
  - [✓] 4.5.1 zh-CN tab 标签：zh-CN → 断言 tab 为 "枢纽"/"分配方案"/"交易站"/"虚拟空间站"
  - [✓] 4.5.2 en tab 标签：en → 断言 tab 为 "Hub"/"Allocation"/"Trade Station"/"Virtual Station"
  - [✓] 4.5.3 Virtual Station 区域中文：zh-CN → 断言标签、未分组说明均为中文

## 5 Virtual Station Drag 与 Overlay

- [✓] 5.1 blueprint 创建：覆盖从 blueprint station 拖拽创建 virtual station draft，并复制 station plan 必要字段
  - [✓] 5.1.1 拖拽源存在：Virtual Station tab 选择 empire → 断言 `.free-station-item` 可拖拽项存在
  - [✓] 5.1.2 创建增加 draft 计数：通过 page.evaluate 调用 createVirtualStationDraftFromBlueprint → 断言 virtualStationDrafts.length +1
  - [✓] 5.1.3 复制字段包括 name/type/modules/settings/lockedWares/warePriority：检查新 draft → 断言六个字段均已复制 (deep clone)
  - [✓] 5.1.4 不复制 id/sectorId：检查新 draft → 断言 id 为新 UUID ≠ source id → 断言 saveStationCode 为 undefined

- [✓] 5.2 blank 创建：覆盖从空白空间站拖拽创建空 module industrial draft
  - [✓] 5.2.1 空白空间站来源项存在：断言存在空白 station 来源
  - [✓] 5.2.2 创建 type='industrial' modules=[ ] 的 draft：调用 createBlankVirtualStationDraft → 断言 type=industrial modules=[] lockedWares=[] warePriority={} saveStationCode=undefined

- [✓] 5.3 existing draft 移动：覆盖已存在 virtual station 再拖动只更新自身 draft，不重复创建 plan
  - [✓] 5.3.1 已存在 draft 可被操作：确保有 virtual station draft → 验证有唯一 id
  - [✓] 5.3.2 更新不重复创建：记录 drafts 总数 → 对已存在 draft 更新 sectorMacro/groupId → 断言总数不变 → 断言对应字段已更新

- [✓] 5.4 drop 拒绝：覆盖无 group 覆盖 sector 和多 group 命中时拒绝 drop
  - [✓] 5.4.1 无覆盖 sector 拒绝：将 virtual station 放到无 group 覆盖的 sector → 断言 draft sectorMacro 未变
  - [✓] 5.4.2 多 group 命中拒绝 (无 fallback)：模拟多命中 → 断言 drop 被拒绝

- [✓] 5.5 删除：覆盖删除按钮只删除 store draft，不直接写 binding
  - [✓] 5.5.1 删除按钮移除 draft：click virtual-row 内 × → 断言该 draft 从 virtualStationDrafts 移除
  - [✓] 5.5.2 删除不写 binding：记录删除前 binding stationPlans → 删除一个 draft → 断言 binding stationPlans 未变

- [✓] 5.6 overlay 激活：覆盖 Map binding 打开后 virtual station overlay 可拖动，不要求 Virtual Station tab 激活
  - [✓] 5.6.1 Overlay 从 draft 渲染：有 draft 时 → 断言 map SVG 存在对应 overlay marker
  - [✓] 5.6.2 不要求 tab 激活：切换到非 Virtual Station tab → 断言 overlay 仍可见

## 6 Virtual Trade Station Drag

- [✓] 6.1 overlay 渲染：覆盖 virtual trade station overlay 从 group trade station draft 渲染
  - [✓] 6.1.1 Group 选 virtual TS 时 overlay 可见：某 group trade station 设为 virtual → 断言 map SVG 有 virtual TS overlay
  - [✓] 6.1.2 未选 virtual TS 时无 overlay：group trade station 为 candidate → 断言无 virtual TS overlay

- [✓] 6.2 拖动 position：覆盖拖动只更新 group draft trade station position
  - [✓] 6.2.1 Position 可更新：通过 store 更新 virtual TS position → 断言 group draft trade station position 已更新
  - [✓] 6.2.2 拖动不直接写 binding：检查 saveBindingStore.activeBinding → 断言 TS position 未持久化

- [✓] 6.3 hub sector 限制：覆盖 drop 到非 hub sector 被拒绝
  - [✓] 6.3.1 非 hub sector 拒绝：尝试将 virtual TS 放到非 hub sector → 断言 position 未更新
  - [✓] 6.3.2 Hub sector 接受：放到 hub sector → 断言 position 已更新

- [✓] 6.4 不修改归属：覆盖拖动不修改 `TradeStationBinding.sectorMacro`、group `sectorMacro`、coverage 或 station plan
  - [✓] 6.4.1 TradeStationBinding.sectorMacro 不变：拖动后 → 断言 sectorMacro 未变
  - [✓] 6.4.2 Group 数据不变：拖动后 → 断言 group sectorMacro/coverage/station plan 均未变

- [✓] 6.5 坐标展示：覆盖 Trade Station tab 中 virtual 选项显示当前坐标
  - [✓] 6.5.1 Virtual 选项显示坐标：Trade Station tab virtual 选项 → 断言 `.candidate-item--virtual` 含坐标
  - [✓] 6.5.2 坐标更新后刷新显示：更新 virtual TS 坐标 → 断言 tab 中坐标同步更新

## 7 回归风险

- [✓] 7.1 防止 Map 面板操作触发自动计算
  - [✓] 7.1.1 面板挂载不计算：关闭再打开 panel → 断言 autoGroupResult 未重新计算
  - [✓] 7.1.2 Tab 切换不计算：快速切换所有 tab → 断言 groups 数据未变
  - [✓] 7.1.3 Close 再 open 不计算：关闭 panel → 重新打开 → 断言无重新计算

- [✓] 7.2 防止 Hub edit 态错误禁用 Virtual Station tab
  - [✓] 7.2.1 Edit 态 Virtual Station tab 可用：编辑态 → 点击 Virtual Station tab → 断言内容可见
  - [✓] 7.2.2 Edit 态可在 Virtual Station tab 操作：编辑态 → 断言删除按钮可用且 blueprint 列表可见

- [✓] 7.3 防止 virtual station drop 使用 fallback group
  - [✓] 7.3.1 多 group 覆盖不选第一个/最近/任意：模拟多命中 → 断言 drop 直接拒绝

- [✓] 7.4 防止 existing virtual station 拖动重复创建 station plan
  - [✓] 7.4.1 已存在 draft 拖动后数量不变：记录 draft 数 → 对已存在 draft 操作 → 断言总数不变

- [✓] 7.5 防止旧 MapBinding 面板重新进入生产路径
  - [✓] 7.5.1 MapSavePanel.vue 不 import MapBindingSectorGroup：搜索 imports → 断言不含 MapBindingSectorGroup
  - [✓] 7.5.2 MapBindingPanel.vue 不存在于生产路径：检查 src/components/map/ → 断言无 MapBindingPanel.vue 或未被引用
