# LiveStationToolbar 测试任务

## 1 单元测试

- [✓] 1.1 Unit: initialMode computed 正确计算初始模式
  - [✓] 1.1.1 输入 hasBindingStation=true, hasSaveStation=true -> 输出 'planning' #期望: ['planning']
  - [✓] 1.1.2 输入 hasBindingStation=true, hasSaveStation=false -> 输出 'planning' #期望: ['planning']
  - [✓] 1.1.3 输入 hasBindingStation=false, hasSaveStation=true -> 输出 'live' #期望: ['live']
  - [✓] 1.1.4 输入 hasBindingStation=false, hasSaveStation=false -> 输出 'planning' (fallback) #期望: ['planning']

- [✓] 1.2 Unit: canToggle computed 正确计算切换能力
  - [✓] 1.2.1 输入 hasBindingStation=true, hasSaveStation=true -> 输出 true #期望: [true]
  - [✓] 1.2.2 输入 hasBindingStation=true, hasSaveStation=false -> 输出 false #期望: [false]
  - [✓] 1.2.3 输入 hasBindingStation=false, hasSaveStation=true -> 输出 true #期望: [true]
  - [✓] 1.2.4 输入 hasBindingStation=false, hasSaveStation=false -> 输出 false #期望: [false]

## 2 E2E 标准状态与状态迁移

## 3 E2E 测试场景

- [✓] 3.1 Case: 站点"地球人"双数据源-规划模式可切换
  - [✓] 3.1.1 加载 fixture 数据，导入存档，设置 binding，切换到 Live Production 视图，设置语言为中文
  - [✓] 3.1.2 点击星区 `小行星` supply-tab，点击站点 `地球人` station-tab，等待 toolbar 加载
  - [✓] 3.1.3 断言 `.mode-toggle-chip` 可见，CSS 类包含 `active-planning`
  - [✓] 3.1.4 断言 `.mode-toggle-chip .chip-status` 文本包含 '规划' #期望: ['规划']
  - [✓] 3.1.5 断言 `.race-select` 可见（规划控件显示） #期望: [visible]
  - [✓] 3.1.6 断言 `.mode-toggle-chip` 按钮 enabled（可切换） #期望: [enabled]

- [✓] 3.2 Case: 站点"新建空间站"仅有bindingStation-规划模式不可切换
  - [✓] 3.2.1 加载 fixture 数据，导入存档，设置 binding，切换到 Live Production 视图，设置语言为中文
  - [✓] 3.2.2 点击星区 `小行星` supply-tab，点击站点 `新建空间站` station-tab，等待 toolbar 加载
  - [✓] 3.2.3 断言 `.mode-toggle-chip` 可见，CSS 类包含 `active-planning`
  - [✓] 3.2.4 断言 `.mode-toggle-chip .chip-status` 文本包含 '规划' #期望: ['规划']
  - [✓] 3.2.5 断言 `.race-select` 可见（规划控件显示） #期望: [visible]
  - [✓] 3.2.6 断言 `.mode-toggle-chip` 按钮 disabled（不可切换） #期望: [disabled]

- [✓] 3.3 Case: 存档站点"PPW-916"仅有saveStation-实时模式可切换
  - [✓] 3.3.1 加载 fixture 数据，导入存档，设置 binding，切换到 Live Production 视图，设置语言为中文
  - [✓] 3.3.2 点击星区 `神圣眼光` supply-tab，点击存档站点 `PPW-916` station-tab，等待 toolbar 加载
  - [✓] 3.3.3 断言 `.mode-toggle-chip` 可见，CSS 类包含 `active-live`
  - [✓] 3.3.4 断言 `.mode-toggle-chip .chip-status` 文本包含 '实时' #期望: ['实时']
  - [✓] 3.3.5 断言 `.race-select` 隐藏（规划控件隐藏） #期望: [hidden]
  - [✓] 3.3.6 断言 `.mode-toggle-chip` 按钮 enabled（可切换） #期望: [enabled]

- [✓] 3.4 Case: 模式切换交互-点击按钮可切换状态
  - [✓] 3.4.1 加载 fixture 数据，导入存档，设置 binding，切换到 Live Production 视图，设置语言为中文
  - [✓] 3.4.2 点击星区 `小行星` supply-tab，点击站点 `地球人` station-tab，等待 toolbar 加载
  - [✓] 3.4.3 断言初始状态为规划模式，`.mode-toggle-chip` CSS 类包含 `active-planning`
  - [✓] 3.4.4 点击 `.mode-toggle-chip` 按钮，等待 300ms
  - [✓] 3.4.5 断言切换后状态为实时模式，`.mode-toggle-chip` CSS 类包含 `active-live` #期望: ['实时']
  - [✓] 3.4.6 断言 `.race-select` 隐藏（规划控件隐藏） #期望: [hidden]
  - [✓] 3.4.7 再次点击 `.mode-toggle-chip` 按钮，等待 300ms
  - [✓] 3.4.8 断言切换回规划模式，`.mode-toggle-chip` CSS 类包含 `active-planning` #期望: ['规划']
  - [✓] 3.4.9 断言 `.race-select` 可见（规划控件显示） #期望: [visible]

- [✓] 3.5 Case: Toolbar布局结构正确展示各字段
  - [✓] 3.5.1 加载 fixture 数据，导入存档，设置 binding，切换到 Live Production 视图，设置语言为中文
  - [✓] 3.5.2 点击星区 `小行星` supply-tab，点击站点 `地球人` station-tab，等待 toolbar 加载
  - [✓] 3.5.3 断言 `.mode-toggle-chip` 可见（模式切换按钮）
  - [✓] 3.5.4 断言 `.readonly-pill` 可见且包含站点编码文本（编码字段）
  - [✓] 3.5.5 断言星区字段区域可见（点击可触发 popover）
  - [✓] 3.5.6 断言光伏效率 `.count-pill` 可见且显示百分比数值
  - [✓] 3.5.7 断言 `.race-select` 可见（偏好种族下拉） #期望: [visible]

- [✓] 3.6 Case: 星区字段点击弹出坐标popover
  - [✓] 3.6.1 加载 fixture 数据，导入存档，设置 binding，切换到 Live Production 视图，设置语言为中文
  - [✓] 3.6.2 点击星区 `神圣眼光` supply-tab，点击存档站点 `PPW-916` station-tab，等待 toolbar 加载
  - [✓] 3.6.3 点击星区字段区域，触发 popover 显示
  - [✓] 3.6.4 断言 `.sector-popover` 可见
  - [✓] 3.6.5 断言 popover 内容包含坐标文本格式 #期望: ['坐标']

- [✓] 3.7 Case: 星区资源popover展示resources列表
  - [✓] 3.7.1 加载 fixture 数据，导入存档，设置 binding，切换到 Live Production 视图，设置语言为中文
  - [✓] 3.7.2 选择有资源的站点，等待 toolbar 加载
  - [✓] 3.7.3 点击星区资源字段区域，触发 popover 显示
  - [✓] 3.7.4 断言 `.resources-popover` 可见
  - [✓] 3.7.5 断言 popover 内 `.resource-item` 元素存在（资源列表展示） #期望: [资源列表]

- [✓] 3.8 Case: 规划模式下控件可编辑
  - [✓] 3.8.1 加载 fixture 数据，导入存档，设置 binding，切换到 Live Production 视图，设置语言为中文
  - [✓] 3.8.2 点击星区 `小行星` supply-tab，点击站点 `地球人` station-tab，等待 toolbar 加载
  - [✓] 3.8.3 断言 `.race-select` 可见且可交互（偏好种族下拉）
  - [✓] 3.8.4 断言 workforce toggle-chip 可见且可点击（工人运算开关）
  - [✓] 3.8.5 断言显示缺口 toggle-chip 可见且可点击
  - [✓] 3.8.6 点击 workforce toggle-chip，断言状态切换 #期望: [ON/OFF切换]

- [✓] 3.9 Case: 实时模式下规划控件隐藏
  - [✓] 3.9.1 加载 fixture 数据，导入存档，设置 binding，切换到 Live Production 视图，设置语言为中文
  - [✓] 3.9.2 点击星区 `神圣眼光` supply-tab，点击存档站点 `PPW-916` station-tab，等待 toolbar 加载
  - [✓] 3.9.3 断言 `.race-select` 隐藏（偏好种族下拉隐藏） #期望: [hidden]
  - [✓] 3.9.4 断言 workforce toggle-chip 隐藏（工人运算开关隐藏） #期望: [hidden]
  - [✓] 3.9.5 断言显示缺口 toggle-chip 隐藏 #期望: [hidden]

## 4 Bug 测试
