# Map Resource Filter Specification

## Purpose
修改 map 页面资源过滤的命中染色行为，使多资源筛选时可以按 sector 资源现状显示饼图切片，同时保持既有筛选、排序与高亮优先级不变。

## MODIFIED Requirements

### Requirement: Search And Resource Highlight Coexistence
系统 MUST 支持搜索命中与资源命中并存，并在资源过滤激活时根据参与资源数量选择单色或饼图填充。

#### Scenario: 搜索高亮优先于资源高亮
- **前提** 某个 sector 同时命中搜索结果与资源筛选结果
- **当** 地图渲染该 sector
- **那么** 系统 SHALL 以搜索高亮为主样式
- **并且** SHALL 仅将资源过滤作为较弱提示叠加

#### Scenario: 资源过滤未激活时保持原始内部填充
- **前提** 当前没有激活任何资源或日光筛选
- **当** 地图渲染 sector
- **那么** 系统 SHALL 保持既有非资源过滤内部填充逻辑

#### Scenario: 单资源筛选时继续使用单色填充
- **前提** 当前资源过滤激活
- **并且** 当前只有一个参与染色的项目
- **当** 地图渲染命中 sector
- **那么** 系统 SHALL 继续使用单色内部填充

#### Scenario: 多资源筛选时改为饼图填充
- **前提** 当前资源过滤激活
- **并且** 当前存在两个或以上参与染色的普通资源
- **当** 地图渲染命中 sector
- **那么** 系统 SHALL 将 sector 内部渲染为多切片饼图
- **并且** SHALL NOT 再整块使用第一个资源颜色填充

#### Scenario: 未命中 sector 保持透明
- **前提** 当前资源过滤激活
- **并且** 某个 sector 不满足资源过滤条件
- **当** 地图渲染该 sector
- **那么** 系统 SHALL 让该 sector 的内部填充保持透明

### Requirement: Resource Pie Slice Ordering And Allocation
系统 MUST 按资源 tag 固定顺序和 sector `level` 现状生成多资源饼图切片，并为每个参与资源保留最小可见份额。

#### Scenario: 切片顺序遵循 tag 固定顺序
- **前提** 当前存在多个参与染色的普通资源
- **当** 系统生成 sector 的饼图切片
- **那么** 系统 SHALL 按资源 tag 固定顺序输出切片
- **并且** SHALL NOT 按 sector 中资源数值重新排序

#### Scenario: 切片基础权重来自 level
- **前提** 某个命中 sector 存在多个参与染色的普通资源
- **当** 系统计算切片大小
- **那么** 系统 SHALL 使用这些资源在该 sector 中的 `level` 作为基础权重

#### Scenario: 每个参与资源保留最小显示份额
- **前提** 某个命中 sector 存在多个参与染色的普通资源
- **当** 系统完成切片份额分配
- **那么** 系统 SHALL 为每个参与资源保留至少 `5%` 的可见份额

#### Scenario: 剩余份额按 level 比例分配
- **前提** 系统已为每个参与资源保留最小显示份额
- **当** 系统分配剩余饼图空间
- **那么** 系统 SHALL 按各资源 `level` 比例分配剩余份额

#### Scenario: level 总和为零时仍稳定可见
- **前提** 某个命中 sector 的参与染色资源 `level` 总和为 `0`
- **当** 系统生成饼图切片
- **那么** 系统 SHALL 仍为每个参与资源保留至少 `5%` 的可见份额
- **并且** SHALL 使用稳定规则分配剩余份额

### Requirement: Sunlight Exclusion In Mixed Resource Coloring
系统 MUST 在存在普通资源切片时排除 `日光` 染色，并只在没有普通资源参与时允许日光单独染色。

#### Scenario: 普通资源存在时排除日光切片
- **前提** 当前选中的染色条件同时包含 `日光` 与至少一个普通资源
- **并且** 某个命中 sector 存在普通资源参与染色
- **当** 系统生成该 sector 的染色结果
- **那么** 系统 SHALL 排除 `日光` 切片

#### Scenario: 只有日光参与时保留单独染色
- **前提** 当前没有普通资源参与染色
- **并且** `日光` 条件处于激活状态
- **当** 系统生成命中 sector 的染色结果
- **那么** 系统 SHALL 允许 `日光` 继续作为单独染色来源

### Requirement: Resource Filter Coloring Data Flow
系统 MUST 将资源过滤染色数据从单一颜色升级为可描述 sector 切片的结构，并由地图工作台传递给 SVG 画布。

#### Scenario: 面板向外输出 sector 染色描述
- **前提** 资源过滤面板已经根据当前条件计算出命中 sector
- **当** 面板向上游发送资源过滤表现数据
- **那么** 系统 SHALL 输出命中 sector 列表
- **并且** SHALL 输出每个命中 sector 的染色描述

#### Scenario: 地图工作台转发切片描述
- **前提** 地图工作台接收到资源过滤面板输出的 sector 染色描述
- **当** 地图工作台渲染 SVG 画布
- **那么** 系统 SHALL 将这些描述转发给 SVG 画布
- **并且** SHALL 保持搜索高亮与当前选中态输入结构不退化
