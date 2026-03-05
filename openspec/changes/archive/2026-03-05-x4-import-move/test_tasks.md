# x4-import-move 测试任务

## 1 单元测试

- [✓] 1.1 顶部视图切换组件支持 production/flow/ship-build 切换
  - [✓] 1.1.1 挂载 `TopViewSwitch` 默认三按钮视图
  - [✓] 1.1.2 依次点击 `top-view-btn-flow` 与 `top-view-btn-ship-build`
  - [✓] 1.1.3 断言 `update:modelValue` 依次发出 `flow`、`ship-build` #期望: ['flow', 'ship-build']

- [✓] 1.2 ImportPlanModal 采用统一 3-tab 导入视图
  - [✓] 1.2.1 挂载 `ImportPlanModal` 并设置 `initialTab=game-blueprint`
  - [✓] 1.2.2 断言 3 个导入 tab 按钮均可见
  - [✓] 1.2.3 切换到 `x4-station` 后断言可见 `import-x4-station-input`，再切换到 `logic-flow` 后断言可见 `logicflow-import-body` #期望: ['import-x4-station-input', 'logicflow-import-body']

- [✓] 1.3 logic-flow tab 内嵌主体固定为站点模式壳层
  - [✓] 1.3.1 挂载 `ImportPlanModal`（固定前置：`activeStationId` 非空）并切换到 `logic-flow` tab
  - [✓] 1.3.2 断言渲染 `logicflow-import-body` 内嵌主体
  - [✓] 1.3.3 断言可见 `logicflow-import-body[data-mode="station"]` 站点模式壳层 #期望: ['logicflow-import-body[data-mode="station"]']

- [✓] 1.4 x4-station 字符串拒绝 JSON 输入
  - [✓] 1.4.1 挂载 `ImportPlanModal` 并切换到 `x4-station` tab
  - [✓] 1.4.2 输入 JSON 字符串并执行导入
  - [✓] 1.4.3 断言显示错误文案节点 `importView.x4_station_failed`（或等价稳定定位） #期望: ['importView.x4_station_failed']

- [✓] 1.5 x4-station 非法输入不输出 console error
  - [✓] 1.5.1 挂载 `ImportPlanModal` 并切换到 `x4-station` tab
  - [✓] 1.5.2 输入 JSON 字符串执行导入并监听 `console.error`
  - [✓] 1.5.3 断言仅展示错误提示且未触发 `console.error` #期望: [true]

- [ ] 1.6 非空站点下三 tab 导入统一进入策略弹窗
  - [ ] 1.6.1 挂载 `ImportPlanModal` 并注入包含模块的当前站点数据
  - [ ] 1.6.2 依次切换 `logic-flow`、`game-blueprint`、`x4-station` tab 并执行 `import-view-action-import`
  - [ ] 1.6.3 断言三次导入均显示 `blueprint-import-strategy-modal`，且可见 `blueprint-strategy-cancel`、`blueprint-strategy-overwrite`、`blueprint-strategy-add`、`blueprint-strategy-new` #期望: ['blueprint-strategy-cancel', 'blueprint-strategy-overwrite', 'blueprint-strategy-add', 'blueprint-strategy-new']

## 2 E2E 标准状态与状态迁移

## 3 E2E 测试场景

- [✓] 3.1 Case: StationToolbar Import 打开 storage-import 向导
  - [✓] 3.1.1 点击 StationToolbar `Import` 按钮并打开 `storage-import-wizard`
  - [✓] 3.1.2 上传合法导入文件后断言 Empire/Flow/Ship 三个模块复选项存在
  - [✓] 3.1.3 断言覆盖/增量模式切换可见且不显示 `import-view-modal` #期望: [true]

- [✓] 3.2 Case: ContextToolbar logic-flow 入口按当前页面自动判定导入目标
  - [✓] 3.2.1 站点页点击 `logicflow-import-entry-station` 后显示 `logicflow-import-group-list`
  - [✓] 3.2.2 帝国总览点击 `logicflow-import-entry-empire` 后显示 `logicflow-import-plan-list`
  - [✓] 3.2.3 两种入口均进入统一 `import-view-modal` #期望: [true]

- [✓] 3.3 Case: 游戏蓝图上传后展示模块数且在非空站点弹策略弹窗
  - [✓] 3.3.1 在站点页通过 ContextToolbar 入口打开 `import-view-modal` 并切到 game-blueprint tab
  - [✓] 3.3.2 断言 `import-blueprint-module-count` 显示模块总数 `2`
  - [✓] 3.3.3 点击导入后弹出 `blueprint-import-strategy-modal` 且显示取消/覆盖/添加/新空间站四按钮 #期望: [true]

- [✓] 3.4 Case: x4-station 在帝国总览导入时新建默认命名空间站
  - [✓] 3.4.1 点击 `.overview-tab` 并断言 `.overview-tab.active` 可见后，再通过 `logicflow-import-entry-empire` 打开 `import-view-modal` #期望: [true]
  - [✓] 3.4.2 记录导入前 `.station-tab[data-station-id]` 数量为 `N`，切换到 `x4-station` tab，输入 "https://x4-game.com/#/station-calculator?l=@$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_energycells_01,count:1;,$module-module_par_prod_sojahusk_01,count:1" 并执行导入
  - [✓] 3.4.3 断言导入后 `import-view-modal` 不可见，且 `.station-tab[data-station-id]` 数量从 `N` 变为 `N+1` #期望: ['N+1']
  - [✓] 3.4.4 断言当前激活标签 `.station-tab.active .tab-label` 文案为 `新建空间站` #期望: ['新建空间站']
  - [✓] 3.4.5 断言站点标签区可见且 `.overview-tab.active` 不可见（已从帝国总览切回新建站点） #期望: [true]

- [ ] 3.5 Case: 非空站点在 logic-flow tab 点击导入进入统一策略弹窗
  - [ ] 3.5.1 在站点页通过 `logicflow-import-entry-station` 打开 `import-view-modal` 并保持当前站点非空
  - [ ] 3.5.2 切换到 `logic-flow` tab 后执行 `import-view-action-import`
  - [ ] 3.5.3 断言显示 `blueprint-import-strategy-modal`，且可见 `blueprint-strategy-cancel`、`blueprint-strategy-overwrite`、`blueprint-strategy-add`、`blueprint-strategy-new` #期望: ['blueprint-strategy-cancel', 'blueprint-strategy-overwrite', 'blueprint-strategy-add', 'blueprint-strategy-new']

- [ ] 3.6 Case: 非空站点在 x4-station tab 点击导入进入统一策略弹窗
  - [ ] 3.6.1 在站点页通过 `logicflow-import-entry-station` 打开 `import-view-modal` 并切换到 `x4-station` tab
  - [ ] 3.6.2 输入 "https://x4-game.com/#/station-calculator?l=@$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_energycells_01,count:1;,$module-module_par_prod_sojahusk_01,count:1" 后执行 `import-view-action-import`
  - [ ] 3.6.3 断言显示 `blueprint-import-strategy-modal`，且可见 `blueprint-strategy-cancel`、`blueprint-strategy-overwrite`、`blueprint-strategy-add`、`blueprint-strategy-new` #期望: ['blueprint-strategy-cancel', 'blueprint-strategy-overwrite', 'blueprint-strategy-add', 'blueprint-strategy-new']

## 4 Bug 测试
