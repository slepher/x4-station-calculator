# sidebar → map、shadow 与空间预览

路径均相对仓库根。以下区分当前代码、已运行覆盖和新方案骨架；不要把历史直接 store 调用复制进新 Vue。

## 1. 优先复用当前输入链

| 环节 | 当前入口 | 应保留的能力 |
| --- | --- | --- |
| 空白、蓝图、已有虚拟站 sidebar 来源 | `src/components/map/AutoSectorGroupPanel.vue`；`src/components/empire/presenters/useAutoSectorGroupPresenter.ts` 的 `startVirtualStationDrag` | 精确来源 payload、4px 启动阈值、拖动结束 |
| 其他 sidebar 来源 | `src/components/map/MapBindingStation.vue` 的 `onFreeStationMouseDown` | 当前实现存在；普通候选、virtual trade sidebar、sector 来源缺专项 active E2E 证据 |
| 跨组件传递 | `src/components/map/MapSavePanel.vue` 的拖动事件转发 | 对接现有父子事件，不新建全局事件总线或中间业务层 |
| 地图接收与命中 | `src/components/map/MapWorkbenchView.vue` 的 `onBindingDragStationStart/resolveLocationAtPointer` | 保存来源、目标 coverage、身份；客户端坐标转换到地图落点 |
| 预览与释放 | 同文件 `onMouseMove/stopDrag/clearPlacementState` | 更新预览，合法释放才提交，然后清理 |
| 地图已有 overlay 来源 | 同文件 `onOverlayPointerDown` | 独立于 sidebar 的入口；不可用其测试替代 sidebar 创建 |

当前是自定义 mouse 输入和 window move/up 监听，另有 native dragover/drop handler。新增鼠标同类功能优先复用已成功的链，不因为函数名含 Pointer 就假定已使用 Pointer Events。

需要触控、笔或明确 pointer capture 能力时再评估 Pointer Events。采用后协调 `pointercancel/lostpointercapture`，capture 下不能依赖事件 target 代表指针下元素；几何或 `elementFromPoint` 仍需独立计算。声明实际输入支持与 `touch-action` 范围。能力参考 [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)；当前鼠标测试不证明触控支持。

## 2. 创建与移动分别提交

释放前明确来源种类，不按“哪个字段碰巧有值”连续兜底：

| 来源 | 当前领域能力 | 结果合同 |
| --- | --- | --- |
| 空白生产站模板 | `createBlankVirtualStationDraft` | 新 ID、空 modules/lockedWares/warePriority，创建 draft |
| 蓝图生产站 | `createVirtualStationDraftFromBlueprint` | 新 ID、不复制 saveStationCode，按合同深复制模块和设置，源保留 |
| 已有虚拟生产站 | `moveVirtualStationDraft` | 原 ID 与数量保持，只修改允许的位置/归属 |
| 虚拟交易站 | `moveVirtualTradeStationDraft` | 保留交易站身份，遵守 coverage/hub 拒绝规则 |

这些能力目前可在 `MapWorkbenchView.vue` 的历史直接 store 路径追踪。新代码由 presenter 根据明确来源状态调用领域能力。不要为 skill 任务顺便重构旧地图；实际改动按授权范围迁移。

可采用带明确 kind 的 UI 拖动会话（设计形态，不要求引入新框架）：来源身份、指针起点、当前坐标、目标结果、阶段。领域能力继续由现有 store 拥有。释放时只消费一次 active 会话；取消只清理。hover 更新不等于 saved 状态更新，draft 与确认持久化分开。

## 3. sidebar 卡片变为紧凑 shadow

先明确三个独立对象：sidebar 源卡片、跟随指针的紧凑 shadow、地图落点 preview。空间 preview 不应撑开 sidebar 或改变地图容器布局。

对于现有自定义 mouse 链，自绘 shadow 的最小视觉骨架：

```vue
<Teleport to="body">
  <div
    v-if="presenter.dragVisual.active"
    class="drag-shadow"
    :style="{
      left: `${presenter.dragVisual.clientX + 12}px`,
      top: `${presenter.dragVisual.clientY + 12}px`
    }"
    aria-hidden="true"
  >
    <img :src="presenter.dragVisual.icon" alt="" />
    <span>{{ presenter.dragVisual.label }}</span>
  </div>
</Teleport>
```

```css
.drag-shadow { position: fixed; pointer-events: none; }
```

这是候选骨架，`dragVisual` 由 presenter 组装，偏移与尺寸按合同选择，z-index 使用项目层级约定；当前专项测试尚未证明该异构 shadow。已有有效影像时先复用，不重复渲染。若选择 Sortable/原生输入而非自定义 mouse，必须先解决其默认影像和连续坐标契约，见列表配方。

事件接线顺序：

1. 有效源按下记录身份和起点；点击、展开按钮、删除按钮与拖动区域明确区分。
2. 超过约定阈值后启动会话，协调地图平移；未启动的 mouseup 保留正常点击语义。
3. move 将 client 坐标交给已有坐标解析能力；presenter 组装 shadow 与合法/拒绝 preview。纯视觉浮层不得挡住目标命中。
4. 使用转换后的地图坐标提交；client 像素不能直接保存成地图世界坐标。缩放、滚动与 SVG 变换沿现有公式，不再写另一套近似映射。
5. up 读取同一会话的合法目标，经 presenter 提交一次。目标非法、释放到外部或明确取消时按合同保持状态。
6. 释放、取消、窗口失焦或输入中断、组件卸载都调用同一清理能力，移除监听及 shadow/preview。若采用 capture，还要处理取消/丢失 capture。不要假设一定收到 mouseup。

## 4. 命中、preview 与占位稳定

- 地图目标可能被已有 overlay 遮挡。先确认业务要命中 sector 还是 overlay，再使用几何/DOM 命中；不要随意 `.first()` 或固定 boundingBox 中心。
- 自动选择测试坐标只从指定目标内部查可命中点，不在拖动失败后换到另一个业务目标。诊断保留目标 ID、坐标、实际命中元素。
- 地图预览若随 hover 闪退，先检查输入机制、覆盖层和目标判定。当前地图未发现 enter/leave 计数器；不要直接加入列表的计数器或 timeout。
- sidebar 列表自身需要占位时，按列表配方确定空间归属。shadow 是跟随指针的视觉，不能兼任会改变列表布局的占位。

## 5. 复用测试及扩展合同

入口 `tests/e2e/auto-sector-group-one-map/auto-sector-group-one-map.spec.ts`：`startDrag/hoverSector/drop` 是文件内 helper；`startDrag` 检查源实际可命中，`hoverSector` 通过 `elementFromPoint` 查目标，`drop` 释放前断言 preview。优先复用同场景已有代码；跨文件复用需实际需求，不为文档先抽象 helper。

Fixture 使用 `tests/e2e/live/helpers/loadLiveBindingFixture.ts`；随后经 UI 打开 Live → Auto Sector Group → Map、所需 tab 和蓝图菜单。`page.evaluate` 只读几何/状态不能代替拖入。

| 合同 | 断言 |
| --- | --- |
| 创建 | 操作前不存在、释放后新 ID 和精确字段、源是否保留、创建一次 |
| 已有对象移动 | 精确 ID、数量不变、位置变化且其他内容不变 |
| 拒绝/取消 | 释放前合法性信号、释放后对象及归属不变、清理 |
| preview | 释放前可见且属于精确目标；不以 DOM 存在代替可见 |
| 异构 shadow | 释放前图标/名称/尺寸符合合同，区别于源卡片，只有一个影像，不拦截命中；结束后消失 |
| 持久化 | 对需要保存的具体来源操作，通过确认/保存 UI，reload 后检查同一实体；overlay 保存测试不能替代 sidebar 创建保存测试 |

2026-09-07 专项运行已验证空白/蓝图 sidebar 创建、已有 row 移动、overlay 移动与跨 hub 拒绝、group handle 排序。尚未专项验证异构 shadow、全部 sidebar 来源，以及空白/蓝图新增自身的确认刷新完整链；见 playbook 的证据范围。
