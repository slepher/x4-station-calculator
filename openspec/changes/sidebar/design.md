# 设计：产能侧栏交互完善

## 现状与变更关系

- 当前实现是 `ProductionSidebar.vue`，两个产能工作区均通过 `useProductionSidebarPresenter.ts` 接入；`tab-2-sidebar` 是前置变更，本次增量完善已有实现。
- Vue 当前仍自行构造 `fixedItems`、`dynamicItems`、`groupSectors`，解析图标与组名称。将这些展示组装移到 presenter，Vue 只渲染和处理 DOM 输入。
- 当前折叠集合与 `collapsed` 是组件局部状态；基础组折叠和蓝图排序已经存在，不重复实现。
- 蓝图没有业务分组。实况组信息来自绑定；`useSaveBindingStore.updateGroup()` 修改草稿，`saveBinding()`／`discardChanges()` 控制保存边界，`normalizeGroupRefsToSectorMacros()` 保留颜色。
- `useLiveProductionStore.jumpToMapBinding()` 已可按有效 station/transit 定位绑定组，条目绑定管理沿用此入口；实况不增加底部通用入口。
- 实况 `deleteStation()` 删除规划，`canDeleteStation()` 排除带 `saveStationCode` 的规划；解除绑定继续走现有绑定管理，不扩大删除权限。
- 主规范为 `openspec/specs/station-tabs/spec.md`。本变更只提供 delta，不修改主规范或历史 change；旧规范末尾的 unified 测试目录说明与当前 skill 不一致，本次遵循当前 skill 使用 `tests/unit/**`。

## 三层职责

```text
领域 stores + 侧栏偏好 store
              ↓
useProductionSidebarPresenter（显式 blueprint/live 分支）
              ↓
ProductionSidebar + 纯展示子组件
```

- Store：领域状态、组元数据更新、蓝图排序、导航上下文和本地偏好持久化；不输出行、图标或菜单等 UI 结构。
- Presenter：产出固定入口、置顶入口、分组／站点行、颜色、tooltip、状态标记、菜单权限、底部动作；负责搜索、排序 ID 校验、偏好协调和调用领域能力。
- Vue：展开／窄栏／抽屉布局、DOM 测量、滚动、浮层定位、pointer 输入；只调用 presenter 暴露动作。纯展示子组件用 props/emits 与该 presenter 连接，不增加中间业务层。
- 调用 presenter 时显式传入 `blueprint` 或 `live` 模式，使用可区分合同声明各模式能力。禁止继续用 `!uniqueStation` 推断新增／绑定权限，禁止用可选方法 fallback 链拼出操作。
- 两个工作区本次侧栏接线均通过 presenter；工作区其他历史 store 直连不在此次全面重构范围。

## 业务动作

| 动作 | 蓝图 | 实况 |
| --- | --- | --- |
| 底部主入口 | 创建规划站点并按现有规则选中 | 不显示 |
| 分组编辑 | 当前无组，不输出入口 | 更新当前绑定组名称与颜色 |
| 条目菜单 | 现有重命名、复制、确认删除、置顶 | 管理绑定、置顶；仅现有允许的未绑定规划可删除 |
| 排序 | 站点完整排列交由原领域 owner | 按绑定保存侧栏展示排列 |

presenter 的 primaryAction 在蓝图返回添加站点动作，在实况明确返回 null；Vue 仅在存在动作时渲染底部区。实况条目绑定管理沿用 `jumpToMapBinding()`，不新增通用绑定导航方法，不在 Vue 写导航 store。

组身份必须沿用当前绑定的规范化身份。当前 `updateGroup()` 通过 `getGroupKey()` 查找，不能假定 sidebar 的 sector ID 等于原始 `group.id`；由领域层提供明确映射，测试 sectorMacro 身份。修改名称／颜色不得改变该键。编辑浮层打开时保存 `{contextId, groupKey, originalName, originalColor}`；应用前确认上下文与实体仍有效，并检查同字段未被外部改动，冲突时提示重新打开。只提交 name/color patch，不覆盖其他字段。

## 展示和交互默认值

- 桌面展开宽度默认 240px，最小 200px，最大 400px；收起宽度 64px；窗口小于 768px 使用抽屉。抽屉宽度为 `min(320px, viewportWidth - 32px)`。
- 侧栏收起只隐藏文字和次要按钮，保留功能图标、组折叠按钮、组颜色边线和展开组的站点；组菜单可通过右键或先展开后“⋮”访问。
- 主图标列使用距 sidebar 左边缘 32px 的固定中心线；顶部按钮、常用入口、站点、分组折叠和蓝图“＋”使用同一列，展开／收起不改图标偏移或行高。导航行统一 36px，拖拽手柄绝对定位在图标左侧，不参与导航宽度分配；收起时去除文字与次要菜单，不改主图标的位置。
- 分组箭头使用彩色圆角按钮，展开向上、收起向下；展开成员旁绘制同色竖线。分组标题始终使用同一行高：收起时 Transit 导航为行右侧的小图标，与主折叠按钮保留独立点击区域；展开时组名承担该导航。地形改造树使用蓝色折叠按钮与竖线，折叠不导航。
- 组箭头、导航名称／图标、“⋮”互相阻止事件冒泡。颜色不取代活动背景、边框和 tooltip 这些非颜色提示。
- 当前行仅保留背景与文字高亮，移除 inset 左侧阴影；包含当前项且自身未选中的分组使用轻背景提示，不绘制半月形高亮。分组成员颜色竖线独立保留。
- 预设色值：灰 `#5f6368`、蓝 `#1a73e8`、红 `#d93025`、黄 `#f9ab00`、绿 `#188038`、粉 `#d01884`、紫 `#a142f4`、青 `#007b83`、橙 `#fa903e`。适配项目暗色主题的前景与背景，色板当前值显示选中圈；非预设色显示当前色样。
- 组颜色未设置时使用中性灰作为展示默认值，不把默认色写回领域数据。应用只改名时保留原颜色（包括 undefined 和已有自定义色）。
- 名称／颜色在浮层草稿中预览，点击应用才提交；取消或外部关闭丢弃草稿。空名称显示本地错误。popover 使用现有浮层能力并限制视窗边界。
- 顶部展开／收起按钮和蓝图底部动作置于滚动容器之外，使用不收缩的布局项；中间唯一滚动容器通过 flex 使用剩余空间并设置 min-height: 0，包含功能入口、特殊树、置顶、搜索、分组和站点。删除原固定功能区容器、`55%` 高度上限、底部百分比高度上限及横向分割线；不为功能和站点分别滚动或分配高度。置顶快捷入口位于常用功能之后；原组实体入口保留，DOM key 区分两入口，业务身份一致。
- 原有 terraforming 等特殊树由 presenter 保留其行为；它们不因视觉上有子项就变成可改名改色的业务分组。
- 不新增全局快捷键／方向键导航。使用原生 button、标签、可见焦点和已有基础键盘行为。

## 偏好与恢复顺序

新增领域无关的 `useProductionSidebarStateStore`（名称可按仓库约定调整），持久化键 `x4_production_sidebar`，带版本字段和 `normalizeState()`。它属于 store 层，不是额外适配层。

- 模式键：blueprint/live → collapsed、expandedWidth。
- 上下文键：模式 + 蓝图 ID／binding gameGuid → collapsedGroupKeys、scrollTop、pinnedStationIds；实况额外存 groupOrder 和 stationOrderByGroup。
- 无有效蓝图／绑定时只使用临时空上下文，不把不同草稿强行共享到一个持久化身份。
- 偏好立即本地持久化，不使业务草稿变脏。名称／颜色仍遵循绑定保存；蓝图站点排序仍由蓝图保存。
- 查询、popover 草稿、抽屉是否打开、resize/drag 临时状态在组件／presenter 会话中管理，不持久化。
- normalization 逐字段校验类型、去重并裁剪宽度；实体数据加载完成后才剔除失效 ID，不能在加载中空列表时清空偏好。新增组按业务顺序追加，新增站点按原顺序追加，跨组后的旧展示偏好失效。

恢复优先级：
1. 明确的外部导航意图（含同一站点重复导航）：使用独立递增定位 token，结束搜索、展开目标组、DOM 更新后 `scrollIntoView({ block: 'nearest' })`；token 消费一次。
2. 普通工作区返回／挂载：恢复对应上下文偏好与 scrollTop，不强制展开当前组。
3. 首次无偏好：侧栏展开，展开当前站点所在组，其余组折叠，滚动到当前项。
4. 无关数据刷新：只更新数据，保留折叠与滚动。

搜索首次输入前保存折叠与滚动快照；presenter 按 trim 后不区分大小写的名称包含匹配过滤。搜索状态临时展开匹配组，不覆盖持久化折叠集合；无结果显示提示。清除恢复快照；搜索中主动选中条目保留业务选择，但清除仍恢复原浏览快照。外部导航按最高优先级处理。

## 拖动合同

本节遵循 `.trae/skills/x4-drag/SKILL.md`、列表配方及其引用的本地机制。实施排序前需重新核查锁文件和已安装源码版本；沿用项目已有 vuedraggable，不新增拖动框架。

- 使用 `:model-value` 与 `@update:model-value`，不把 computed 过滤数组作为 `:list` 写入；只在 update 回调经 presenter 提交一次稳定 ID 排列。
- 展开、未搜索时显示独立拖动 handle，采用 `forceFallback` 与 `fallbackOnBody`、约 4px 启动阈值；每组为独立实例，不配置允许跨组转移的 Sortable group。分组排序与组内排序使用不同 handle，按钮／输入框不启动拖动。
- 蓝图拒绝缺失、重复或额外 ID 的排列；实况同组排列要求成员全集一致，组排列要求有效组全集一致。排序前后 active ID、实体内容和归属不变。
- 来源业务实体保留；库维护同尺寸占位，跟随影像来自源行、半透明呈现。Vue 不额外插入假实体、shadow 或手工移除库 DOM。
- hover 只改变临时布局。有效列表内释放提交；列表外释放、取消、上下文变化或卸载均不提交，用拖动开始快照恢复展示。update 提议需等结束时确认释放落点合法后提交，避免库默认外部释放行为破坏取消合同。
- 搜索、窄栏、置顶快捷区不支持拖动；置顶顺序采用添加顺序，取消置顶不修改原组。
- 宽度调整使用 Pointer Events 与 pointer capture，移动期间只预览；pointerup 保存有界宽度，pointercancel／卸载恢复原值并清理。resize 与排序 handle 分离，窄屏抽屉不调整宽度。

## 验证与实施风险

- 每项行为的 focused Unit 与实现同任务交付：模式动作隔离、组身份／草稿保存、偏好隔离／迁移、外部定位 token、搜索恢复、排序非法集合与取消、置顶失效清理、布局分支和菜单事件。
- Unit 不能证明 tooltip 可见性、真实拖动命中、占位几何、抽屉遮挡或 scrollIntoView 的最终视窗效果。后续 `/x4:e2e-test sidebar` 单独规划、实现和运行真实输入验证，使用现有稳定 sidebar 锚点；Live 使用统一 live binding fixture。
- 保留现有锚点，新增 `sidebar-tree-toggle`、`sidebar-group-menu`、`sidebar-group-editor`、`sidebar-group-name`、`sidebar-group-color`、`sidebar-search`、`sidebar-resize-handle`、`sidebar-drawer`。实体 ID 放 data 属性，颜色放 data-color，名称不作为定位身份。
- 对本变更涉及的 store/presenter 不新增 fallback 链；空数据、未加载、失效上下文分别处理。
- 所有行为完成后执行 `npm run build`，不涉及 Rust 源码，不运行 build-rust。

## 实施落点

- `useProductionSidebarStateStore` 持久化 `x4_production_sidebar`（version 1），显式 normalization 模式与上下文字段；无身份的偏好仅保留在 presenter 会话。
- `useProductionSidebarPresenter({ mode, store })` 使用可区分的蓝图／实况合同。Terraforming 名称与温度图标使用原始领域数据在 presenter 组装；`ProductionSidebarRow` 只接收展示 props 和发出 DOM 事件。
- `loadedBindingGameGuid` 在异步读取完成且上下文仍有效时更新，加载完成前不清理偏好或恢复滚动。
- `useSaveBindingStore.updateGroupMetadata()` 以规范 sectorMacro 检查上下文、名称／颜色冲突，再调用原 `updateGroup()`，保留原保存／放弃边界。
- `useActiveViewStore.navigateToProduction()` 与 `consumeProductionNavigation()` 提供显式、递增、一次消费的定位意图；该 token 不写入持久化状态。
- 排序使用 vuedraggable 4.1.0 / SortableJS 1.14.0。取消与上下文切换通过 Vue key 卸载库实例，让库清理影像／监听；不手动移除库 DOM。窗口 blur、pointercancel、touchcancel 和卸载处理输入中断，不注册全局键盘快捷键。
- 桌面展开／收起及窄屏抽屉共用同一滚动边界：仅中间内容滚动，顶部按钮和蓝图底部“＋”保持原位。滚动偏好及外部定位都作用于这一容器。窄屏 drawer 锚点位于包含真实导航内容的容器，保留 production-sidebar 根锚点。
