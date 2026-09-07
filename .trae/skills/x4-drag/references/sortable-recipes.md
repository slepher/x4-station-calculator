# 列表、shadow、占位与 hover 配方

以下路径均相对仓库根。版本基线：锁文件与已安装源码为 vuedraggable **4.1.0** / SortableJS **1.14.0**；升级后重新核实。

## API 契约与选择

核查来源：[Vue draggable 文档](https://github.com/SortableJS/vue.draggable.next#props)、[Sortable 文档](https://github.com/SortableJS/Sortable#options)、本地 `node_modules/vuedraggable/src/vuedraggable.js` 的 `alterList/onDragAdd/onDragRemove/onDragUpdate`，以及 `node_modules/sortablejs/Sortable.js` 的 `nativeDraggable/_appendGhost`。

| API | 已核实契约 | 选择含义 |
| --- | --- | --- |
| `:list` | `alterList` 直接修改传入数组，新增使用 splice | 仅用于明确允许修改的集合；computed 过滤结果不是权威可写状态 |
| `:model-value` + `@update:model-value` | 复制数组、修改副本，再 emit 新数组 | 适合经 presenter 提交顺序；这不是深拷贝，实体字段仍不可随意改 |
| `pull: 'clone'`、`clone` | 源 remove 路径不删除原数据；clone 回调决定传递的数据对象 | 展示对象 clone 不等于领域创建；ID、深复制字段及重复规则由业务能力处理 |
| `@add` / `@change` | wrapper 的 add 路径已做目标列表插入；change 在 nextTick 发出 | 不能在多个回调重复创建；`@change` 不能未经验证就作为释放前 hover 来源 |
| `forceFallback` | 为 true 时禁用 Sortable nativeDraggable；否则视浏览器支持选择原生模式 | 不能宣称 Sortable 不使用原生拖放事件；合成事件仍不等于真实输入链 |
| `ghostClass` / `fallbackClass` | 分别作用于列表占位样式与 fallback 跟随影像 | 两者不是一个对象；先识别运行模式，再调整 CSS |

旧方案 `:list="[]"` **仍会执行数组插入**，并不保证只触发信号。Logic Flow 存在此历史方案，复用时必须核对临时数组、渲染和清理；不要当成所有目标的标准实现。

## 1. 同列表排序

优先参考 `src/components/empire/ProductionSidebar.vue` 的 `dynamicItems/handleStationReorder`，以及 `src/components/empire/presenters/useProductionSidebarPresenter.ts` 的 `reorderStations`。

推荐连接形态（方法名为设计骨架，按实际 presenter 接口适配）：

```vue
<draggable
  :model-value="presenter.items"
  item-key="id"
  handle=".drag-handle"
  @update:model-value="presenter.reorderItems"
>
  <template #item="{ element }">
    <ItemRow :item="element" />
  </template>
</draggable>
```

Presenter 将展示顺序映射为稳定 ID，调用 store 的排序能力；不得把展示包装对象直接当持久化实体。若排序即时生效，拖动经过其他项后释放到外部不自动意味着回滚；取消合同须与实现一致。

目标样式可参考 `src/components/empire/sector-overview/SectorGroupList.vue`：`force-fallback`、`fallback-on-body`、handle、`ghost-class="drag-placeholder"`。该组件的 `:list="groups"` 是当前行为证据，不是所有 presenter 输出均可写的依据。

验证：真实 handle 启动；释放前占位；释放后精确 ID 顺序、成员内容不变；需要时确认并刷新。现有测试入口见 playbook。

## 2. 跨列表移动与 clone 创建

- **移动现有实体**：共享 Sortable group，先定义哪些目标可接受。来源删除和目标插入由同一次业务转移负责；若两个列表分别 emit，使用明确的临时可写展示集合协调，再通过一个 presenter 操作提交。不要两边分别改权威归属；验证失败/取消不会丢失或复制实体。
- **复制模板创建**：参考 `LogicFlowCandidateZone.vue` 的 `pull:'clone', put:false, sort:false` 和 clone，以及 `LogicFlowPlanningZone.vue` / `ProductionLineGroup.vue` 的提交路径。只传来源身份或干净的拖动 payload；领域创建负责新 ID 和需要深复制的字段。
- 新目标若需受控列表，接收库修改的是临时展示集合；在一个选定提交回调中调用 presenter，再按权威结果重新展示并清理临时项。不要把 computed 展示项 splice 后又向业务数组插入同一项。
- 只需要“落到此区创建”且库列表插入、DOM 与业务归属难以协调时，比较独立意图式 drop zone 的方案；必须让源与目标使用同一真实输入链，不在 Sortable 拖动上盲目叠加另一套鼠标提交。

`evt.item._underlying_vm_` 等现有内部字段是版本耦合点；新方案优先评估公开 `change.added.element` 等已核实的接口，并确认其时机满足合同。不要用深拷贝展示对象绕过业务身份规则。

验证：源保留/移除正确、目标增加一次、ID 正确、拒绝无变化；不能只看目标 count。

## 3. shadow 不同于源外观

| 需求 | 优先方案 | 限制 |
| --- | --- | --- |
| 仅颜色、透明度、边框不同 | 当前模式对应的 CSS class | 不需要自定义浮层；ghostClass 不代表跟随影像 |
| fallback 影像只需隐藏次要内容、收紧尺寸 | 已验证 fallback 模式 + fallbackClass/CSS | 跟随 DOM 源自源项；复杂异构结构先做最小浏览器验证 |
| 原生拖放需要独立静态影像 | 在有效 dragstart 内使用 `DataTransfer.setDragImage` | 仅适用原生路径；不是 pointer/mouse 自定义拖动的 API |
| 跟随影像结构完全不同或需持续响应业务状态 | Vue 自定义浮层；和当前输入机制明确集成 | 先证明可获得连续坐标，并有受支持的默认影像抑制方式；否则重新选机制，不能靠手工删库 DOM |

原生影像能力和时机见 [setDragImage](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/setDragImage)。自定义浮层见地图配方。上述异构 shadow 是方案候选，当前 15 项验证未专项验证其外观。

## 4. 目标占位与插入位置

**普通排序**优先使用库已有占位。**需要目标专用行样式**时，先判断 ghost 样式是否足够；源卡片与目标行结构差异很大时，评估 Vue 自绘占位。

自绘配方：

1. presenter 提供只读真实展示项与独立 preview 描述。占位使用临时 UI identity，不进入领域数组和保存数据。
2. 确认释放前更新入口；Sortable `move` 可用于评估候选目标，但它有接受/拒绝返回值，不能为了预览破坏其契约。不要等 `@add/@change` 后才生成所谓 hover 占位。
3. 选择一种布局归属：库占位负责空间而 Vue 仅绘制外部覆盖预览；或自定义输入/受控布局独占插入空间。不要在同一列表同时插入库 ghost 和会参与索引的 Vue 假实体。
4. 插入索引由真实项身份和位置决定，排除占位、header、footer、隐藏项。释放时传领域可理解的索引或相邻实体 ID。
5. 若占位撑开布局导致索引往返：先记录指针、真实项边界、候选索引和占位尺寸。可选择不影响布局的覆盖预览，或固定占位尺寸并基于稳定真实项边界判定。只有证实边界噪声后才评估方向/阈值滞回，不靠 timeout。
6. 离开、拒绝、取消、释放后清理；提交成功时真实项替换预览，避免同时保留两者。

`src/components/empire/terraforming/TerraformingResourcePanel.vue` 当前有 `dragHoverIndex/displayPlanEntries/_type:'drag-clone'`。这是待验证实现，不能引用为稳定配方；`openspec/changes/terraforming-task-goal/drag.md` 中历史尝试也不代表当前正确方案。

专项测试：释放前检查占位的身份、位置、尺寸；同一点附近及相邻项之间分段移动，逐步断言占位索引/数量及几何，不只抽查一次可见；换目标清旧占位；释放后无临时项且只提交一次。不要把真实指针跨越边界导致的合法换位误判为抖动。

## 5. enter/leave 计数器防闪烁

已有实现：`src/components/logic-flow/LogicFlowPlanningZone.vue` 的 `dragEnterCounter/newZoneEnterCounter/handleDragEnter/handleDragLeave`，每个区域单独计数；`watch(isDragging)` 结束时清零。`src/components/test/DragTestPage.vue` 也有计数器，但该页完整投放测试失败，不能复制整页作标准。

用于父子 DOM 边界事件引发的 hover 反复开关。最小单区骨架（Vue 局部计数，业务经 presenter）：

```ts
let depth = 0
function enter() {
  if (!presenter.isDragging) return
  depth += 1
  if (depth === 1) presenter.enterTarget(targetId)
}
function leave() {
  if (!presenter.isDragging || depth === 0) return
  depth -= 1
  if (depth === 0) presenter.leaveTarget(targetId)
}
function resetDepth() { depth = 0 }
watch(() => presenter.isDragging, active => { if (!active) resetDepth() })
onBeforeUnmount(resetDepth)
```

该骨架只展示计数：目标卸载或交互取消仍需通过拥有会话的 presenter 清除 active target/preview；不能只清局部数字。多区按稳定目标 ID 分别初始化、删除计数。计数解决 hover 闪退；若占位由 hover 控制，可避免该原因的闪现，不能解决布局造成的索引振荡。

验证边界：Unit 可直接验证 `0→1→2→1→0` 仅首次进入/最后离开通知及 reset；真实 E2E 需移动经过嵌套子元素并保持 hover/preview，完全离开才清除，取消后下一次仍能进入。现有 E2E 只有普通进入/离开/取消的间接覆盖，尚无此专项证明。
