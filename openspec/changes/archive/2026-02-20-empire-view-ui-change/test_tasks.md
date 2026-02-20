## Unit Tests

- [x] Empire 标题渲染测试
  - **目标**: 验证帝国总览中资源/经济视图标题分别显示 `资源视图`、`经济视图`
  - **步骤**:
    1. 渲染 `EmpireWareFlowsDashboard`
    2. 切换至数量视图并断言标题文本
    3. 切换至经济视图并断言标题文本
    4. 断言头部不包含 `hourly_rate` 标签元素
  - **Bug现状**: 当前标题文案不统一，且仍显示“每小时流量”标签
  - **期待结果**: 两种视图标题文案统一，标签移除

- [x] Station 标题渲染测试
  - **目标**: 验证空间站资源区域中资源/经济视图标题分别显示 `资源视图`、`经济视图`
  - **步骤**:
    1. 渲染 `StationWareFlowsDashboard`
    2. 切换至数量视图并断言标题文本
    3. 切换至经济视图并断言标题文本
    4. 断言头部不包含 `hourly_rate` 标签元素
  - **Bug现状**: 当前标题文案不统一且有“每小时流量”标签
  - **期待结果**: 标题文案正确且标签移除

- [x] Empire 明细站点数量三段式渲染测试
  - **目标**: 验证 `EmpireWareFlow` 明细行使用“数量 + x + 名称”结构，且类名与 `StationWareFlow.vue` 对齐
  - **步骤**:
    1. 传入包含 `stationCount` 的明细数据渲染 `EmpireWareFlow`
    2. 查询 `.item-name .qty`、`.item-name .symbol`、`.item-name .name`
    3. 断言展示顺序与内容正确
    4. 分别覆盖 `stationCount = 1` 与 `stationCount > 1`
  - **Bug现状**: 当前为字符串拼接格式，样式与 `StationWareFlow.vue` 不一致
  - **期待结果**: 明细结构与样式类名对齐，展示一致

## Web Integration Tests

- [x] 帝国总览去标签与标题后缀验证
  - **目标**: 在真实页面验证帝国总览头部不显示“每小时流量”，且资源/经济标题分别显示 `资源视图`、`经济视图`
  - **步骤**:
    1. 进入帝国总览
    2. 切换资源视图，断言标题文本
    3. 切换经济视图，断言标题文本
    4. 断言 `.header-badge` 不存在或不含“每小时流量/Hourly Rate”
  - **Bug现状**: 线上行为仍依赖“每小时流量”角标
  - **期待结果**: 标题文案正确，角标不显示

- [x] 空间站帝国资源区域去标签与标题后缀验证
  - **目标**: 在空间站界面开启帝国缺口后，验证头部同样不显示“每小时流量”且标题文案正确
  - **步骤**:
    1. 进入空间站视图并开启“显示缺口”
    2. 切换资源视图断言标题 `资源视图`
    3. 切换经济视图断言标题 `经济视图`
    4. 断言 `.header-badge` 不存在或不含目标文案
  - **Bug现状**: 当前头部仍存在“每小时流量”标签
  - **期待结果**: 与帝国总览保持一致

- [x] 帝国明细站点数量样式一致性验证
  - **目标**: 验证帝国总览与空间站缺口明细中的站点行，均采用与 `StationWareFlow.vue` 一致的“数量 + x + 名称”视觉结构
  - **步骤**:
    1. 准备可展开明细的帝国资源项
    2. 在帝国总览展开明细并断言 `.item-name .qty/.symbol/.name`
    3. 在空间站帝国缺口分组展开明细并断言同样结构
    4. 比较 `symbol` 文本为 `x`，并校验样式类存在
  - **Bug现状**: 当前明细使用字符串拼接 `(xN)`，与站内资源明细风格不一致
  - **期待结果**: 两处帝国明细均与 `StationWareFlow.vue` 一致

## 验证执行记录 (2026-02-20)

- Unit:
  - `npm run test:unit -- tests/unit/empire-view-ui-change/empire-view-ui-change.spec.ts`
  - 结果：3 passed, 0 failed
- E2E:
  - `npx playwright test tests/e2e/empire-view-ui-change/ui-change.spec.ts`
  - 结果：3 passed, 0 failed
