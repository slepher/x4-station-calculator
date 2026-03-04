# Test Tasks: ship-status-diff

## 1 单元测试

- [ ] 1.1 预演蓝图纯计算不污染正式蓝图
  - [ ] 1.1.1 在单测中构造含 `weapon` 与 `shield` 的 `blueprint` 基础数据
  - [ ] 1.1.2 调用预演构造函数执行 connection 模式替换，读取返回的 `targetBlueprint`
  - [ ] 1.1.3 断言原始 `blueprint.connections` 未发生引用内字段变化 #期望: ['immutable']

- [ ] 1.2 connection 模式单 key 预演替换
  - [ ] 1.2.1 提供两个不同 `connectionKey` 的同类槽位作为输入
  - [ ] 1.2.2 对其中一个 key 执行预演替换并输出 `targetBlueprint`
  - [ ] 1.2.3 断言仅目标 key 的 `equipment_id/count` 变化，另一 key 保持原值 #期望: ['single-key-only']

- [ ] 1.3 group 模式按数量分摊替换
  - [ ] 1.3.1 构造 `connectionKeys=[k1,k2,k3]` 与容量 `[4,2,1]`，目标数量 `5`
  - [ ] 1.3.2 执行 group 预演替换并读取每个 key 的 count
  - [ ] 1.3.3 断言 count 总和等于 5 且每个 key 不超过容量 #期望: [5, 'within-capacity']

- [ ] 1.4 group 模式零分配连接清空
  - [ ] 1.4.1 构造目标数量小于总容量的 group 预演输入
  - [ ] 1.4.2 执行预演后筛选 count=0 的连接
  - [ ] 1.4.3 断言这些连接 `equipment_id=null` 且 `count=0` #期望: ['cleared-on-zero']

- [ ] 1.5 Stats target map 生成
  - [ ] 1.5.1 在 `ShipBuildPanelStats` 单测中传入 `shipBlueprint + targetBlueprint` 并挂载 `MetricsPanel`
  - [ ] 1.5.2 读取渲染后的 `[data-testid="metric-value-speed"]` 文本
  - [ ] 1.5.3 断言 `metric-value-speed` 在 target 启用时输出带括号差值格式 #期望: ['/\\(.+[+-].+\\)/']

## 2 E2E 标准状态与状态迁移

- [ ] 2.1 状态: ship-build-picker-open
  - [ ] 2.1.1 载入 `tests/fixtures/db.json`（移除 `vsn`），通过 UI 选择语言为 `zh-CN`，并固定选择 `shipId=ship_ter_m_corvette_02_a (Odachi)`
  - [ ] 2.1.2 在 `ship-build-panel-fit` 内点击首个可见槽位 `[data-testid^="slot-"]`
  - [ ] 2.1.3 断言候选列表容器 `[data-testid="equipment-picker"]` 可见
  - [ ] 2.1.4 断言详情面板 `[data-testid="ship-build-panel-equipment"]` 可见 #期望: ['picker-open']

- [ ] 2.2 状态: ship-build-highlight-preview
  - [ ] 2.2.1 状态: ship-build-picker-open
  - [ ] 2.2.2 在候选列表 `[data-testid="equipment-picker"]` 点击第 2 个候选项 `[data-testid^="candidate-"]`
  - [ ] 2.2.3 在 Stats 面板读取 `[data-testid="metric-value-speed"]` 文本
  - [ ] 2.2.4 断言 `metric-value-speed` 包含差值括号格式（如 `205(+25)`）#期望: ['/\\(.+[+-].+\\)/']

- [ ] 2.3 状态: ship-build-preview-cleared
  - [ ] 2.3.1 状态: ship-build-highlight-preview
  - [ ] 2.3.2 点击 `[data-testid="picker-cancel"]` 关闭 picker
  - [ ] 2.3.3 在 Stats 面板读取 `[data-testid="metric-value-speed"]` 文本
  - [ ] 2.3.4 断言 `metric-value-speed` 不包含差值括号 #期望: ['no-parentheses']

- [ ] 2.4 切换: ship-build-picker-open -> ship-build-highlight-preview
  - [ ] 2.4.1 状态: ship-build-picker-open
  - [ ] 2.4.2 在候选列表点击第 2 个候选项 `[data-testid^="candidate-"]`
  - [ ] 2.4.3 读取 `[data-testid="metric-value-speed"]` 文本
  - [ ] 2.4.4 断言文本从单值变为差值格式 #期望: ['preview-entered']

- [ ] 2.5 切换: ship-build-highlight-preview -> ship-build-preview-cleared
  - [ ] 2.5.1 状态: ship-build-highlight-preview
  - [ ] 2.5.2 点击 `[data-testid="picker-cancel"]`
  - [ ] 2.5.3 在 Stats 面板读取 `[data-testid="metric-value-speed"]` 文本
  - [ ] 2.5.4 断言文本恢复为 current-only 格式 #期望: ['preview-exited']

## 3 E2E 测试场景

- [ ] 3.1 Case: connection 模式高亮触发单槽位预演
  - [ ] 3.1.1 状态: ship-build-picker-open
  - [ ] 3.1.2 切换: ship-build-picker-open -> ship-build-highlight-preview
  - [ ] 3.1.3 在 `ship-build-panel-fit` 记录目标槽位 `[data-testid^="slot-"]` 的已装备文本
  - [ ] 3.1.4 点击 `[data-testid="picker-cancel"]` 关闭 picker
  - [ ] 3.1.5 断言同一槽位已装备文本与步骤 3.1.3 完全一致 #期望: ['connection-preview-only']

- [ ] 3.2 Case: group 模式按数量替换全部同类槽位预演
  - [ ] 3.2.1 状态: ship-build-picker-open
  - [ ] 3.2.2 点击 `[data-testid="fit-mode-group"]` 切换到简化模式
  - [ ] 3.2.3 切换: ship-build-picker-open -> ship-build-highlight-preview
  - [ ] 3.2.4 读取 `[data-testid^="slot-row-count-"]` 的 count 数值并断言总和等于 `data-testid="group-target-count"` #期望: ['group-count-preserved']

- [ ] 3.3 Case: group 预演含零分配槽位清空
  - [ ] 3.3.1 状态: ship-build-highlight-preview
  - [ ] 3.3.2 点击 `[data-testid="fit-mode-group"]` 并在候选列表重新点击目标候选，建立 group 预演态
  - [ ] 3.3.3 读取 `[data-testid^="slot-row-count-"]` 与 `[data-testid^="slot-row-name-"]`
  - [ ] 3.3.4 断言 count=0 的 key 对应 `slot-row-name-<key>` 显示 `--` #期望: ['zero-cleared']

- [ ] 3.4 Case: 关闭 picker 清空 target 对比
  - [ ] 3.4.1 状态: ship-build-highlight-preview
  - [ ] 3.4.2 切换: ship-build-highlight-preview -> ship-build-preview-cleared
  - [ ] 3.4.3 断言 `[data-testid="metric-value-speed"]` 不包含括号差值 #期望: ['diff-hidden']

- [ ] 3.5 Case: 切换飞船后旧预演不残留
  - [ ] 3.5.1 切换: ship-build-highlight-preview -> ship-build-preview-cleared
  - [ ] 3.5.2 状态: ship-build-preview-cleared
  - [ ] 3.5.3 点击 `[data-testid="ship-build-change-ship"]`，再点击 `[data-testid="ship-build-ship-name"]` 且文本为 `Osaka`
  - [ ] 3.5.4 断言 `[data-testid="metric-value-speed"]` 为 current-only 文本且不含括号 #期望: ['no-cross-ship-leak']

- [ ] 3.6 Case: 清理后重新打开 picker 仍保持无残留状态
  - [ ] 3.6.1 状态: ship-build-preview-cleared
  - [ ] 3.6.2 在 `ship-build-panel-fit` 内点击首个可见槽位 `[data-testid^="slot-"]`
  - [ ] 3.6.3 断言未高亮候选前 `metric-value-speed` 仍为 current-only 文本 #期望: ['reopen-no-stale-diff']

## 4 Bug 测试

- [✓] 4.1 BUG-001: 简化模式空炮塔槽位高亮首个候选时 turret_avg diff 为 0
  - [✓] 4.1.1 加载 `tests/fixtures/db.json`（移除 `vsn`）并通过 UI 切换 `zh-CN`
  - [✓] 4.1.2 进入 Ship Build，`Change Ship` 后筛选 M + terran 并选择 `Odachi`
  - [✓] 4.1.3 切换 `T` 炮塔槽位，打开 picker 后切换到简化模式，点击首个非空候选炮塔
  - [✓] 4.1.4 断言 `metric-value-turret_avg` 显示带正向差值括号格式 #期望: ['(+N)']
