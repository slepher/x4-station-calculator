## Unit Tests

- [x] 1.1 buildVolumeCompressionMap 计算正确性测试
    - **目标**: 验证压缩率计算公式正确
    - **步骤**:
        1. 创建模拟模块数据，包含已知的 inputs 和 outputs
        2. 调用 buildVolumeCompressionMap()
        3. 验证计算结果符合预期公式
    - **验证方式**: 单元测试通过
    - **期待结果**: 压缩率 = 产出体积 / 消耗体积（忽略 energycells）

- [x] 1.2 忽略 energycells 测试
    - **目标**: 验证消耗体积计算忽略 energycells
    - **步骤**:
        1. 创建包含 energycells 输入的模块
        2. 调用 buildVolumeCompressionMap()
        3. 验证 energycells 的体积未被计入消耗体积
    - **验证方式**: 单元测试通过
    - **期待结果**: energycells 不影响压缩率计算

- [x] 1.3 无输入模块不存储测试
    - **目标**: 验证无输入的模块不被存储到 volumeCompressionMap
    - **步骤**:
        1. 创建无 inputs 的模块
        2. 调用 buildVolumeCompressionMap()
        3. 验证该模块不在 volumeCompressionMap 中
    - **验证方式**: 单元测试通过
    - **期待结果**: volumeCompressionMap 不包含无输入模块

## Web Integration Tests

- [x] 2.1 FlowNode 显示压缩率测试
    - **目标**: 验证符合条件的节点显示压缩率
    - **步骤**:
        1. 启动应用并切换到 LogicFlow 视图
        2. 拖拽一个有输入的模块到规划区
        3. 检查 FlowNode 底部是否显示压缩率
    - **期待结果**: 压缩率显示在 Subtitle 区域，格式为百分比 + 图标

- [x] 2.2 压缩率颜色编码测试
    - **目标**: 验证颜色编码正确
    - **步骤**:
        1. 找到一个压缩率 ≤100% 的模块
        2. 验证文本颜色为绿色
        3. 找到一个压缩率 >100% 的模块
        4. 验证文本颜色为红色
    - **期待结果**: 颜色与压缩率值对应正确

- [x] 2.3 isolated 节点不显示压缩率测试
    - **目标**: 验证 isolated 状态的节点不显示压缩率
    - **步骤**:
        1. 添加一个模块节点
        2. 将节点设为 isolated 状态
        3. 检查节点是否不显示压缩率
    - **期待结果**: isolated 节点不显示压缩率

- [x] 2.4 T0 资源节点不显示压缩率测试
    - **目标**: 验证 T0 资源节点不显示压缩率
    - **步骤**:
        1. 检查 T0 资源节点（如 energycells、ore）
        2. 验证不显示压缩率
    - **期待结果**: T0 节点不显示压缩率
