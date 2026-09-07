# FIX-M10.3-DIAG — 只读诊断

结论：最小源修复归属共享 `src/components/common/X4DualPhaseRangeSlider.vue` 的原生input同步。store已收到220且库存总量正确，无需改ShipStoragePanel或领域容量政策。本合同未改源码/测试，未运行browser；另行父级调度的FIT/DETAILS构建与本诊断无关。

## 已有真实失败

M10.3当前合成21满足/1失败，不能算全过。`/tmp/x4-migration-M10.3/correction.log` 及 `correction/ship-ship-items-3-8-drag-i-c40be--shared-deployable-capacity-chromium/error-context.md` 保留真实鼠标move/down/move(10steps)/up后故障：Osaka deployable上限250，Nav Beacon30，Resource Probe显示220/250而原生slider值250。软断言后的总计250/250、blueprint waypointmarker30/resourceprobe220、enabled均通过。原失败在focused目录继续保留，不重跑同路径。

权威：archive/2026-03-09-ship-items/specs/ship-items/spec.md“ 双阶段拖动条 ”明确点击dragMax..max后当前值为dragMax，同时全宽可拖且不禁用。不能把HTML max缩至dragMax来隐藏问题，否则灰区点击/全宽语义改变。

表现限定：`.range-slider`为opacity-0，绿色/蓝色自绘填充由normalizedValue控制，已有220显示正确；不能称肉眼可见thumb错误。真实错误是原生控件当前value及浏览器可访问slider值不一致，并给后续键盘操作留下未规范化起点。现有E2E没有证明键盘具体后果，键盘若要验收须另用真实事件验证，不能凭推断加重结论。

## 调用链及根因

1. ShipStoragePanel getDeployableDragMax 排除当前物品，250−30=220；modelValue来自localDeployables，HTML max依然250，dragMax220。
2. slider `toNumber`（80附近）读取原生input.value后夹至effectiveMax，却只返回结果；`handleInput`只emit，不把夹后的值写回input.value。
3. Storage `handleDeployableChange`接收220、写local值并saveToBlueprint；commitCurrent再次夹到220，领域数据正确。
4. 跨过220后的多个原生input事件仍可使input.value变成250。此时modelValue与normalizedValue已是220，重复emit220不使slider的展示props改变。Vue本地runtime-core shouldUpdateComponent比较动态props，emit监听不算变化；无子组件重渲染则`:value`不会再次写DOM。runtime-dom patchDOMProp在真正patch发生时会比较原生value并写回，故根因不是Vue永远不修正相同虚拟value，而是不能依赖一次未必发生的重渲染修复原生事件副作用。
5. 原生value属性220与当前property250可分离；watch modelValue也无法解决已经220时持续raw250的重复事件。

## 全调用者与边界

`rg X4DualPhaseRangeSlider src tests --glob '!*.md'`：源只有两组件、五处模板实例。

- ShipStoragePanel deployables、drones、missiles：共享容量，传dragMax；update与commit都调用各自保存动作。
- ShipStoragePanel countermeasure：不传dragMax，max为countermeasureLimit，update/commit保存。
- ShipBuildPanelFit：不传dragMax，group/connection不同step，update仅draft，commit才领域赋值；新FIT7项只浅挂载子slider，不能代替其原生DOM回归。
- PriceSlider、VolumeControlSlider、StationDashboard和MapWorkbench另有range输入，但未调用此组件，不属于本缺陷源修复闭包。

本问题属于通用UI控件原生事件适配，不涉及面向Ship UI的领域组装；不应为了DOM input.value同步引入store或新presenter层。现有调用者直连store属于历史边界，不借本次重构。最少拟写：共享slider源码 + 新 `tests/unit/common/x4-dual-phase-range-slider.spec.ts`，另配独立change与结果记录。调用者源码、store、FIT/DETAILS presenter均只读。

## 最小修复建议与focused Unit设计

在已有输入规范化路径中同步把夹后的数写回原生input.value，再emit同一数；commit使用同一规范化路径以覆盖直接change及mouseup读取，保持原有skipNextChange/窗口监听生命周期和事件次序。无需额外watch、定时nextTick、DOM重建key、缩小HTML max或第二套状态。min/max/dragMax既有数值政策不扩域。

真实mounted Unit先red：挂载组件或简单v-model宿主（不stub slider）。max250/dragMax220/model220，将真实HTMLInputElement.value设250后触发input，再次重复该事件且父model仍220。断言原生value220、update220、max属性仍250、非disabled、填充88%；该例不依赖emit反推DOM，旧代码预期原生仍250。再从0→220达到边界后连续raw250，排除只修初次patch。

有限对照：mousedown→input→window.mouseup→change仅一个commit220；不经mousedown的change也夹回DOM220并commit；touchstart/end同一行为；dragMax0允许操作但值0；无dragMax正常min/max与step透传、父prop更新仍同步；unmount后窗口mouseup不再commit。disabled原生属性与不启动drag生命周期即可，不用人工对disabled输入dispatch来虚构浏览器行为。Unit提供原生property边界红绿，不能宣称替代真实浏览器鼠标拖动。

后续独立E2E：修复build后先原3.8精确复验，再M10.3完整22；真实鼠标和下游库存断言保留。若FIT当前合并候选已通过另行回归，可有限复用既有消费者证据，不扩大成所有range组件重构。没有新业务裁决阻碍，待父级授权最小apply。
