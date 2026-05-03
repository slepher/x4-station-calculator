# Build Flow - Test Tasks

## 1 单元测试

- [ ] 1.1 测试 computeDemandMaterialSet 正确排除归档产线
  - [ ] 1.1.1 在 buildFlowDerivation.ts 对 computeDemandMaterialSet 编写单元测试
  - [ ] 1.1.2 给定 groups 包含 2 条产线，其中 1 条 archivedGroupIds 包含
  - [ ] 1.1.3 执行 computeDemandMaterialSet 并断言结果不包含归档产线的 buildCost wareId #期望: [仅非归档产线的wareId集合]

- [ ] 1.2 测试 deriveBuildFlowView 正确推导入选产线
  - [ ] 1.2.1 在 buildFlowDerivation.ts 对 deriveBuildFlowView 编写单元测试
  - [ ] 1.2.2 给定 groups 包含产线 A（主要产品命中 demandMaterialSet）和产线 B（不命中）
  - [ ] 1.2.3 执行 deriveBuildFlowView 并断言 lineCards 仅包含产线 A #期望: [产线A的groupId]

- [ ] 1.3 测试 computeBuildFlowGroups 分组算法连通分量
  - [ ] 1.3.1 在 buildFlowDerivation.ts 对 computeBuildFlowGroups 编写单元测试
  - [ ] 1.3.2 给定 3 条入选产线：A 提供 hullparts 且需 graphene，B 提供 graphene 且需 hullparts，C 提供 refinedmetals 且无建材需求
  - [ ] 1.3.3 执行 computeBuildFlowGroups 并断言 A 和 B 在同一组，C 在另一组 #期望: [2个分组, groupKey包含A:B和C]

- [✗] 1.4 测试 cleanupStaleAssignments 跨组清理
  - [✗] 1.4.1 在 buildFlowDerivation.ts 对 cleanupStaleAssignments 编写单元测试
  - [ ] 1.4.2 给定 assignments 包含一条跨组绑定（来源在组 A，目标在组 B）
  - [ ] 1.4.3 执行 cleanupStaleAssignments 并断言该 assignment 被删除 #期望: [assignments.length减少1]

- [ ] 1.5 测试 archiveGroup 清理相关 assignments
  - [ ] 1.5.1 在 useLogicFlowStore.ts 对 archiveBuildFlowGroup 编写单元测试
  - [ ] 1.5.2 给定产线 X 存在作为来源的 assignment 和作为目标的 assignment
  - [ ] 1.5.3 执行 archiveGroup(X) 并断言 assignments 数组不包含 X 相关记录 #期望: [assignments.filter涉及X返回空数组]

## 2 E2E 标准状态与状态迁移

- [ ] 2.1 状态: logic-flow 页面已加载且存在建筑产线区
  - [ ] 2.1.1 在 logic-flow 工作台页面定位 `.build-flow-zone` 元素
  - [ ] 2.1.2 断言 build-flow-zone 存在且可见 #期望: [元素存在]
  - [ ] 2.1.3 断言 build-flow-zone 内存在至少一个 `.build-flow-group` #期望: [至少1个]
  - [ ] 2.1.4 断言每个 group 内存在 `.build-flow-line-card` #期望: [至少1个line-card]

- [ ] 2.2 状态: 建筑产线区显示分组容器
  - [ ] 2.2.1 在 build-flow-zone 内定位所有 `.build-flow-group` 元素
  - [ ] 2.2.2 断言每个 group 包含产线 cards 和产出区 card #期望: [group内包含line-card和output-card]
  - [ ] 2.2.3 断言产出区 card 内存在 `.build-flow-target-tag` #期望: [至少1个target-tag]
  - [ ] 2.2.4 断言产线 card 左侧存在产线建材标签，右侧存在产线原材料标签 #期望: [card内存在source-tag和target-tag]

- [ ] 2.3 状态: 标签绑定关系已建立
  - [ ] 2.3.1 在 build-flow-zone 内定位已绑定的 `.build-flow-target-tag` 元素（通过 data-tag-id）
  - [ ] 2.3.2 断言绑定标签包含 `.target-tag-unbind` 按钮 #期望: [unbind按钮存在]
  - [ ] 2.3.3 断言绑定标签颜色与 wareId 对应 #期望: [标签backgroundColor非透明]
  - [ ] 2.3.4 断言 build-flow-group 内存在 SVG edge 元素 #期望: [svg元素存在]

- [ ] 2.4 切换: 规划区拖拽开始 -> 建筑产线区隐藏
  - [ ] 2.4.1 在 logic-flow 页面触发规划区候选 ware 拖拽开始事件
  - [ ] 2.4.2 断言 build-flow-zone 元素消失 #期望: [元素不可见或不存在]
  - [ ] 2.4.3 触发拖拽结束事件
  - [ ] 2.4.4 断言 build-flow-zone 恢复显示 #期望: [元素visible]

- [ ] 2.5 切换: 点击来源标签 + -> 打开目标菜单
  - [ ] 2.5.1 在产线 card 内定位 `.build-flow-source-tag` 元素
  - [ ] 2.5.2 点击该标签的 `.source-tag-segment-add` 按钮
  - [ ] 2.5.3 断言 `.build-flow-menu` 元素存在且可见 #期望: [menu元素存在]
  - [ ] 2.5.4 断言菜单内包含目标列表项 #期望: [至少1个menu按钮]

- [ ] 2.6 切换: 点击目标标签 + -> 打开来源菜单
  - [ ] 2.6.1 在产线 card 或产出区 card 内定位 `.build-flow-target-tag` 元素
  - [ ] 2.6.2 点击该标签的 `.target-tag-segment-add` 按钮
  - [ ] 2.6.3 断言 `.build-flow-menu` 元素存在且可见 #期望: [menu元素存在]
  - [ ] 2.6.4 断言菜单内包含来源列表项 #期望: [至少1个menu按钮]

- [ ] 2.7 切换: 点击菜单项 -> 建立绑定关系
  - [ ] 2.7.1 在已打开的 `.build-flow-menu` 内定位目标项按钮
  - [ ] 2.7.2 点击目标项按钮
  - [ ] 2.7.3 断言菜单关闭 #期望: [menu元素不存在]
  - [ ] 2.7.4 断言目标标签变为绑定状态（包含 unbind 按钮）#期望: [unbind按钮存在]

- [ ] 2.8 切换: 点击解绑按钮 -> 移除绑定关系
  - [ ] 2.8.1 在已绑定的 target-tag 内定位 `.target-tag-unbind` 按钮
  - [ ] 2.8.2 点击解绑按钮
  - [ ] 2.8.3 断言目标标签恢复未绑定状态 #期望: [unbind按钮不存在]
  - [ ] 2.8.4 断言 SVG edge 元素消失 #期望: [对应edge不存在]

- [ ] 2.9 切换: 点击产线归档按钮 -> 产线从建筑产线区消失
  - [ ] 2.9.1 在产线 card 内定位 `.archive-btn` 按钮
  - [ ] 2.9.2 点击归档按钮
  - [ ] 2.9.3 断言该产线 card 从 build-flow-zone 消失 #期望: [card元素不存在]
  - [ ] 2.9.4 断言标题栏显示归档计数 #期望: [归档计数文本存在]

- [ ] 2.10 切换: 点击标题栏归档按钮 -> 打开归档 Modal
  - [ ] 2.10.1 在 build-flow-zone 标题栏定位归档计数按钮
  - [ ] 2.10.2 点击归档按钮
  - [ ] 2.10.3 断言归档 Modal 存在且可见 #期望: [modal元素存在]
  - [ ] 2.10.4 断言 Modal 内包含已归档产线列表 #期望: [至少1个归档产线项]

- [ ] 2.11 切换: 点击恢复按钮 -> 产线恢复到建筑产线区
  - [ ] 2.11.1 在归档 Modal 内定位恢复按钮
  - [ ] 2.11.2 点击恢复按钮
  - [ ] 2.11.3 断言该产线从 Modal 列表消失 #期望: [产线项不存在]
  - [ ] 2.11.4 断言该产线 card 重新出现在 build-flow-zone #期望: [card元素存在]

## 3 E2E 测试场景

- [ ] 3.1 Case: 建筑产线区渲染基本场景
  - [ ] 3.1.1 在 logic-flow 页面，给定存在产线组 lf-1-g1（包含 claytronics 模块）和 lf-1-g2（包含 quantumtubes 模块）
  - [ ] 3.1.2 状态: logic-flow 页面已加载且存在建筑产线区
  - [ ] 3.1.3 断言 build-flow-zone 内存在 2 个 build-flow-group #期望: [2]
  - [ ] 3.1.4 断言每个 group 内存在产线 card 和产出区 card #期望: [line-card和output-card均存在]
  - [ ] 3.1.5 断言产线 card 内显示产线名称、产线建材标签和产线原材料标签 #期望: [title、buildMaterialTag、sourceTag均存在]

- [ ] 3.2 Case: 分组算法连通分量验证
  - [ ] 3.2.1 在 logic-flow 页面，给定产线 A 提供 hullparts 且需 graphene，产线 B 提供 graphene 且需 hullparts，产线 C 提供 refinedmetals 且无建材需求
  - [ ] 3.2.2 状态: logic-flow 页面已加载且存在建筑产线区
  - [ ] 3.2.3 断言 build-flow-zone 内存在 2 个 build-flow-group #期望: [2]
  - [ ] 3.2.4 断言第一个 group 的 groupKey 包含产线 A 和 B 的 groupId #期望: [groupKey包含A:B]
  - [ ] 3.2.5 断言第二个 group 的 groupKey 仅包含产线 C 的 groupId #期望: [groupKey仅包含C]
  - [ ] 3.2.6 断言第一个 group 的产出区包含 hullparts 和 graphene #期望: [outputTags包含hullparts和graphene]
  - [ ] 3.2.7 断言第二个 group 的产出区包含 refinedmetals #期望: [outputTags包含refinedmetals]

- [ ] 3.3 Case: 菜单绑定产线原材料到产线建材
  - [ ] 3.3.1 在 logic-flow 页面，给定产线 A 提供 hullparts（source tag）且产线 B 的产线建材包含 hullparts（target tag），且在同一分组
  - [ ] 3.3.2 状态: 建筑产线区显示分组容器
  - [ ] 3.3.3 在产线 A 的 card 内定位 hullparts 的 source-tag
  - [ ] 3.3.4 切换: 点击来源标签 + -> 打开目标菜单
  - [ ] 3.3.5 断言菜单内包含产线 B 的产线建材目标项 #期望: [目标项文本包含产线B名称]
  - [ ] 3.3.6 切换: 点击菜单项 -> 建立绑定关系
  - [ ] 3.3.7 断言产线 B 的 hullparts target-tag 变为绑定状态 #期望: [unbind按钮存在]
  - [ ] 3.3.8 断言 SVG edge 从产线 A source-tag 指向产线 B target-tag #期望: [edge元素存在]

- [ ] 3.4 Case: 目标标签菜单绑定产线原材料到产出区
  - [ ] 3.4.1 在 logic-flow 页面，给定产出区包含 hullparts（target tag），产线 A 提供 hullparts（source tag），且在同一分组
  - [ ] 3.4.2 状态: 建筑产线区显示分组容器
  - [ ] 3.4.3 在产出区 card 内定位 hullparts 的 target-tag
  - [ ] 3.4.4 切换: 点击目标标签 + -> 打开来源菜单
  - [ ] 3.4.5 断言菜单内包含产线 A 的来源项 #期望: [来源项文本包含产线A名称]
  - [ ] 3.4.6 切换: 点击菜单项 -> 建立绑定关系
  - [ ] 3.4.7 断言产出区的 hullparts target-tag 变为绑定状态 #期望: [unbind按钮存在]
  - [ ] 3.4.8 断言 SVG edge 从产线 A source-tag 指向产出区 target-tag #期望: [edge元素存在]

- [ ] 3.5 Case: 覆盖绑定关系
  - [ ] 3.5.1 在 logic-flow 页面，给定产线 A、B、C 在同一分组，产线 A 的 hullparts source-tag 已绑定到产线 B 的 hullparts target-tag
  - [ ] 3.5.2 状态: 标签绑定关系已建立
  - [ ] 3.5.3 在产线 C 的 card 内定位 hullparts 的 source-tag
  - [ ] 3.5.4 切换: 点击来源标签 + -> 打开目标菜单
  - [ ] 3.5.5 断言菜单内产线 B 的目标项显示为已绑定状态（颜色标识）#期望: [目标项class包含other绑定样式]
  - [ ] 3.5.6 点击菜单内产线 B 的目标项
  - [ ] 3.5.7 断言产线 B 的 hullparts target-tag 绑定来源变为产线 C #期望: [edge重新指向产线C]
  - [ ] 3.5.8 断言仅存在一条 edge 指向产线 B 的 target-tag #期望: [edge数量为1]

- [ ] 3.6 Case: 解绑移除连线
  - [ ] 3.6.1 在 logic-flow 页面，给定产线 A 的 hullparts source-tag 已绑定到产线 B 的 hullparts target-tag
  - [ ] 3.6.2 状态: 标签绑定关系已建立
  - [ ] 3.6.3 切换: 点击解绑按钮 -> 移除绑定关系
  - [ ] 3.6.4 断言产线 B 的 hullparts target-tag 恢复未绑定状态 #期望: [标签背景透明]
  - [ ] 3.6.5 断言 build-flow-group 内不存在指向产线 B 的 edge #期望: [对应edge不存在]

- [ ] 3.7 Case: 解绑后重新绑定
  - [ ] 3.7.1 在 logic-flow 页面，给定产线 A 的 hullparts source-tag 已绑定到产线 B 的 hullparts target-tag，产线 C 也提供 hullparts
  - [ ] 3.7.2 状态: 标签绑定关系已建立
  - [ ] 3.7.3 切换: 点击解绑按钮 -> 移除绑定关系
  - [ ] 3.7.4 在产线 B 的 target-tag 上执行解绑
  - [ ] 3.7.5 切换: 点击目标标签 + -> 打开来源菜单
  - [ ] 3.7.6 在产线 B 的 target-tag 上点击 + 按钮
  - [ ] 3.7.7 切换: 点击菜单项 -> 建立绑定关系
  - [ ] 3.7.8 选择产线 C 作为新来源
  - [ ] 3.7.9 断言产线 B 的 target-tag 绑定产线 C #期望: [edge指向产线C]

- [ ] 3.8 Case: 规划区拖拽时建筑产线区隐藏
  - [ ] 3.8.1 在 logic-flow 页面，给定建筑产线区已渲染
  - [ ] 3.8.2 状态: logic-flow 页面已加载且存在建筑产线区
  - [ ] 3.8.3 在规划区候选区定位一个 ware 标签
  - [ ] 3.8.4 切换: 规划区拖拽开始 -> 建筑产线区隐藏
  - [ ] 3.8.5 执行候选区 ware 拖拽到规划区的完整流程
  - [ ] 3.8.6 断言拖拽结束后 build-flow-zone 恢复显示 #期望: [元素visible]

- [ ] 3.9 Case: 建筑流拖拽不隐藏建筑产线区
  - [ ] 3.9.1 在 logic-flow 页面，给定产线 A 提供 hullparts，产线 B 的产线建材包含 hullparts，且在同一分组
  - [ ] 3.9.2 状态: 建筑产线区显示分组容器
  - [ ] 3.9.3 在产线 A 的 card 内定位 hullparts 的 source-tag
  - [ ] 3.9.4 在 source-tag 上触发 dragstart 事件
  - [ ] 3.9.5 断言 build-flow-zone 仍然可见 #期望: [元素visible]
  - [ ] 3.9.6 切换: 规划区拖拽开始 -> 建筑产线区隐藏
  - [ ] 3.9.7 断言建筑流拖拽与规划区拖拽行为不同 #期望: [build-flow-zone在建筑流拖拽时不隐藏]

- [ ] 3.10 Case: 归档产线排除需求原材料计算
  - [ ] 3.10.1 在 logic-flow 页面，给定产线 A（提供 hullparts，需 graphene）和产线 B（提供 graphene）
  - [ ] 3.10.2 状态: 建筑产线区显示分组容器
  - [ ] 3.10.3 断言产线 A 的产线建材包含 graphene #期望: [buildMaterialTag包含graphene]
  - [ ] 3.10.4 切换: 点击产线归档按钮 -> 产线从建筑产线区消失
  - [ ] 3.10.5 在产线 A 的 card 内点击归档按钮
  - [ ] 3.10.6 断言产线 B 的产线建材不再包含 graphene #期望: [buildMaterialTag不包含graphene]

- [ ] 3.11 Case: 归档产线清理相关绑定
  - [ ] 3.11.1 在 logic-flow 页面，给定产线 A 的 hullparts source-tag 已绑定到产线 B 的 hullparts target-tag
  - [ ] 3.11.2 状态: 标签绑定关系已建立
  - [ ] 3.11.3 切换: 点击产线归档按钮 -> 产线从建筑产线区消失
  - [ ] 3.11.4 在产线 A 的 card 内点击归档按钮
  - [ ] 3.11.5 断言产线 B 的 hullparts target-tag 恢复未绑定状态 #期望: [unbind按钮不存在]
  - [ ] 3.11.6 断言不存在指向产线 A 的 edge #期望: [edge不存在]

- [ ] 3.12 Case: 归档 Modal 恢复产线
  - [ ] 3.12.1 在 logic-flow 页面，给定产线 A 已被归档
  - [ ] 3.12.2 状态: logic-flow 页面已加载且存在建筑产线区
  - [ ] 3.12.3 断言产线 A 的 card 不在 build-flow-zone 内 #期望: [card不存在]
  - [ ] 3.12.4 切换: 点击标题栏归档按钮 -> 打开归档 Modal
  - [ ] 3.12.5 断言 Modal 内包含产线 A 的归档项 #期望: [产线A名称存在]
  - [ ] 3.12.6 切换: 点击恢复按钮 -> 产线恢复到建筑产线区
  - [ ] 3.12.7 在产线 A 的归档项内点击恢复按钮
  - [ ] 3.12.8 断言产线 A 的 card 重新出现在 build-flow-zone #期望: [card元素存在]
  - [ ] 3.12.9 断言产线 A 重新参与分组计算 #期望: [groupKey包含产线A]

- [ ] 3.13 Case: 归档多条产线后 Modal 列表验证
  - [ ] 3.13.1 在 logic-flow 页面，给定产线 A 和产线 B 均已归档
  - [ ] 3.13.2 状态: logic-flow 页面已加载且存在建筑产线区
  - [ ] 3.13.3 切换: 点击标题栏归档按钮 -> 打开归档 Modal
  - [ ] 3.13.4 断言 Modal 内包含 2 条归档产线 #期望: [归档产线数量为2]
  - [ ] 3.13.5 切换: 点击恢复按钮 -> 产线恢复到建筑产线区
  - [ ] 3.13.6 在产线 A 的归档项内点击恢复按钮
  - [ ] 3.13.7 断言 Modal 内仅剩产线 B #期望: [归档产线数量为1]
  - [ ] 3.13.8 在产线 B 的归档项内点击恢复按钮
  - [ ] 3.13.9 断言 Modal 自动关闭 #期望: [modal不存在]

- [ ] 3.14 Case: 跨组绑定无效
  - [ ] 3.14.1 在 logic-flow 页面，给定产线 A 在组 1（提供 hullparts），产线 B 在组 2（产线建材包含 hullparts）
  - [ ] 3.14.2 状态: 建筑产线区显示分组容器
  - [ ] 3.14.3 在产线 A 的 card 内定位 hullparts 的 source-tag
  - [ ] 3.14.4 切换: 点击来源标签 + -> 打开目标菜单
  - [ ] 3.14.5 断言菜单内不包含产线 B 的目标项 #期望: [目标项列表不包含产线B名称]
  - [ ] 3.14.6 在产线 A 的 source-tag 上触发 dragstart 事件
  - [ ] 3.14.7 在产线 B 的 hullparts target-tag 上触发 drop 事件
  - [ ] 3.14.8 断言产线 B 的 target-tag 保持未绑定状态 #期望: [unbind按钮不存在]

- [ ] 3.15 Case: 保存方案包含建筑流绑定
  - [ ] 3.15.1 在 logic-flow 页面，给定产线 A 的 hullparts source-tag 已绑定到产线 B 的 hullparts target-tag
  - [ ] 3.15.2 状态: 标签绑定关系已建立
  - [ ] 3.15.3 执行保存当前方案操作
  - [ ] 3.15.4 切换到其他 logic-flow 方案
  - [ ] 3.15.5 切换回原方案
  - [ ] 3.15.6 断言产线 B 的 hullparts target-tag 保持绑定状态 #期望: [unbind按钮存在]
  - [ ] 3.15.7 断言 edge 从产线 A 指向产线 B #期望: [edge存在]

- [✗] 3.16 Case: 加载旧版方案无 buildFlow 字段
  - [✗] 3.16.1 在 logic-flow 页面，加载一个不含 buildFlow 字段的旧版 LogicFlowPlan
  - [ ] 3.16.2 状态: logic-flow 页面已加载且存在建筑产线区
  - [ ] 3.16.3 断言 build-flow-zone 正常渲染 #期望: [元素存在]
  - [ ] 3.16.4 断言所有 target-tag 处于未绑定状态 #期望: [unbind按钮不存在]

## 4 Bug 测试

(空章节 - 无已知 bug)
