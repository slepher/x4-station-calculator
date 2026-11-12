# 实施期间发现的问题

## BUG-7：复用保存弹窗后仍覆盖标题且默认名称显示翻译键

- 命名弹窗仍传入“保存左侧方案”自定义标题，且引用不存在的 `shipBuild.default_blueprint_name`。
- 已移除命名场景的标题覆盖，使用原“另存方案”；未命名方案按操作侧船型翻译名加“蓝图”生成默认名称，无船型名称时使用已有 `menu.default_blueprint_name`。
- 中英文、单船和右侧保存命名检查通过；双侧身份仍在内部绑定。相关 22 项 focused Unit 和生产构建通过，待用户确认视觉表现。

## BUG-1：另存为共享可变蓝图对象

- 旧 `saveAsBlueprint` 将同一个对象同时放进蓝图库和工作区，后续编辑可能直接污染保存记录。
- 本次改为独立深拷贝；`ship-equip-compare.spec.ts` 检查双方 connections/storage 和保存记录的隔离，单船 load-clone 回归通过。
- 状态：实现修正，最终验证由 `/x4:verify ship-equip-compare` 执行。

## BUG-2：存储写入失败仍更新保存基线

- 旧存储函数捕获异常后不返回失败，上层仍更新快照并可能继续退出。
- 新逐侧保存先准备独立记录，写入成功后才更新身份和基线；失败保持工作上下文。Unit 通过模拟 `Storage.setItem` 抛错验证。
- 状态：实现修正，最终验证由 `/x4:verify ship-equip-compare` 执行。

## BUG-3：显式保存接口迁移后的单船兼容回归

- 首轮 focused Unit 中 `ship-build-storage.spec.ts` 的 5 项失败：旧直接 `saveBlueprint()` 入口可创建记录，新逐侧接口返回了 needs-name。
- 单船旧入口保留创建语义，UI 未命名方案仍通过绑定身份的命名对话框另存为。
- 该文件重跑 29/29 通过；最终验证由 `/x4:verify ship-equip-compare` 执行。

## BUG-4：蓝图菜单项居中回归

- 菜单项从 div 改为可禁用 button 时漏掉显式对齐，按钮默认居中改变了两侧原有外观。
- 修正：共用菜单项明确 text-align: left，保留禁用逻辑与原浮层。

## BUG-5：错误移除右侧标题镜像

- 将去掉 A/B 标记误解为取消右侧头部镜像，导致右侧船型和蓝图入口布局与要求不符。
- 修正：恢复仅 compare+B 生效的头部、入口内部、收藏和 dirty 标记反向排列，镜像单侧 padding/margin；不翻转文字或非方向性图标。
- 两项均为样式修正，复用已有默认／选择器／返回单船及蓝图菜单的 focused Unit；实际视觉效果待用户确认，不宣称已验收。

## BUG-6：共享弹窗布尔属性默认值回归

- 迁移 Unit 检查发现新增可选 autoClose 被 Vue 按 Boolean 属性缺省转换为 false，旧调用未自动关闭。
- 已通过 withDefaults 显式设为 true；仅双侧保存流程传 false，旧保存与导入流程保留自动关闭。

## BUG-8：对比删除未清理当前蓝图名称与身份
- 原因：对比删除分支只更新保存列表便返回，跳过原单船清空名称和身份的行为；菜单删除还引入不必要的全会话保护。
- 修正：另一侧保存蓝图禁止删除；当前侧删除成功后保留配装、清空名称和身份并 dirty。移除删除的全会话保护。统一两侧状态标签，修正空配删除后左侧留空的差异。
- focused Unit 覆盖跨侧拒绝、本侧删除、自定义状态、未保存另一侧不限制和菜单禁用；完整验证交由 x4:verify。

## BUG-9：混淆已保存蓝图应用预设与未保存预设
- 原规则见 archive/2026-03-09-blueprint-preset/request.md：已保存蓝图应用预设必须保留名称，按实际变化显示红点；删除保存目标后选择预设才显示预设名。
- 上轮错误地让两种状态都显示预设名，并隐藏已保存方案的红点；新增测试也错误断言切换名称。撤销这一行为及对应文档描述，保留未保存预设的高亮支持。
- 修正：已有保存目标应用预设时不设置预设标记；保留保存基线、名称及身份。A／B 参数化组件测试直接检查名称、红点 DOM、当前高亮、dirty、保存条目数、删除后重新选高配及另一侧不变。
- RED：按正确规则修改测试后 A／B 均失败（错误显示 High）；GREEN：实现修正后四文件 61 项通过。完整验证交由 x4:verify。

## BUG-10：选择器锁阻断同侧具体槽位切换
- 原因：Fit 与 workspace 两处 openPicker 把已打开的同侧选择器当成全局禁止操作状态，点击另一具体槽位直接返回；大类型入口因先关闭选择器未受影响。
- 修正：允许同侧选择器重入，保留跨侧及命名／保护限制，复用原目标 watcher 重置预览。
- focused Unit 分别从 A／B 的引擎切换到附属护盾，确认旧预览不写入、最终只应用护盾；完整验证交由 x4:verify。

## BUG-11：切换已装备槽位后候选误选空装备
- 原因：新槽位类型与当前装备更新早于 pickerTarget，同步候选校验曾以中间状态候选列表判定当前装备不兼容并 emit null。
- 修正：候选合法性校验使用 post flush，在槽位／筛选状态更新完后执行。
- RED：A 已装备引擎→附属护盾复现 highlightedEquipmentId=null 而实际护盾存在；GREEN：A／B 已装备槽位来回切换及原空槽位切换用例通过，workspace 22 项通过。完整验证交由 x4:verify。

## BUG-12：对比会话修改装备时属性面板位置偏离原布局
- 原因：双船修改模式将装备详情放到中间候选列表下方，属性栏只显示舰船属性，右侧编辑时左栏看不到装备对比。
- 修正：复用原单船布局，在属性栏先放装备对比，再放舰船修改前后属性；A／B 镜像位置一致。
- A／B 组件测试实际点击不同装备候选，检查属性栏内装备面板顺序与非空且不同的当前／目标值；修正前两例失败，修正后相关两文件 43 项通过。

## BUG-13：筛选误将当前选择改为空装备
- Chrome 复现：ARG 装备被 TERRAN 筛选隐藏后，校验 watcher emit null，误成为空槽位预览。
- 修正：筛选不清除候选选择；列表隐藏该装备时无高亮，重新显示时恢复高亮。A／B 组件用例验证筛选前后选中 ID 不变及高亮消失／恢复。
- 另存为补充 Esc 取消测试；退出保护正文包含蓝图名，标题独立。原空槽位显示旧装备详情按用户确认保留。

## BUG-14：跨尺寸炮塔分组默认空装备
- Confirmed：Chrome 巨像 L 炮塔→M1 默认空，确认清空两座炮塔；A／B Unit 均复现 currentEquipmentId 仍为 L 炮塔。
- 修正目标：目标 watcher 同步完整 picker 上下文并在分组映射后执行。

- Fixed：本轮 focused Unit 修正后通过；提交 04c8911e 后刷新 Chrome，人工交互复检通过。未运行完整 x4:verify，不标为完整 Verified。

## BUG-15：左侧换船重置双侧
- Confirmed：左侧旧入口使用 guardSession/resetComparison；换船会保护 B 并结束对比。右侧无此行为。Unit 复现 A 无法独立完成替换。
- 修正目标：两侧共用目标侧选型，取消保持布局，确认仅替换本侧。

- Fixed：本轮 focused Unit 修正后通过；提交 04c8911e 后刷新 Chrome，人工交互复检通过。未运行完整 x4:verify，不标为完整 Verified。

## BUG-16：无输入的保护弹窗直接 Esc 无效
- Confirmed：Chrome 焦点停留 body 或背景按钮；挂载到 document.body 的 Unit 复现焦点不在 dialog。
- 修正目标：无输入时聚焦 dialog 根节点。

- Fixed：本轮 focused Unit 修正后通过；提交 04c8911e 后刷新 Chrome，人工交互复检通过。未运行完整 x4:verify，不标为完整 Verified。

## BUG-17：编辑后详细属性模式丢失
- Confirmed：详细模式退出编辑后只剩 21 个 summary 指标，Unit 预期 36 失败。
- 修正目标：workspace 保存模式，MetricsPanel 不因 views 重算重置有效选择。


- Fixed：本轮 focused Unit 修正后通过；提交 04c8911e 后刷新 Chrome，人工交互复检通过。未运行完整 x4:verify，不标为完整 Verified。

## BUG-18：混合分组未选择确认误清空
- Confirmed：Chrome 巨像 M1 与其他 M 炮塔不同，简化模式多种类型 16/16 打开默认空槽，确认变为 0/16；右侧默认同样为空。
- 原因：pickerInitialEquipmentId 将 __mixed__ 转为 null，确认无从区分未选择与明确卸装。
- 修正：保留 mixed 标识，未选择无预览且确认不写入；显式空候选仍可清空。
- Unit：A／B 覆盖无选择确认、主动空候选取消及重开、主动空候选确认、另一侧不变。
- Fixed：本轮 RED 两侧默认高亮为空均失败；GREEN workspace 32 项通过，npm run build 通过。453145a8 提交后刷新 Chrome，A／B 无选择确认、空候选取消重开、明确空候选确认均通过。

## BUG-19：预设清理后干扰弹显示残留并写回
- Confirmed：Chrome 双侧热焰弹 40 选择高配后实际清零但局部显示残留，调整导航信标又写回 40。
- 最终规则：所有预设完整替换，未定义补给清零，明确无人机规则照常；空配全部清空。
- 修正：空 countermeasure 初始化时重置局部滑块为 0。
- Fixed：focused Unit 48 项、构建通过；Chrome A／B 高配清理、追加信标后热焰弹不回写、重开 C 数量正确，空配分别将双侧无人机从 20 清至 0。尚未执行完整 x4:verify。

## BUG-20：右侧收藏标题不更新且保存撤销收藏
- Confirmed：Chrome 右侧标题点击收藏仍显示添加，菜单已显示取消；随后保存使菜单恢复未收藏。左侧标题正常更新。
- 原因：toggleFavoriteBlueprint 只同步全局 A 工作副本，B 保存时写回旧 favorite。
- 修正：按 ID 同步双侧工作副本，仅修改匹配对象 favorite。
- Fixed：RED B 侧标题高亮断言失败；GREEN 34 项 workspace 组件测试通过，构建通过。Chrome 双侧收藏／取消后保存、右侧菜单收藏同步标题、刷新后重开对比保留最后收藏状态均通过。未执行完整 x4:verify。

## BUG-21：数量变化重置已选择装备候选
- Confirmed：Chrome 双侧巡航引擎候选在数量 2→1 时跳回现装均衡引擎。
- 原因：pickerTarget 数量变化生成新对象，watcher 无条件重新初始化候选。
- 用户确认：数量即时生效，取消只取消装备选择，不能回滚数量。
- Fixed：RED A／B 候选均被重置，GREEN 36 项 workspace 组件测试通过，构建通过。Chrome 双侧巡航引擎候选在调整数量后保持，取消保留原装备与 1/2 数量，重开恢复现装默认，确认安装巡航引擎 1/2；另一侧不变。未执行完整 x4:verify。

## BUG-22：预设仅修改补给后仍显示高配且无红点
- Confirmed：本轮完整矩阵审计，A 未保存磁星高配采矿无人机 9→0、B 未保存新星高配热焰弹 0→4／信标 0→50，均仍显示高配且无 dirty dot。
- 原因：getPlanPresetId / getPlanStatusLabel 只比较 connections，不包含 storage；Fit 的 isBuiltInPresetUnchanged 因而压制红点。
- 影响：补给已变化但预设状态未反映，默认命名仍为高配系列；实际保存和刷新数量正常。
- Fixed：后续授权修复，预设快照包含四类补给 ID／数量。RED 双侧错误显示 High；GREEN 52 项 focused Unit 和构建通过。Chrome 双侧补给修改显示自定义和红点，恢复数量后恢复高配；菜单高亮对应更新，保存后保留蓝图名称。未执行完整 x4:verify。原审计见 interaction-audit-2026-11-12.md M21。
