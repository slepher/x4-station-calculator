# 当前测试迁移

**已按用户“快速结束任务并总结”要求停止执行。** 以下队列仅用于恢复，不会自动继续。最终交接见 [收尾总结](handoff.md)。原36合同中14项审核通过，22项未完成；另有独立TRADE-DRAG补充合同已通过。待验证源码保留，不称完整候选已通过。

基线：`d590ede41d41913ab18f5c5a18247bf956a4685a`。不启用 codex-workflow；主 agent 拆分、派发与验收。collector 使用固定模型，其余执行 agent 均为 Astra medium。原有 71 个 E2E spec 拆为 36 个独立合同；core 剩余验收另追加 3 个独立补充合同/新 spec，产品修复独立派发。Unit 初始全量另由 ENV 验证。已有用户状态、generation-4/5 与历史失败报告保留。

[collector 现状](context.md) · [环境证据](environment.md)

共享输入归属：ENV 独占 playwright.config.ts，M1.1 独占 Live helper，M5.1 独占 Logic Flow helpers；各功能独占对应 spec 与任务文档。每个运行使用独立端口、输出目录及浏览器 context。通过不依赖提交或父任务合并；本轮不提交。

规范补充裁决：Auto Sector 当前 mode spec 明确外显为「查看 / 编辑 / 重算」及「重新计算」，内部状态仍是 preview/edit/generate；不能从旧 request 文案反推 UI 应恢复「生成方案」。依据 `openspec/changes/auto-sector-group-one-binding/specs/auto-sector-group-binding-mode/spec.md:11,93`。

| 合同 | 功能验收目标 | 输入依赖 | 当前状态 |
|---|---|---|---|
| [M1.1](tasks/M1.1.md) | 有效归档选择准确绑定 GUID、时间与兼容性 | — | 审核通过，2/2；[证据](results/M1.1.md) |
| [M1.2](tasks/M1.2.md) | 绑定创建、保存、切换、删除遵守独立持久化边界 | M1.1 | 审核通过，4/4；[证据](results/M1.2.md) |
| [M2.1](tasks/M2.1.md) | 三态切换、重置与确认保持同一草案的正确保存语义 | M1.1 | 16通过；自动station变化保护未验证，未完成；[报告](results/M2.1.md) |
| [M2.1-FOCUS](tasks/M2.1-FOCUS.md) | 自动station变化确实发生时保留工作台 | 稳定共享输入 | 已派发Live后续队列 |
| [M3.1](tasks/M3.1.md) | 候选过滤、分组和 core 虚拟站操作符合独立预期 | M1.1, M2.1 | 当前15/15已通过，整体未完成：剩余有效项在补充合同；[报告](results/M3.1.md) |
| [M3.1-GRAPH](tasks/M3.1-GRAPH.md) | 独立图、MST/bridge、得分和重算边界 | 稳定共享输入 | 已派发Live后续队列，未尝试项不归过难失败 |
| [M3.1-DRAFT](tasks/M3.1-DRAFT.md) | 归属编辑、transfer、连接持久化 | 稳定共享输入 | 已派发Live后续队列 |
| [M3.1-TRADE-DRAG](tasks/M3.1-TRADE-DRAG.md) | 虚拟交易站真实拖动与恢复 | 稳定共享输入 | 审核通过，复用M3.2精确trade事务；[证据](results/M3.1-TRADE-DRAG.md) |
| [M3.2](tasks/M3.2.md) | 地图分组页签与虚拟站拖放保持 draft group 边界 | M1.1, M2.1, M3.1 | 未完成：组合11通过/2颜色产品失败，剩余细项另合同；[报告](results/M3.2.md) |
| [M3.2-UI](tasks/M3.2-UI.md) | 地图剩余focus/layer/样式与复制语义 | 稳定共享输入 | 已派发Live后续队列 |
| [M4.1](tasks/M4.1.md) | Live 总览与站点仪表盘展示正确归档和规划结果 | M1.1 | 审核通过，7/7；[报告](results/M4.1.md) |
| [M4.2](tasks/M4.2.md) | 贡献名称、缺口按钮与流向地图联动选中正确对象 | M1.1 | 审核通过，20/20；[报告](results/M4.2.md) |
| [M4.3](tasks/M4.3.md) | 站点及中转工具栏操作正确保存当前绑定 | M1.1 | 审核通过16/16；[报告](results/M4.3.md) |
| [M5.1](tasks/M5.1.md) | 拖放反馈与不兼容拒绝产生可观察且准确的结果 | — | 审核通过，8/8、稳定16/16、消费者4/4；[证据](results/M5.1.md) |
| [M5.2](tasks/M5.2.md) | 产线交互、隔离和新增行为遵循当前 lineage 与 T0 规则 | M5.1 | 审核通过：修复后49/49，Unit6/6及build通过；[报告](results/M5.2.md) |
| [M5.3](tasks/M5.3.md) | 紧凑视图和拖放演示以真实鼠标验证开始、取消和完成 | M5.1 | 未完成：合成4满足/6失败，夹具修复合同未实施；[报告](results/M5.3.md) |
| [M6.1](tasks/M6.1.md) | 逻辑方案保存、切换与导入保留生产线含义 | M5.1 | 已停止：仅baseline41通过/4失败，未迁移；[报告](results/M6.1.md) |
| [M6.2](tasks/M6.2.md) | 逻辑布局与模块显示在交互前后保持当前约定 | M5.1 | 已派发后续队列 |
| [M7.1](tasks/M7.1.md) | 帝国和站点 CRUD、导航与恢复指向正确计划 | — | 审核通过，27/27、拖放稳定21/21；[证据](results/M7.1.md) |
| [M7.2](tasks/M7.2.md) | 模块管理与设置修改规划并持久化 | — | 未完成：24通过/1原有skip，AutoSupply规范冲突；[报告](results/M7.2.md) |
| [M7.3](tasks/M7.3.md) | 站点仪表盘、资源分组及 ware flow 显示正确维度 | — | 未完成：93通过/4资源来源冲突，0skip；[报告](results/M7.3.md) |
| [M7.4](tasks/M7.4.md) | 帝国导入导出保留版本和计划内容 | — | 审核通过24/24，0skip；[报告](results/M7.4.md) |
| [M8.1](tasks/M8.1.md) | 地图导航搜索和 tooltip 定位正确星区 | — | 待派发 |
| [M8.2](tasks/M8.2.md) | 简单与高级资源筛选显示正确候选集合 | — | 待派发 |
| [M8.3](tasks/M8.3.md) | 地图 DLC 显隐与可选星区一致 | — | 待派发 |
| [M9.1](tasks/M9.1.md) | 真实文件导入和地图移动保存准确空间身份 | M1.1 | 待派发 |
| [M10.1](tasks/M10.1.md) | 选船与放弃选择保持建造面板正确状态 | — | 审核通过：修复后35/35，Unit5/5及build；[报告](results/M10.1.md) |
| [M10.2](tasks/M10.2.md) | 装备选择、预设和比较面板准确反映安装结果 | — | 未完成：修复后单次完整43通过/3布局失败，布局待裁决；[报告](results/M10.2.md) |
| [M10.3](tasks/M10.3.md) | 蓝图层级、存储和条目操作可保存恢复 | — | 未完成：组合21通过/1items滑块产品失败；[报告](results/M10.3.md) |
| [M10.4](tasks/M10.4.md) | 建材、价格和性能面板显示独立可核算结果 | — | 未完成：20通过/3产品失败，HULL/STATS修复独立派发；[报告](results/M10.4.md) |
| [M10.5](tasks/M10.5.md) | 船舶 DLC 筛选保留合法选择与回归覆盖 | — | 待派发 |
| [M11.1](tasks/M11.1.md) | 建筑流菜单和真实拖放建立、替换、移除并持久化绑定 | M1.1, M5.1 | 已派发后续队列 |
| [M12.1](tasks/M12.1.md) | 目标、舰队和方案 CRUD 经 UI 保存后正确恢复 | — | 待派发 |
| [M13.1](tasks/M13.1.md) | 预览明确区分 derived、required 与用户目标 | — | 待派发 |
| [M14.1](tasks/M14.1.md) | 显式计算、重算和详情展示尊重预览已选责任 | — | 待派发 |
| [M15.1](tasks/M15.1.md) | 统一工具栏的保存、另存和导入事务完成正确分支 | — | 审核通过：修复后46/46，原9项及M7.1消费者2/2；[报告](results/M15.1.md) |
| [M15.2](tasks/M15.2.md) | 按钮 tooltip 在触发、侧向定位与隐藏时可观察 | — | 未完成：7通过/1文案冲突失败；[报告](results/M15.2.md) |
| [M15.3](tasks/M15.3.md) | 建材 UI 组件输入与结果联动 | — | 审核通过6/6；[报告](results/M15.3.md) |
| [M15.4](tasks/M15.4.md) | sector 聚合与单站流量筛选保持各自范围 | — | 已停止：基线1通过/2失败，新推荐模块/跨区聚合语义尚待迁移 |
| [M16.1](tasks/M16.1.md) | 版本切换只保存勾选的 dirty 模块并正确隔离数据 | — | 审核通过，10/10；[证据](results/M16.1.md) |
| [M16.2](tasks/M16.2.md) | DLC 开关、设置持久化和标签显示对齐当前数据 | — | 审核通过：修复后51/51，UI Unit6/6、计算Unit4/4、消费者9/9及build通过；[报告](results/M16.2.md) |

失败仅阻塞自身及实际依赖闭包；未决或受阻验收保留，不删除、不弱化、不冒充通过。Build compute 3.3 已有多轮未达步骤开关的证据，恢复前禁止重复相同 UI 路线；M14.1 应保留失败报告，独立可达项继续验证。

主 agent 已派发后续串行队列（表中未启动项仍待执行，每项独立合同与报告，不设整队通过门槛）：

- Live agent：M4.2 → M4.3 → FIX-M3.2 → M3.2-UI → M3.1-GRAPH → M3.1-DRAFT → M2.1-FOCUS；TRADE-DRAG已有精确现行事务证据。
- Production agent：FIX-M15.1 回归 → M15.3 → M15.4 → M8.1 → M8.2 → M8.3 → M9.1。
- Ship agent：M10.2 修复回归 → FIX-M10.4-HULL → FIX-M10.4-STATS → M10.5 → M12.1 → M13.1 → M14.1。
- Logic/Fix agent：FIX-M10.3聚焦Unit完成 → M5.3 → M6.1 → M6.2 → M11.1；slider原E2E由Ship消费者在新构建后执行。

队列只控制同一执行者的工作顺序；不相关失败不阻塞后项。各项向主 agent 交回证据后才可标审核通过。
