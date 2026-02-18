# Test Tasks: 多空间站帝国规划模式

## Unit Tests

### 数据模型测试

- [x] V2 数据结构初始化测试
  - **目标**: 验证 V2 数据结构正确初始化
  - **步骤**:
    1. 创建空的 EmpireStore
    2. 检查 version 为 2
    3. 检查 empires 为空数组
    4. 检查 activeStationId 为 null

- [x] V1 → V2 数据迁移测试
  - **目标**: 验证 V1 数据正确迁移到 V2 格式
  - **步骤**:
    1. 准备 V1 格式的测试数据
    2. 调用 migrateFromV1()
    3. 验证迁移后的数据结构正确
    4. 验证所有分站 type 为 'industrial'

### Store 功能测试

- [x] 分站 CRUD 操作测试
  - **目标**: 验证分站的创建、读取、更新、删除功能
  - **步骤**:
    1. 创建新分站，验证添加到 empires[0].stations
    2. 更新分站名称，验证保存成功
    3. 复制分站，验证副本正确创建
    4. 删除分站，验证从数组中移除

- [x] activeStation 计算属性测试
  - **目标**: 验证当前激活分站正确计算
  - **步骤**:
    1. 设置 activeStationId 为某个分站 ID
    2. 验证 activeStation 返回正确的分站对象
    3. 设置 activeStationId 为 null
    4. 验证 activeStation 返回 null

- [x] 帝国总工人需求计算测试
  - **目标**: 验证 totalWorkforceNeeded 正确计算
  - **步骤**:
    1. 创建多个工业站，设置不同的工人需求
    2. 验证 totalWorkforceNeeded 为所有工业站需求之和
    3. 添加补给站，验证不影响总需求

### 补给站计算测试

- [ ] 补给站模块生成测试
  - **目标**: 验证补给站根据帝国总需求生成补给模块
  - **步骤**:
    1. 创建工业站，设置工人需求
    2. 创建补给站
    3. 验证补给站生成正确的补给模块数量

- [x] 站内补给开关测试
  - **目标**: 验证 supplyWorkforceBonus 开关功能
  - **步骤**:
    1. 设置 supplyWorkforceBonus = true
    2. 验证 calculateAutoFill 生成补给区
    3. 设置 supplyWorkforceBonus = false
    4. 验证 calculateAutoFill 不生成补给区

## Web Integration Tests

### 标签栏交互测试

- [x] 标签切换测试
  - **目标**: 验证标签切换功能正常工作
  - **步骤**:
    1. 打开应用
    2. 点击"帝国总览"标签
    3. 验证内容区域显示总览视图
    4. 点击分站标签
    5. 验证内容区域显示分站视图

- [x] 新建分站测试
  - **目标**: 验证 [+] 按钮创建新分站
  - **步骤**:
    1. 点击 [+] 按钮
    2. 验证新分站标签出现
    3. 验证新分站自动激活
    4. 验证新分站 type 为 'industrial'

- [x] 分站菜单测试
  - **目标**: 验证分站右键菜单功能
  - **步骤**:
    1. 右键点击分站标签
    2. 验证菜单显示重命名、复制、导入、删除选项
    3. 点击删除选项
    4. 验证确认对话框出现

### 动态工具栏测试

- [x] 工具栏内容切换测试
  - **目标**: 验证工具栏根据选中 Tab 动态切换
  - **步骤**:
    1. 选中"帝国总览"标签
    2. 验证工具栏显示方案名称输入框
    3. 选中分站标签
    4. 验证工具栏显示三组控件

- [x] 工人运算开关测试
  - **目标**: 验证工人运算开关 UI 与数据绑定
  - **步骤**:
    1. 选中分站标签
    2. 点击工人运算开关
    3. 验证按钮颜色变化（灰 → 绿）
    4. 验证 settings.considerWorkforceForAutoFill 更新

- [x] 站内补给开关测试
  - **目标**: 验证站内补给开关 UI 与数据绑定
  - **步骤**:
    1. 选中分站标签
    2. 点击站内补给开关
    3. 验证按钮颜色变化
    4. 验证 settings.internalSupply 更新
    5. 验证补给区显示/隐藏

- [x] 工人运算统一控制测试
  - **目标**: 验证工人运算开关统一控制工业区和补给区
  - **步骤**:
    1. 选中分站标签
    2. 点击工人运算开关开启
    3. 添加模块触发自动补给区
    4. 验证工业区和补给区都计算工人需求
    5. 点击工人运算开关关闭
    6. 验证工业区和补给区都不计算工人需求

- [x] 星区矿物选择测试
  - **目标**: 验证星区矿物多选菜单功能
  - **步骤**:
    1. 点击星区矿物徽章
    2. 验证多选菜单弹出
    3. 选择/取消选择矿物
    4. 验证徽章数量更新

### 数据迁移测试

- [x] V1 数据迁移 E2E 测试
  - **目标**: 验证 V1 用户数据自动迁移
  - **步骤**:
    1. 在 localStorage 中设置 V1 格式数据
    2. 刷新页面
    3. 验证数据迁移为 V2 格式
    4. 验证原有方案保留在分站列表中

### 分站视图数据绑定测试

- [x] 分站数据隔离测试
  - **目标**: 验证切换分站时数据正确隔离
  - **步骤**:
    1. 创建两个分站，各添加不同模块
    2. 切换到分站 A
    3. 验证模块列表显示分站 A 的模块
    4. 切换到分站 B
    5. 验证模块列表显示分站 B 的模块
    6. 修改分站 B 的模块
    7. 切换回分站 A
    8. 验证分站 A 的模块未受影响

---

## Bug 复现测试

### Bug #1: 新建功能仅新建空间站

- [x] 新建帝国功能测试
  - **目标**: 验证新建按钮创建新帝国而非仅创建空间站
  - **步骤**:
    1. 记录当前帝国数量
    2. 点击菜单"新建"按钮
    3. 在 SmartSaveDialog 中选择"放弃并新建"
    4. 验证帝国数量增加 1
    5. 验证当前激活的是新创建的帝国
    6. 验证新帝国包含一个默认空间站
  - **结果**: ❌ Bug 已复现 - 空间站数量增加 1，但帝国数量未增加

### Bug #2: 另存为功能同时修改当前帝国

- [x] 另存为帝国功能测试
  - **目标**: 验证另存为仅创建新帝国副本，不修改当前帝国名称
  - **步骤**:
    1. 创建并命名一个帝国（如 "Empire A"）
    2. 点击菜单"另存为"按钮
    3. 输入新名称（如 "Empire B"）
    4. 点击保存
    5. 验证帝国数量增加 1
    6. 验证当前激活的是新帝国 "Empire B"
    7. 验证原帝国名称仍为 "Empire A"（未被修改）
  - **结果**: ✅ Bug 已修复

---

## 帝国 CRUD 全面测试

> 测试文件: `tests/e2e/multi-station-empire/crud.spec.ts`

### Create - 创建帝国

- [x] C1: 新建帝国并验证初始状态
  - **UI 验证**:
    1. 点击新建按钮
    2. 验证帝国名称输入框可见
    3. 验证空间站标签数量为 0
    4. 验证模块列表为空
  - **数据验证**:
    1. 检查 localStorage 中 savedEmpires.list 为空
    2. 检查 activeEmpire 存在但未保存
  - **结果**: ✅ 通过

- [x] C2: 新建帝国后添加空间站和模块
  - **UI 验证**:
    1. 新建帝国
    2. 添加空间站，验证标签出现
    3. 添加 Energy Cell 模块，验证模块显示在列表
    4. 验证资源面板显示能量电池产出
  - **数据验证**:
    1. 检查 activeEmpire.stations.length === 1
    2. 检查 station.modules 包含 Energy Cell
    3. 检查 localStorage 仍为空（未保存）
  - **结果**: ✅ 通过

- [x] C3: Bug #3 - 连续新建应创建独立帝国
  - **UI 验证**:
    1. 新建帝国 A，添加空间站，添加 Energy Cell 模块
    2. 保存帝国 A
    3. 新建帝国 B
    4. 验证帝国 B 无空间站、无模块
    5. 验证帝国 B 名称不同于 A
  - **数据验证**:
    1. 检查 localStorage 中 savedEmpires.list.length === 1（只有 A）
    2. 检查 activeEmpire.id !== savedEmpires.list[0].id
  - **结果**: ✅ 通过

### Read - 读取/加载帝国

- [x] R1: 保存的帝国应出现在加载列表
  - **UI 验证**:
    1. 创建帝国，命名为 "Test Empire"
    2. 添加空间站 "Station A"
    3. 添加 Energy Cell 和 Hull Part 模块
    4. 保存
    5. 打开加载列表，验证 "Test Empire" 显示
    6. 验证显示空间站数量为 1
    7. 验证显示模块预览
  - **数据验证**:
    1. 检查 localStorage 中 savedEmpires.list.length === 1
    2. 检查 empire.name === "Test Empire"
    3. 检查 empire.stations[0].modules.length === 2
  - **结果**: ✅ 通过

- [x] R2: Bug #4 - 未保存的帝国不应出现在加载列表
  - **UI 验证**:
    1. 创建帝国，命名为 "Unsaved Empire"
    2. 添加空间站和模块
    3. 不保存，打开加载列表
    4. 验证 "Unsaved Empire" 不在列表中
    5. 验证列表显示"无保存的方案"
  - **数据验证**:
    1. 检查 localStorage 中 savedEmpires.list.length === 0
    2. 检查 activeEmpire 存在（内存中）
  - **结果**: ✅ 通过

- [x] R3: 刷新后已保存帝国应保留
  - **UI 验证**:
    1. 创建帝国，添加空间站 "Station A"
    2. 添加 Energy Cell (数量 5) 和 Hull Part (数量 3) 模块
    3. 保存
    4. 刷新页面
    5. 验证帝国名称保留
    6. 验证空间站标签保留
    7. 验证模块列表显示 Energy Cell x5, Hull Part x3
  - **数据验证**:
    1. 刷新前检查 localStorage 数据
    2. 刷新后检查 localStorage 数据相同
    3. 检查模块数量正确
  - **结果**: ✅ 通过

- [x] R4: 加载不同帝国应切换数据
  - **UI 验证**:
    1. 创建帝国 A，添加空间站，添加 Energy Cell 模块，保存
    2. 新建帝国 B，添加空间站，添加 Hull Part 模块，保存
    3. 打开加载列表，加载帝国 A
    4. 验证模块列表显示 Energy Cell
    5. 加载帝国 B
    6. 验证模块列表显示 Hull Part
  - **数据验证**:
    1. 检查 localStorage 中 savedEmpires.list.length === 2
    2. 切换后检查 activeEmpire.id 对应正确
  - **结果**: ✅ 通过

### Update - 更新帝国

- [x] U1: 修改帝国名称并保存
  - **UI 验证**:
    1. 创建帝国，命名为 "Original Name"
    2. 添加空间站，添加 Energy Cell 模块
    3. 保存
    4. 修改名称为 "Updated Name"
    5. 保存
    6. 刷新页面
    7. 验证名称显示 "Updated Name"
    8. 验证模块仍然存在
  - **数据验证**:
    1. 检查 localStorage 中 empire.name === "Updated Name"
    2. 检查 empire.stations[0].modules 仍然存在
  - **结果**: ✅ 通过

- [x] U2: 修改空间站模块并保存
  - **UI 验证**:
    1. 创建帝国，添加空间站
    2. 添加 Energy Cell (数量 3)
    3. 保存
    4. 添加 Hull Part (数量 2)
    5. 保存
    6. 刷新页面
    7. 验证模块列表显示 Energy Cell x3, Hull Part x2
  - **数据验证**:
    1. 检查 localStorage 中 modules.length === 2
    2. 检查模块数量正确
  - **结果**: ✅ 通过

- [x] U3: 另存为应创建独立副本
  - **UI 验证**:
    1. 创建帝国 A，添加空间站，添加 Energy Cell 模块
    2. 保存
    3. 添加 Hull Part 模块（未保存的修改）
    4. 另存为帝国 B
    5. 验证加载列表显示两个帝国
    6. 加载帝国 A，验证只有 Energy Cell
    7. 加载帝国 B，验证有 Energy Cell + Hull Part
  - **数据验证**:
    1. 检查 localStorage 中 savedEmpires.list.length === 2
    2. 检查帝国 A 和 B 的 modules 不同
    3. 检查帝国 A 和 B 的 id 不同
  - **结果**: ✅ 通过

### Delete - 删除帝国

- [x] D1: Bug #5 - 删除帝国后刷新应消失
  - **UI 验证**:
    1. 创建帝国 "To Delete"，添加空间站，添加模块
    2. 保存
    3. 打开加载列表，删除该帝国
    4. 验证列表不再显示 "To Delete"
    5. 刷新页面
    6. 打开加载列表，验证仍然不显示
  - **数据验证**:
    1. 删除前检查 localStorage 中有该帝国
    2. 删除后检查 localStorage 中无该帝国
    3. 刷新后再次检查确认
  - **结果**: ✅ 通过

- [x] D2: 删除当前编辑的帝国应切换到其他帝国
  - **UI 验证**:
    1. 创建帝国 A，保存
    2. 创建帝国 B，保存
    3. 加载帝国 A
    4. 在加载列表中删除帝国 A
    5. 验证当前显示帝国 B
    6. 验证模块列表显示帝国 B 的模块
  - **数据验证**:
    1. 检查 localStorage 中 savedEmpires.list.length === 1
    2. 检查 activeEmpire.id === 帝国 B 的 id
  - **结果**: ✅ 通过

---

## Tab 状态持久化测试

> 测试文件: `tests/e2e/multi-station-empire/crud.spec.ts`

### sessionStorage 实时跟踪

- [x] T1: 切换 tab 后刷新页面应停留在之前选中的 tab
  - **UI 验证**:
    1. 创建帝国，添加两个空间站
    2. 保存帝国
    3. 点击第二个空间站 tab
    4. 刷新页面
    5. 验证停留在第二个空间站 tab
  - **数据验证**:
    1. 切换 tab 后检查 sessionStorage 中有 activeStationId
    2. 刷新后检查 sessionStorage 中的值被正确恢复
  - **结果**: ✅ 通过

- [x] T2: 切换 tab 后不保存，刷新页面仍停留在选中的 tab
  - **UI 验证**:
    1. 创建帝国，添加两个空间站
    2. 保存帝国
    3. 点击第二个空间站 tab
    4. 不保存，刷新页面
    5. 验证停留在第二个空间站 tab
  - **数据验证**:
    1. 刷新前检查 sessionStorage 中有 activeStationId
    2. 刷新后检查 sessionStorage 中的值被正确恢复
  - **结果**: ✅ 通过

- [ ] T3: 切换 tab 后添加模块，刷新页面停留在选中的 tab
  - **UI 验证**:
    1. 创建帝国，添加两个空间站
    2. 保存帝国
    3. 点击第二个空间站 tab
    4. 添加模块到第二个空间站
    5. 刷新页面
    6. 验证停留在第二个空间站 tab
    7. 验证模块列表为空（未保存）
  - **数据验证**:
    1. 刷新前检查 sessionStorage 中有 activeStationId
    2. 刷新后检查 sessionStorage 中的值被正确恢复
  - **结果**: 待测试

### localStorage 持久化

- [x] T4: 切换 tab 后保存，刷新页面停留在选中的 tab
  - **UI 验证**:
    1. 创建帝国，添加两个空间站
    2. 保存帝国
    3. 点击第二个空间站 tab
    4. 保存
    5. 刷新页面
    6. 验证停留在第二个空间站 tab
  - **数据验证**:
    1. 保存后检查 localStorage 中 savedEmpires.activeStationId 正确
    2. 刷新后检查 localStorage 中的值被正确恢复
  - **结果**: ✅ 通过

### 载入场景

- [ ] T5: 载入同一帝国应使用 localStorage 中的 tab
  - **UI 验证**:
    1. 创建帝国 A，添加两个空间站
    2. 点击第二个空间站 tab
    3. 保存
    4. 点击第一个空间站 tab
    5. 打开加载列表，载入帝国 A
    6. 验证停留在第二个空间站 tab（localStorage 中的值）
  - **数据验证**:
    1. 载入前检查 sessionStorage 被清除
    2. 载入后检查 activeStationId 来自 localStorage
  - **结果**: 待测试

- [x] T6: 载入不同帝国应使用新帝国的第一个空间站
  - **UI 验证**:
    1. 创建帝国 A，添加两个空间站，保存
    2. 创建帝国 B，添加两个空间站，保存
    3. 在帝国 B 中点击第二个空间站 tab
    4. 打开加载列表，载入帝国 A
    5. 验证停留在帝国 A 的第一个空间站
  - **数据验证**:
    1. 载入前检查 sessionStorage 被清除
    2. 载入后检查 activeStationId 是帝国 A 的第一个空间站
  - **结果**: ✅ 通过

### 边界场景

- [ ] T7: 选中的空间站被删除后应回退到第一个空间站
  - **UI 验证**:
    1. 创建帝国，添加两个空间站
    2. 保存
    3. 点击第二个空间站 tab
    4. 删除第二个空间站
    5. 验证停留在第一个空间站 tab
  - **数据验证**:
    1. 删除后检查 sessionStorage 被更新
    2. 删除后检查 activeStationId 是第一个空间站
  - **结果**: 待测试

---

## ContextToolbar UI 统一化测试

> 测试文件: `tests/e2e/multi-station-empire/ui-unification.spec.ts`

### X4NumberInput 统一

- [x] U1: 光照输入框使用 X4NumberInput 样式
  - **UI 验证**:
    1. 创建帝国，添加空间站
    2. 检查 ContextToolbar 中光照输入框
    3. 验证使用 X4NumberInput 组件（有上下箭头按钮）
    4. 验证悬停时显示调节按钮
  - **结果**: ✅ 通过（手动验证）

- [x] U2: 数量输入框使用 X4NumberInput 样式
  - **UI 验证**:
    1. 创建帝国，添加空间站
    2. 检查 ContextToolbar 中数量输入框
    3. 验证使用 X4NumberInput 组件
    4. 验证无前缀 "x"
  - **结果**: ✅ 通过（手动验证）

- [x] U3: 种族下拉框样式统一
  - **UI 验证**:
    1. 创建帝国，添加空间站
    2. 检查 ContextToolbar 中种族偏好下拉框
    3. 验证样式与 StationPlanningPanel 一致
  - **结果**: ✅ 通过（手动验证）

### StationPlanningPanel 清理

- [x] U4: 无模块列表标题行
  - **UI 验证**:
    1. 创建帝国，添加空间站
    2. 检查 StationPlanningPanel
    3. 验证无 "模块列表" 标题
    4. 验证无光照输入框
    5. 验证无分割线
  - **结果**: ✅ 通过（手动验证）

- [x] U5: 自动工业区无冗余控件
  - **UI 验证**:
    1. 创建帝国，添加空间站
    2. 添加模块触发自动工业区
    3. 检查自动工业区标题
    4. 验证无工人计算 checkbox
    5. 验证无种族偏好下拉框
  - **结果**: ✅ 通过（手动验证）

---

## Bug 复现测试

> 测试文件: `tests/e2e/multi-station-empire/bug-reproduction.spec.ts`

### Bug #7: 保存并新建没有创建新帝国

- [ ] B7-1: 保存并新建应创建新帝国
  - **步骤**:
    1. 点击"新建"创建新帝国
    2. 点击 [+] 添加一个空间站
    3. 添加一个模块
    4. 再次点击"新建"
    5. 在弹出的对话框中点击"保存并新建"
  - **期待结果**: 创建新帝国成功，显示空白帝国（无空间站）
  - **Bug现状**: 没有新建帝国，保持在当前页面
  - **结果**: 待测试

- [ ] B7-2: 另存为 + 保存并新建应创建新帝国
  - **步骤**:
    1. 点击"新建"创建新帝国
    2. 点击 [+] 添加一个空间站
    3. 添加一个模块
    4. 点击"另存为"
    5. 输入新名称"Empire B"
    6. 点击"保存并新建"
  - **期待结果**: 创建名为"Empire B"的新帝国副本，并创建新的空白帝国
  - **Bug现状**: 创建了"Empire B"副本，但切换到该副本而非创建空白帝国
  - **结果**: 待测试
