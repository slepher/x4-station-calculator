# Test Tasks: build-ui-component

## 1 单元测试

- [✓] 1.1 组件基础渲染
  - [✓] 1.1.1 传入 `views=[materials, volume, time, workers]` 渲染组件
  - [✓] 1.1.2 断言按钮数量与顺序与 `views` 一致 #期望: [4]

- [✓] 1.2 v-model 激活态
  - [✓] 1.2.1 传入 `modelValue='materials'`
  - [✓] 1.2.2 断言 `materials` 按钮为激活态 #期望: ['materials']

- [✓] 1.3 点击更新事件
  - [✓] 1.3.1 点击 `volume` 按钮
  - [✓] 1.3.2 断言触发 `update:modelValue` 且值为 `volume` #期望: ['volume']

- [✓] 1.4 禁用态行为
  - [✓] 1.4.1 配置 `time` 为 `disabled=true`
  - [✓] 1.4.2 点击 `time` 按钮
  - [✓] 1.4.3 断言不触发 `update:modelValue` #期望: [0]

- [✓] 1.5 colorStyle 样式映射
  - [✓] 1.5.1 传入 `colorStyle='sky'` 并激活 `workers`
  - [✓] 1.5.2 断言激活态包含对应主题 class #期望: ['sky']

## 2 E2E 标准状态与状态迁移

- [✓] 2.1 状态: StationDashboard-默认视图
  - [✓] 2.1.1 打开工作台并进入 `StationDashboard`
  - [✓] 2.1.2 断言默认选中 `cost/materials` 视图 #期望: ['materials']

- [✓] 2.2 切换: materials -> volume
  - [✓] 2.2.1 在 `StationDashboard` 点击 `volume` tab
  - [✓] 2.2.2 断言标题切换为体积视图文案 #期望: ['station.header_volume']

- [✓] 2.3 切换: volume -> time
  - [✓] 2.3.1 点击 `time` tab
  - [✓] 2.3.2 断言内容列表切换为时间视图 #期望: ['time']

- [✓] 2.4 切换: time -> workers
  - [✓] 2.4.1 点击 `workers` tab
  - [✓] 2.4.2 断言 footer 切换为 workforce 控件区 #期望: ['workers']

## 3 E2E 测试场景

- [✓] 3.1 Case: Dashboard 视图切换无回归
  - [✓] 3.1.1 状态: StationDashboard-默认视图
  - [✓] 3.1.2 切换: materials -> volume
  - [✓] 3.1.3 切换: volume -> time
  - [✓] 3.1.4 切换: time -> workers
  - [✓] 3.1.5 断言每次切换均有唯一激活按钮 #期望: [1]

- [✓] 3.2 Case: data-testid 稳定可定位
  - [✓] 3.2.1 状态: StationDashboard-默认视图
  - [✓] 3.2.2 读取 tab 组件容器 testid
  - [✓] 3.2.3 逐个点击按钮 testid 并断言可触发切换 #期望: [4]

## 4 Bug 测试
