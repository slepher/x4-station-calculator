## ADDED Requirements

### Requirement: 模块颜色编码系统
系统 SHALL 根据模块类型或类别为模块分配不同颜色，以改善视觉区分。

#### Scenario: 显示彩色模块标记
- **WHEN** 用户查看模块列表或搜索结果
- **THEN** 每个模块 SHALL 具有与其类型/类别相对应的彩色标记，而不是默认的蓝色

### Requirement: 按模块类型的颜色映射
系统 SHALL 通过解析来自 colors_final.xml 的游戏数据并将映射到 holomap 组件颜色来将模块类型映射到特定颜色：
- Production modules: 映射到 'holomap_component_production' -> 实际颜色
- Storage modules: 映射到 'holomap_component_storage' -> 实际颜色
- Habitation modules: 映射到 'holomap_component_habitation' -> 实际颜色
- Defense modules: 映射到 'holomap_component_defence' -> 实际颜色
- Dockarea modules: 映射到 'holomap_component_dockingbay' -> 实际颜色
- Connection modules: 映射到 'holomap_component_connection' -> 实际颜色
- Processing modules: 映射到 'holomap_component_processing' -> 实际颜色
- Venture platform modules: 映射到 'holomap_component_ventureplatform' -> 实际颜色
- Other modules: 使用基础颜色作为默认值

#### Scenario: 根据模块类型应用颜色
- **WHEN** 模块在模块列表中渲染
- **THEN** 系统 SHALL 确定模块类型并从映射中应用适当的颜色

### Requirement: 一致的颜色应用
系统 SHALL 确保相同模块类型在所有UI元素中具有一致的颜色分配。

#### Scenario: 不同视图中的一致颜色
- **WHEN** 相同模块出现在模块列表和搜索结果中
- **THEN** 模块 SHALL 在两个视图中具有相同的颜色标记