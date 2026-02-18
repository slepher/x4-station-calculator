## Unit Tests

- [x] 测试 WareFlow 接口的 workforceConsumption 字段初始化
  - **目标**: 验证新创建的 WareFlow 对象中 workforceConsumption 字段被正确初始化为 0
  - **步骤**:
    1. 调用 analyzeWareFlow 函数处理空模块列表
    2. 检查返回的 flows 中每个对象的 workforceConsumption 字段
  - **期待结果**: 所有 WareFlow 对象的 workforceConsumption 字段为 0

- [x] 测试工人消耗正确记录到 workforceConsumption 字段
  - **目标**: 验证工人消耗被正确记录到 workforceConsumption 字段
  - **步骤**:
    1. 创建包含居住舱模块的测试数据
    2. 调用 analyzeWareFlow 函数
    3. 检查 foodrations 和 medicalsupplies 的 workforceConsumption 值
  - **期待结果**: workforceConsumption 值等于工人消耗量，consumption 值等于总消耗量

- [x] 测试分组逻辑 - 补给分组
  - **目标**: 验证有工人消耗且净产出为负的物资被归入 supply 分组
  - **步骤**:
    1. 创建测试数据，使 foodrations 净产出为负
    2. 调用 analyzeWareFlow 函数
    3. 检查 rateGroups.supply 中是否包含 foodrations
  - **期待结果**: foodrations 出现在 rateGroups.supply 中

- [x] 测试分组逻辑 - 运营分组
  - **目标**: 验证无工人消耗且为 container 类型的物资被归入 operations 分组
  - **步骤**:
    1. 创建测试数据，使 hullparts 净产出为负
    2. 调用 analyzeWareFlow 函数
    3. 检查 rateGroups.operations 中是否包含 hullparts
  - **期待结果**: hullparts 出现在 rateGroups.operations 中

- [x] 测试分组逻辑 - 混合消耗物资归入补给分组
  - **目标**: 验证同时有工人消耗和工业消耗的物资归入 supply 分组
  - **步骤**:
    1. 创建测试数据，使某物资同时有工人消耗和工业消耗，且净产出为负
    2. 调用 analyzeWareFlow 函数
    3. 检查该物资的分组归属
  - **期待结果**: 该物资出现在 rateGroups.supply 中

## Web Integration Tests

- [x] 测试 UI 显示补给分组
  - **目标**: 验证补给分组在 UI 中正确显示
  - **步骤**:
    1. 打开空间站计算器页面
    2. 添加一个需要工人的生产模块（如能源电池生产线）
    3. 切换到数量视图
    4. 检查是否显示"补给"分组
  - **期待结果**: 补给分组显示在运营分组之后，包含工人消耗物资

- [x] 测试经济视图补给支出分组
  - **目标**: 验证经济视图中补给支出分组正确显示
  - **步骤**:
    1. 打开空间站计算器页面
    2. 添加一个需要工人的生产模块
    3. 切换到经济视图
    4. 检查是否显示"补给支出"分组
  - **期待结果**: 补给支出分组显示，标题为"补给支出"

- [x] 测试分组顺序
  - **目标**: 验证分组顺序为 产品 → 运营 → 补给 → 资源
  - **步骤**:
    1. 打开空间站计算器页面
    2. 添加多个生产模块，产生产品、运营缺口、补给缺口和资源缺口
    3. 检查分组显示顺序
  - **期待结果**: 分组按 产品 → 运营 → 补给 → 资源 顺序显示
