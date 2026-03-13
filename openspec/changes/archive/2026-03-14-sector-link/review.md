# Review Notes

## Station vs Transit 数据层厚薄分析结论

- 现状不是 `Station` 页面过薄，而是 `TransitHubWorkbench` 承担了过多本应在 store/logic 层完成的数据拼装。
- `ProductionWorkbenchView` 作为页面编排层保持轻量是合理的；`Station` 三块（规划/流向/仪表盘）的计算主要已下沉到 `useStationStore` 与 `StationStateMap`，分层相对健康。
- `TransitHubWorkbench` 当前同时负责：
  - 跨星区流量拼装（solver 输出映射到视图数据）
  - 仓储/运输口径聚合与排序
  - 外部星区明细注入
  - 仓储模块与泊位需求推导
  造成组件业务厚度明显高于 `Station` 对应容器。

## 可调整方向（优先级顺序）

1. 在 store/logic 新增 Transit 专用 selector/view-model 构建函数（如 `buildTransitHubViewModel`），统一返回 `groupedFlows / storageFlows / transportFlows / storageModulePlans`。
2. `useEmpireStore` 暴露稳定入口（如 `getTransitHubViewModel(sectorId)`），容器组件只消费结果并分发给子组件。
3. 抽离并复用公共规则：产物排序、明细排序、文案映射、过滤口径，避免 Station/Transit 两套规则漂移。
4. 移除组件硬编码（如 `12h`、magic number、临时 `any`），改为配置常量或 typed selector 输入。
5. 保持 `TransitHubCenterDashboard` / `TransitHubBuildPanel` 纯展示化，`TransitHubWorkbench` 收敛为薄容器。

## 目标分层

- 页面层：只处理布局与 tab 路由切换。
- 容器层：只做参数透传与状态组合。
- 逻辑层（store/selector）：负责跨星区计算、过滤、排序、聚合。
- 展示层：仅渲染，不再承担业务推导。
