# x4-import-move 测试任务

## 1 单元测试

- [✓] 1.1 顶部视图切换组件支持 production/flow/ship-build 切换
  - [✓] 1.1.1 挂载 `TopViewSwitch` 默认三按钮视图
  - [✓] 1.1.2 依次点击 `top-view-btn-flow` 与 `top-view-btn-ship-build`
  - [✓] 1.1.3 断言 `update:modelValue` 依次发出 `flow`、`ship-build` #期望: ['flow', 'ship-build']

- [✓] 1.2 ImportPlanModal 采用统一 3-tab 导入视图
  - [✓] 1.2.1 挂载 `ImportPlanModal` 并设置 `initialTab=game-blueprint`
  - [✓] 1.2.2 断言 3 个导入 tab 按钮均可见
  - [✓] 1.2.3 切换到 `x4-station` 与 `logic-flow` 后分别渲染输入框和内嵌主体 #期望: [true]

- [✓] 1.3 logic-flow tab 内嵌主体透传导入模式
  - [✓] 1.3.1 挂载 `ImportPlanModal` 并切换到 `logic-flow` tab
  - [✓] 1.3.2 断言渲染 `logicflow-import-body` 内嵌主体
  - [✓] 1.3.3 断言内嵌主体收到 `mode` 属性且值属于 `station|empire` #期望: [true]

- [✓] 1.4 x4-station 字符串拒绝 JSON 输入
  - [✓] 1.4.1 挂载 `ImportPlanModal` 并切换到 `x4-station` tab
  - [✓] 1.4.2 输入 JSON 字符串并执行导入
  - [✓] 1.4.3 断言错误提示显示 #期望: [true]

- [✓] 1.5 x4-station 非法输入不输出 console error
  - [✓] 1.5.1 挂载 `ImportPlanModal` 并切换到 `x4-station` tab
  - [✓] 1.5.2 输入 JSON 字符串执行导入并监听 `console.error`
  - [✓] 1.5.3 断言仅展示错误提示且未触发 `console.error` #期望: [true]

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
  - [✓] 3.3.3 点击导入后弹出 `blueprint-import-strategy-modal` 且包含覆盖/添加/新空间站按钮 #期望: [true]

- [✓] 3.4 Case: x4-station 在帝国总览导入时新建默认命名空间站
  - [✓] 3.4.1 在帝国总览打开导入视图并切换到 `x4-station` tab
  - [✓] 3.4.2 输入 "https://x4-game.com/#/station-calculator?l=@$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_energycells_01,count:1;,$module-module_par_prod_sojahusk_01,count:1" 并执行导入
  - [✓] 3.4.3 断言新建空间站 `modules` 字段存在且至少包含 1 项 #期望: [1]
  - [✓] 3.4.4 断言新建空间站 `type=industrial` 且 `count=1` #期望: ['industrial', 1]
  - [✓] 3.4.5 断言空间站数量增加且新建站名为 `新建空间站` #期望: ['新建空间站']

## 4 Bug 测试
