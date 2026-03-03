# 测试任务：船只配装装备选择器

## 1 单元测试

- [✓] 1.1 PanelFit 本地模式切换
  - [✓] 1.1.1 渲染 `ShipBuildPanelFit` 并记录初始 `fitMode`
  - [✓] 1.1.2 依次点击简化按钮与标准按钮
  - [✓] 1.1.3 模式切换序列保持 `connection -> group -> connection` #期望: [['connection','group','connection']]

- [✓] 1.2 PanelFit 直接调用 applyConnectionAssignment
  - [✓] 1.2.1 mock store 的 `applyConnectionAssignment`
  - [✓] 1.2.2 点击单候选槽位触发赋值
  - [✓] 1.2.3 由 `PanelFit` 直接调用 store 方法且调用次数为 1 #期望: [1]

- [✓] 1.3 RACE 标签超过 3 时两行
  - [✓] 1.3.1 构造 `raceTags.length=4` 的候选集合并展开 picker
  - [✓] 1.3.2 读取 RACE 标签容器 class
  - [✓] 1.3.3 命中两行布局 class #期望: [true]

- [✓] 1.4 单候选简化模式补满
  - [✓] 1.4.1 设置 `fitMode='group'` 且目标槽位 `candidate=1` 并处于 `count<totalCount`
  - [✓] 1.4.2 点击该槽位
  - [✓] 1.4.3 赋值 payload 的 `equipmentId` 为同一 `candidateId` 且非 `null` #期望: ['singleCandidateId']

- [✓] 1.5 标准模式清空后计数
  - [✓] 1.5.1 设置标准模式下槽位初始已装备且显示 `1/1`
  - [✓] 1.5.2 点击清空该槽位
  - [✓] 1.5.3 槽位计数显示为 `0/1` #期望: ['0/1']

- [✓] 1.6 拖动条实时阶段仅更新显示草稿
  - [✓] 1.6.1 构造目标槽位 `target.totalCount=4` 与初始显示 `1/4`
  - [✓] 1.6.2 触发 `handleCountSliderRealtime(target, 3)`
  - [✓] 1.6.3 显示计数更新为 `3/4` 且未调用提交方法 #期望: ['3/4',0]

- [✓] 1.7 拖动条提交阶段一次性写回数量
  - [✓] 1.7.1 mock `setConnectionAssignmentCount` 并准备 connection target
  - [✓] 1.7.2 触发 `handleCountSliderCommit(target, 2)`
  - [✓] 1.7.3 提交方法按 connection 数量调用且数量值为 2 #期望: [1,2]

- [✓] 1.8 简化模式拖动条步进使用 totalCount
  - [✓] 1.8.1 设置 `fitMode='group'` 与 `target.totalCount=6`
  - [✓] 1.8.2 读取 `sliderStepForTarget(target)`
  - [✓] 1.8.3 步进值为 6 #期望: [6]

- [✓] 1.9 蓝图数量为 0 时保留装备 ID
  - [✓] 1.9.1 构造已有装备 `equipmentId='weapon_a'` 的连接槽
  - [✓] 1.9.2 调用 `setConnectionAssignmentCount({count:0})`
  - [✓] 1.9.3 蓝图记录 `equipmentId` 未被清空且 `count=0` #期望: ['weapon_a',0]

- [✓] 1.10 materials/stats 过滤 count=0
  - [✓] 1.10.1 构造含 `count=0` 与 `count>0` 的蓝图连接集合
  - [✓] 1.10.2 执行材料聚合与统计聚合逻辑
  - [✓] 1.10.3 输出结果仅包含 `count>0` 项 #期望: [true]

## 2 E2E 标准状态与状态迁移

- [✓] 2.1 状态: osaka-selected
  - [✓] 2.1.1 进入 ship-build 并筛选 `L + terran`
  - [✓] 2.1.2 在 `ship-build-list` 点击 `Osaka/大阪`
  - [✓] 2.1.3 `ship-build-selection` 可见且选中船体为大阪 #期望: ['ship_ter_l_destroyer_01_a']

- [✓] 2.2 状态: osaka-picker-open-turret-4-3
  - [✓] 2.2.1 基于 `osaka-selected` 点击 `slot-ship_ter_l_destroyer_01_a::turret::4::3`
  - [✓] 2.2.2 `equipment-picker` 可见并显示三行结构
  - [✓] 2.2.3 处于标准模式且 picker 保持展开状态 #期望: [true]

- [✓] 2.3 切换: osaka-picker-open-turret-4-3 -> osaka-picker-open-group-anchor-mapped
  - [✓] 2.3.1 在 picker 展开态点击简化模式
  - [✓] 2.3.2 切换到 group/tab 分组
  - [✓] 2.3.3 picker 保持展开并完成锚点映射 #期望: [true]

- [✓] 2.4 状态: osaka-slot-slider-visible
  - [✓] 2.4.1 基于 `osaka-picker-open-turret-4-3` 定位目标槽位块
  - [✓] 2.4.2 检查槽位上方存在拖动条并读取两者宽度
  - [✓] 2.4.3 拖动条可见且宽度与槽位一致 #期望: [true]

- [✓] 2.5 切换: osaka-slot-slider-dragging -> osaka-slot-slider-committed
  - [✓] 2.5.1 基于 `osaka-slot-slider-visible` 在拖动条上执行拖动
  - [✓] 2.5.2 记录拖动中显示数量与提交后蓝图数量
  - [✓] 2.5.3 拖动中仅显示变化，松手后蓝图一次性更新 #期望: [true]

## 3 E2E 测试场景

- [✓] 3.1 Case: 展开时第一列宽度稳定
  - [✓] 3.1.1 状态: osaka-picker-open-turret-4-3
  - [✓] 3.1.2 记录展开后一行左列宽度并比对二三行
  - [✓] 3.1.3 三行左列宽度一致 #期望: [true]

- [✓] 3.2 Case: 候选=1 简化模式未满点击补满
  - [✓] 3.2.1 状态: osaka-selected
  - [✓] 3.2.2 切换到简化模式并定位候选为 1 且未满的槽位
  - [✓] 3.2.3 点击后计数补满到 `totalCount` #期望: ['totalCount']

- [✓] 3.3 Case: 简化模式满数量点击清空
  - [✓] 3.3.1 状态: osaka-selected
  - [✓] 3.3.2 切换到简化模式并确保目标槽位已满
  - [✓] 3.3.3 点击后目标槽位被清空 #期望: [null]

- [✓] 3.4 Case: 清空后切回标准显示 0/1
  - [✓] 3.4.1 切换: osaka-picker-open-turret-4-3 -> osaka-picker-open-group-anchor-mapped
  - [✓] 3.4.2 在简化模式清空单槽位后切回标准模式
  - [✓] 3.4.3 目标槽位计数字符串为 `0/1` #期望: ['0/1']

- [✓] 3.5 Case: RACE 标签超过 3 时两行
  - [✓] 3.5.1 状态: osaka-picker-open-turret-4-3
  - [✓] 3.5.2 确认 race 标签数大于 3 并检查 RACE 标签容器布局
  - [✓] 3.5.3 RACE 标签容器为两行布局 #期望: [true]

- [✓] 3.6 Case: picker 前两行高度为 25.6px
  - [✓] 3.6.1 状态: osaka-picker-open-turret-4-3
  - [✓] 3.6.2 读取 picker 第一行与第二行高度
  - [✓] 3.6.3 第一行与第二行高度均为 `25.6px` #期望: ['25.6px','25.6px']

- [✓] 3.7 Case: 拖动条可见高度为 8px
  - [✓] 3.7.1 状态: osaka-slot-slider-visible
  - [✓] 3.7.2 读取拖动条轨道可见高度
  - [✓] 3.7.3 拖动条可见高度为 `8px` #期望: ['8px']

- [✓] 3.8 Case: 拖动条未填充背景色保持默认
  - [✓] 3.8.1 状态: osaka-slot-slider-visible
  - [✓] 3.8.2 读取轨道未填充背景样式
  - [✓] 3.8.3 未填充背景色为 `bg-slate-800` 对应样式 #期望: ['bg-slate-800']

- [✓] 3.9 Case: 简化模式步进等于聚合总数
  - [✓] 3.9.1 切换: osaka-picker-open-turret-4-3 -> osaka-picker-open-group-anchor-mapped
  - [✓] 3.9.2 定位 group 模式拖动条并读取 step 与 totalCount
  - [✓] 3.9.3 `step` 与 `totalCount` 均为 6 #期望: [6,6]

- [✓] 3.10 Case: 数量设为 0 后不删装备且不计入统计材料
  - [✓] 3.10.1 切换: osaka-slot-slider-dragging -> osaka-slot-slider-committed
  - [✓] 3.10.2 将已装备槽位数量拖动提交到 0
  - [✓] 3.10.3 蓝图保留装备 ID 且 `count=0` 且 stats/material 不包含该槽位贡献 #期望: ['weapon_a',0,false,false]

## 4 Bug 测试

- [✓] 4.1 BUG-001: 简化模式切换后未进入 group 视图
  - [✓] 4.1.1 复现步骤: 准备同类槽位存在多装备类型状态并点击简化模式按钮
  - [✓] 4.1.2 修复前断言: `fitMode` 未切换到 group #期望: ['!=group']
  - [✓] 4.1.2 修复后断言: `fitMode` 切换到 group #期望: ['group']
