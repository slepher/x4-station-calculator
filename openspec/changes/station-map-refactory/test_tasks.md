## Unit Tests

- [ ] StationStateMap 生命周期与隔离
  - **目标**: 验证 `ensure/get/clone/remove` 行为正确，且复制后分站状态互不污染
  - **步骤**:
    1. 创建分站 A 运行态并写入模块与设置
    2. 执行 `clone(A, B)`
    3. 修改分站 B 的模块与设置
    4. 读取 A、B 运行态比较差异
  - **Bug现状**: 当前实现以双向同步为主，复制后的运行态隔离约束不明确
  - **期待结果**: A 与 B 数据独立，删除 B 不影响 A

- [ ] StationStateMap 重算一致性
  - **目标**: 验证输入变更会稳定驱动 `autoIndustryModules` 与 `groupedFlows` 重算
  - **步骤**:
    1. 初始化分站运行态并记录初始 `groupedFlows`
    2. 修改 `plannedModules`
    3. 修改 `settings.considerWorkforceForAutoFill`
    4. 对比两次重算后的关键字段
  - **Bug现状**: 现有双路径计算容易造成单站与聚合不一致
  - **期待结果**: 每次输入变更后派生模块和资源流结果同步更新

- [ ] useStationStore 代理可写行为
  - **目标**: 验证 `plannedModules/settings` 代理写入走当前 `stationId`，兼容 `v-model` 场景
  - **步骤**:
    1. 设置 activeStationId 为站点 A
    2. 通过 store API 写入 `plannedModules`
    3. 切换到站点 B 重复写入
    4. 分别断言 A/B 状态
  - **Bug现状**: 当前模型中存在本地副本与 Empire 同步竞态风险
  - **期待结果**: 写入仅作用于当前激活站点，切站后读写互不干扰

- [ ] settings 迁移与持久化边界
  - **目标**: 验证 `resourceBufferHours` 迁移判定与 `showEmpireGaps` 持久化行为符合预期
  - **步骤**:
    1. 构造 `resourceBufferHours=0` 的旧设置并执行迁移
    2. 构造 `resourceBufferHours=undefined` 的旧设置并执行迁移
    3. 设置 `showEmpireGaps=true` 并执行保存/加载
    4. 读取恢复后的设置字段
  - **Bug现状**: `||` 回退可能覆盖合法 `0`；新增 UI 设置可能遗漏到持久化边界
  - **期待结果**: `0` 被保留、`undefined` 回退为 `2`、`showEmpireGaps` 可保存并恢复

- [ ] Empire 聚合来源一致性
  - **目标**: 验证 `empireGroupedFlows` 读取 `StationStateMap` 结果后与单站视图一致
  - **步骤**:
    1. 构造两个分站并分别生成不同资源流
    2. 读取单站 `groupedFlows`
    3. 读取 `empireGroupedFlows`
    4. 对比聚合结果与单站求和结果
  - **Bug现状**: 现有缓存与单站重复计算存在漂移风险
  - **期待结果**: 聚合值与各分站运行态结果可精确对齐

## Web Integration Tests

- [ ] 多分站切换隔离回归
  - **目标**: 验证切换分站后规划区、资源流、建设面板均绑定当前分站且无串站
  - **步骤**:
    1. 新建分站 A 与分站 B
    2. 在 A 添加模块并确认资源流变化
    3. 切换到 B，添加不同模块
    4. 往返切换 A/B 并观察三列内容
  - **Bug现状**: 历史上双向同步模型存在切站后状态错位风险
  - **期待结果**: A/B 数据完全隔离，切站后渲染瞬时一致

- [ ] 规划区可写代理兼容（拖拽/数量变更）
  - **目标**: 验证 `v-model="store.plannedModules"` 在代理化后仍可正常拖拽与编辑
  - **步骤**:
    1. 进入分站规划区并添加多个模块
    2. 拖拽模块顺序
    3. 修改模块数量并删除模块
    4. 切换分站再返回检查结果
  - **Bug现状**: 代理改造后可能出现数组写入不触发或写错站点
  - **期待结果**: 拖拽和编辑稳定生效，且仅影响当前分站

- [ ] 帝国总览聚合一致性回归
  - **目标**: 验证分站更新后帝国总览读取同一来源并实时反映
  - **步骤**:
    1. 在两个分站分别配置不同产线
    2. 记录单站关键资源净产出
    3. 切换到帝国总览检查对应资源聚合值
    4. 回到某分站修改配置后再次验证总览
  - **Bug现状**: 旧缓存路径与单站路径可能出现不同步
  - **期待结果**: 总览聚合与单站结果始终一致
