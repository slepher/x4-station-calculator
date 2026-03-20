# Test Tasks: dlc-setting

## 1 单元测试

- [ ] 1.1 setting storage key 生成规则校验
  - [ ] 1.1.1 断言 `versions.json` 中显式包含 `setting` storage key 配置 #期望：['true']
  - [ ] 1.1.2 断言 `getStorageKey('setting', '8.0')` 返回基础 key（默认版本不带后缀） #期望：['true']
  - [ ] 1.1.3 断言 `getStorageKey('setting', '8.0-beta')` 返回带 beta 后缀的 key #期望：['true']

- [ ] 1.2 DLC 候选过滤逻辑校验
  - [ ] 1.2.1 断言 `filterAvailableDlcs()` 只返回 `dependencyVersion <= currentVersion` 的 DLC #期望：['true']
  - [ ] 1.2.2 断言 `filterAvailableDlcs()` 返回结果不包含 `base` #期望：['true']
  - [ ] 1.2.3 断言当 `dependencyVersion = 9.0` 时，在 8.0 版本下该 DLC 不在候选列表中 #期望：['true']

- [ ] 1.3 默认激活 fallback 逻辑校验
  - [ ] 1.3.1 断言当 setting 中不存在 `activeDlcs` 字段时，`activeDlcs` 返回全部可用 DLC #期望：['true']
  - [ ] 1.3.2 断言当 setting 中 `activeDlcs` 字段存在但为空数组时，`activeDlcs` 返回空数组 #期望：['true']
  - [ ] 1.3.3 断言默认 fallback 不触发 localStorage 写操作 #期望：['true']

- [ ] 1.4 needsDlcSetup 状态校验
  - [ ] 1.4.1 断言当 setting 中不存在 `activeDlcs` 字段时，`needsDlcSetup` 为 true #期望：['true']
  - [ ] 1.4.2 断言当 setting 中存在 `activeDlcs` 字段（含空数组）时，`needsDlcSetup` 为 false #期望：['true']

- [ ] 1.5 enforceDlcActivation 默认值校验
  - [ ] 1.5.1 断言当 setting 中不存在 `enforceDlcActivation` 字段时，默认返回 false #期望：['true']
  - [ ] 1.5.2 断言保存 `enforceDlcActivation = true` 后读取值为 true #期望：['true']

- [ ] 1.6 DLC 激活判断 helper 校验
  - [ ] 1.6.1 断言 `isDlcActive(dlcTag)` 在 DLC 已激活时返回 true #期望：['true']
  - [ ] 1.6.2 断言 `isDlcActive(dlcTag)` 在 DLC 未激活时返回 false #期望：['true']
  - [ ] 1.6.3 断言当 `activeDlcs` 缺失时，`isDlcActive()` 对所有可用 DLC 返回 true #期望：['true']

- [ ] 1.7 DLC 过滤 helper 校验
  - [ ] 1.7.1 断言 `filterActiveDlcItems(items)` 只返回激活 DLC 对应的物品 #期望：['true']
  - [ ] 1.7.2 断言当 `enforceDlcActivation = false` 时，`filterActiveDlcItems()` 返回全部物品 #期望：['true']

- [ ] 1.8 setting 保存逻辑校验
  - [ ] 1.8.1 断言保存操作同时写入 `activeDlcs` 和 `enforceDlcActivation` #期望：['true']
  - [ ] 1.8.2 断言保存后 `needsDlcSetup` 自动置为 false #期望：['true']
  - [ ] 1.8.3 断言保存操作使用统一的版本分流 storage key #期望：['true']

- [ ] 1.9 红点状态逻辑校验
  - [ ] 1.9.1 断言红点显示条件与 `needsDlcSetup` 状态一致 #期望：['true']
  - [ ] 1.9.2 断言 `activeDlcs` 为空数组时不显示红点 #期望：['true']

## 2 E2E 标准状态与状态迁移

- [ ] 2.1 状态：DLC Setting 初始态
  - [ ] 2.1.1 状态定义：应用加载完成，尚未打开 setting modal
  - [ ] 2.1.2 前提：setting 按钮位于右上角
  - [ ] 2.1.3 前提：红点指示器依附于 setting 按钮
  - [ ] 2.1.4 断言右上角 setting 按钮可见 #期望：['true']
  - [ ] 2.1.5 断言当 `needsDlcSetup = true` 时，setting 按钮显示红点 #期望：['true']
  - [ ] 2.1.6 断言当 `needsDlcSetup = false` 时，setting 按钮不显示红点 #期望：['true']

- [ ] 2.2 状态：DLC Setting Modal 打开态
  - [ ] 2.2.1 状态定义：用户点击 setting 按钮后 modal 已打开
  - [ ] 2.2.2 前提：modal 覆盖于主界面之上
  - [ ] 2.2.3 前提：DLC checkbox 列表显示于 modal 内容区
  - [ ] 2.2.4 断言 modal 标题可见 #期望：['true']
  - [ ] 2.2.5 断言 DLC checkbox 列表可见 #期望：['true']
  - [ ] 2.2.6 断言"全选"按钮可见 #期望：['true']
  - [ ] 2.2.7 断言"全不选"按钮可见 #期望：['true']
  - [ ] 2.2.8 断言"未激活 DLC 物品处理策略"开关可见 #期望：['true']
  - [ ] 2.2.9 断言策略开关下说明文字可见 #期望：['true']
  - [ ] 2.2.10 断言 modal 关闭按钮可见 #期望：['true']
  - [ ] 2.2.11 断言点击遮罩可关闭 modal #期望：['true']

- [ ] 2.3 切换：从初始态 -> Modal 打开态
  - [ ] 2.3.1 切换定义：用户点击右上角 setting 按钮
  - [ ] 2.3.2 动作：点击右上角 setting 按钮
  - [ ] 2.3.3 断言 modal 在 1s 内可见 #期望：['true']

- [ ] 2.4 切换：从 Modal 打开态 -> 初始态（关闭按钮）
  - [ ] 2.4.1 切换定义：用户点击 modal 关闭按钮
  - [ ] 2.4.2 动作：点击 modal 关闭按钮
  - [ ] 2.4.3 断言 modal 在 1s 内不可见 #期望：['true']
  - [ ] 2.4.4 断言关闭操作不触发保存 #期望：['true']

- [ ] 2.5 切换：从 Modal 打开态 -> 初始态（遮罩）
  - [ ] 2.5.1 切换定义：用户点击 modal 遮罩区域
  - [ ] 2.5.2 动作：点击 modal 遮罩区域
  - [ ] 2.5.3 断言 modal 在 1s 内不可见 #期望：['true']
  - [ ] 2.5.4 断言关闭操作不触发保存 #期望：['true']

- [ ] 2.6 切换：从 Modal 打开态 -> Modal 打开态（全选）
  - [ ] 2.6.1 切换定义：在 Modal 打开态下点击"全选"按钮
  - [ ] 2.6.2 动作：点击"全选"按钮
  - [ ] 2.6.3 断言所有 DLC checkbox 均被勾选 #期望：['true']

- [ ] 2.7 切换：从 Modal 打开态 -> Modal 打开态（全不选）
  - [ ] 2.7.1 切换定义：在 Modal 打开态下点击"全不选"按钮
  - [ ] 2.7.2 动作：点击"全不选"按钮
  - [ ] 2.7.3 断言所有 DLC checkbox 均未被勾选 #期望：['true']

- [ ] 2.8 切换：从 Modal 打开态 -> Modal 打开态（切换单个 DLC）
  - [ ] 2.8.1 切换定义：在 Modal 打开态下点击单个 checkbox
  - [ ] 2.8.2 动作：点击单个 DLC checkbox
  - [ ] 2.8.3 断言该 checkbox 状态反转 #期望：['true']

- [ ] 2.9 切换：从 Modal 打开态 -> Modal 打开态（切换策略开关）
  - [ ] 2.9.1 切换定义：在 Modal 打开态下点击策略开关
  - [ ] 2.9.2 动作：点击策略开关
  - [ ] 2.9.3 断言开关状态反转 #期望：['true']

- [ ] 2.10 切换：从 Modal 打开态 -> 初始态（保存）
  - [ ] 2.10.1 切换定义：在 Modal 打开态下点击保存按钮
  - [ ] 2.10.2 动作：点击保存按钮
  - [ ] 2.10.3 断言 modal 关闭 #期望：['true']
  - [ ] 2.10.4 断言 setting 按钮红点消失（如之前存在） #期望：['true']

## 3 E2E 测试场景

- [✓] 3.1 Case: 红点提示显示
  - [✓] 3.1.1 状态：DLC Setting 初始态
  - [✓] 3.1.2 前提：当前版本 setting 中不存在 `activeDlcs` 字段
  - [✓] 3.1.3 断言 setting 按钮显示红点 #期望：['true']

- [✓] 3.2 Case: 红点提示消失
  - [✓] 3.2.1 状态：DLC Setting 初始态
  - [✓] 3.2.2 前提：当前版本 setting 中已存在 `activeDlcs` 字段
  - [✓] 3.2.3 断言 setting 按钮不显示红点 #期望：['true']

- [✓] 3.3 Case: 打开 Modal 显示 DLC 列表
  - [✓] 3.3.1 状态：DLC Setting 初始态
  - [✓] 3.3.2 切换：从初始态 -> Modal 打开态
  - [✓] 3.3.3 断言 DLC checkbox 列表可见 #期望：['true']
  - [✓] 3.3.4 断言列表中不包含 `base` 项 #期望：['true']
  - [✓] 3.3.5 断言列表中 DLC 名称已通过 i18n 翻译显示 #期望：['true']

- [✓] 3.4 Case: DLC 列表版本过滤
  - [✓] 3.4.1 状态：DLC Setting Modal 打开态
  - [✓] 3.4.2 断言列表中只显示 `dependencyVersion <= currentVersion` 的 DLC #期望：['true']
  - [✓] 3.4.3 断言 `dependencyVersion = 9.0` 的 DLC 不在 8.0 版本列表中显示 #期望：['true']

- [✓] 3.5 Case: 全选操作
  - [✓] 3.5.1 状态：DLC Setting Modal 打开态
  - [✓] 3.5.2 前提：存在至少一个未勾选的 DLC
  - [✓] 3.5.3 切换：从 Modal 打开态 -> Modal 打开态（全选）
  - [✓] 3.5.4 断言所有 DLC checkbox 均被勾选 #期望：['true']

- [✓] 3.6 Case: 全选后保存
  - [✓] 3.6.1 状态：DLC Setting Modal 打开态
  - [✓] 3.6.2 前提：存在至少一个未勾选的 DLC
  - [✓] 3.6.3 切换：从 Modal 打开态 -> Modal 打开态（全选）
  - [✓] 3.6.4 切换：从 Modal 打开态 -> 初始态（保存）
  - [✓] 3.6.5 断言保存后所有 DLC 均处于激活状态 #期望：['true']

- [✓] 3.7 Case: 全不选操作
  - [✓] 3.7.1 状态：DLC Setting Modal 打开态
  - [✓] 3.7.2 前提：存在至少一个已勾选的 DLC
  - [✓] 3.7.3 切换：从 Modal 打开态 -> Modal 打开态（全不选）
  - [✓] 3.7.4 断言所有 DLC checkbox 均未被勾选 #期望：['true']

- [✓] 3.8 Case: 全不选后保存
  - [✓] 3.8.1 状态：DLC Setting Modal 打开态
  - [✓] 3.8.2 前提：存在至少一个已勾选的 DLC
  - [✓] 3.8.3 切换：从 Modal 打开态 -> Modal 打开态（全不选）
  - [✓] 3.8.4 切换：从 Modal 打开态 -> 初始态（保存）
  - [✓] 3.8.5 断言保存后所有 DLC 均处于未激活状态 #期望：['true']

- [✓] 3.9 Case: 切换单个 DLC 状态
  - [✓] 3.9.1 状态：DLC Setting Modal 打开态
  - [✓] 3.9.2 前提：存在至少一个 DLC
  - [✓] 3.9.3 切换：从 Modal 打开态 -> Modal 打开态（切换单个 DLC）
  - [✓] 3.9.4 断言该 DLC checkbox 状态反转 #期望：['true']

- [✓] 3.10 Case: 切换单个 DLC 后保存
  - [✓] 3.10.1 状态：DLC Setting Modal 打开态
  - [✓] 3.10.2 前提：存在至少一个 DLC
  - [✓] 3.10.3 切换：从 Modal 打开态 -> Modal 打开态（切换单个 DLC）
  - [✓] 3.10.4 切换：从 Modal 打开态 -> 初始态（保存）
  - [✓] 3.10.5 断言保存后该 DLC 激活状态与选择一致 #期望：['true']

- [✓] 3.11 Case: 保存 DLC 选择
  - [✓] 3.11.1 状态：DLC Setting Modal 打开态
  - [✓] 3.11.2 前提：已勾选至少一个 DLC
  - [✓] 3.11.3 切换：从 Modal 打开态 -> 初始态（保存）
  - [✓] 3.11.4 断言 modal 关闭 #期望：['true']
  - [✓] 3.11.5 断言 setting 按钮红点消失 #期望：['true']
  - [✓] 3.11.6 断言 localStorage 中 `activeDlcs` 已更新 #期望：['true']

- [✓] 3.12 Case: 关闭 Modal 不保存（关闭按钮）
  - [✓] 3.12.1 状态：DLC Setting Modal 打开态
  - [✓] 3.12.2 前提：已修改 DLC 选择但未保存
  - [✓] 3.12.3 切换：从 Modal 打开态 -> 初始态（关闭按钮）
  - [✓] 3.12.4 断言再次打开 Modal 后 DLC 选择恢复为保存前的状态 #期望：['true']

- [✓] 3.13 Case: 关闭 Modal 不保存（关闭按钮）- 未修改状态
  - [✓] 3.13.1 状态：DLC Setting Modal 打开态
  - [✓] 3.13.2 前提：未修改 DLC 选择
  - [✓] 3.13.3 切换：从 Modal 打开态 -> 初始态（关闭按钮）
  - [✓] 3.13.4 断言关闭操作不触发 localStorage 写操作 #期望：['true']

- [✓] 3.14 Case: 关闭 Modal 不保存（遮罩）
  - [✓] 3.14.1 状态：DLC Setting Modal 打开态
  - [✓] 3.14.2 前提：已修改 DLC 选择但未保存
  - [✓] 3.14.3 切换：从 Modal 打开态 -> 初始态（遮罩）
  - [✓] 3.14.4 断言再次打开 Modal 后 DLC 选择恢复为保存前的状态 #期望：['true']

- [✓] 3.15 Case: 关闭 Modal 不保存（遮罩）- 未修改状态
  - [✓] 3.15.1 状态：DLC Setting Modal 打开态
  - [✓] 3.15.2 前提：未修改 DLC 选择
  - [✓] 3.15.3 切换：从 Modal 打开态 -> 初始态（遮罩）
  - [✓] 3.15.4 断言关闭操作不触发 localStorage 写操作 #期望：['true']

- [✓] 3.16 Case: 未激活 DLC 处理策略保存
  - [✓] 3.16.1 状态：DLC Setting Modal 打开态
  - [✓] 3.16.2 前提：`enforceDlcActivation` 初始为 false
  - [✓] 3.16.3 切换：从 Modal 打开态 -> Modal 打开态（切换策略开关）
  - [✓] 3.16.4 切换：从 Modal 打开态 -> 初始态（保存）
  - [✓] 3.16.5 断言 localStorage 中 `enforceDlcActivation` 为 true #期望：['true']

- [✓] 3.17 Case: 未激活 DLC 处理策略关闭
  - [✓] 3.17.1 状态：DLC Setting Modal 打开态
  - [✓] 3.17.2 前提：`enforceDlcActivation` 初始为 true
  - [✓] 3.17.3 切换：从 Modal 打开态 -> Modal 打开态（切换策略开关）
  - [✓] 3.17.4 断言策略开关状态反转 #期望：['true']

- [✓] 3.18 Case: 策略开关说明文字显示
  - [✓] 3.18.1 状态：DLC Setting Modal 打开态
  - [✓] 3.18.2 断言策略开关下方存在说明文字 #期望：['true']
  - [✓] 3.18.3 断言说明文字包含"搜索列表"相关描述 #期望：['true']
  - [✓] 3.18.4 断言说明文字包含"已保存项"相关描述 #期望：['true']

- [✓] 3.19 Case: 默认全激活 fallback
  - [✓] 3.19.1 状态：DLC Setting 初始态
  - [✓] 3.19.2 前提：当前版本 setting 中不存在 `activeDlcs` 字段
  - [✓] 3.19.3 切换：从初始态 -> Modal 打开态
  - [✓] 3.19.4 断言所有可用 DLC checkbox 默认勾选 #期望：['true']

- [✓] 3.20 Case: 空数组不视为未设置
  - [✓] 3.20.1 状态：DLC Setting 初始态
  - [✓] 3.20.2 前提：当前版本 setting 中 `activeDlcs` 为空数组
  - [✓] 3.20.3 断言 setting 按钮不显示红点 #期望：['true']

## 4 Bug 测试
