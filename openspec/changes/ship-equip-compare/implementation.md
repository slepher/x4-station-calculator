# 实施记录

## 范围

- 当前目录实现，未创建 worktree、提交或归档。
- Store 保存独立 A/B 工作上下文、会话身份、保存目标和基线；按 shipId 精确筛选，createdAt 降序、ID 升序初始化 B。新建空配装与已保存候选都取 clean 基线。
- Store 内部复用原有属性公式；连接键解析使用该键所属船体，预览与确认显式接受侧。工作区、配装、装备选择、仓储和属性展示通过 presenter。
- 默认、A 选择、B 选择精确映射三个逻辑区域。仅一个共享对比面板；B 配装镜像，保留 B 返回单船后恢复普通布局。
- 对比保留原 36 个整船指标，不新增槽位数量指标。双方 class 默认刻度取高，雷达统一转换为 km，实际超限裁剪条形，缺失和零有独立分支，低值优先指标使用对应颜色方向。
- 工具栏和 Ctrl/Cmd+S、Shift+Ctrl/Cmd+S 定向保存当前侧；命名绑定侧及 sessionId。选择器期间锁定保存和会话变更。
- 退出、替换、新建、载入、删除、版本切换及船只蓝图导入接入关闭侧或 A→B 保护。取消命名或写入失败不继续释放工作上下文。
- 对比 UI 状态没有写入持久化格式。未修改 Rust。

## 验证

当前 Node 的实验性 Web Storage 会遮蔽 jsdom 的 localStorage，因此 focused Unit 使用环境参数：

```sh
NODE_OPTIONS=--no-experimental-webstorage npm run test:unit -- tests/unit/ship/ship-equip-compare.spec.ts tests/unit/ship/ship-equip-compare-workspace.spec.ts tests/unit/ship/ship-fit-single-candidate-count.spec.ts tests/unit/ship/ship-build-storage.spec.ts tests/unit/ship/ship-stats-average-recharge.spec.ts
```

最终相关变更后结果：5 个文件，59 项通过。新增两个对比测试文件共 17 项，覆盖独立保存与失败、默认候选、预览隔离、不同船体、同 ID 拒绝、三栏与镜像、逐侧退出保护、命名身份、工具栏及快捷键、默认刻度和原生反向 range 契约。

```sh
NODE_OPTIONS=--no-experimental-webstorage npm run test:unit -- tests/unit/ship/ship-dlc.spec.ts tests/unit/ship/ship-build-storage-dirty-storage.spec.ts tests/unit/ship/ship-build-material.spec.ts tests/unit/common/x4-dual-phase-range-slider.spec.ts
```

结果：4 个文件，28 项通过。

另已按影响范围运行并通过：`ship-build-stat.spec.ts`、`ship-build-load-clone.spec.ts`、`ship-build.spec.ts`、`ship-build-empty-dirty.spec.ts`、`ship-equipment-selector.spec.ts`、`ship-equipment-picker.logic.spec.ts`、`production/metric-panel-ui.spec.ts`。重跑仅针对后续改动与失败。

- `npm run build`：最终源码修改后通过。仅有 Vite 的大 chunk 提示。
- `git diff --check`：通过。
- OpenSpec CLI 不在本环境中；直接依据 request/design/spec/tasks 执行，未声称 CLI 状态检查通过。

## 后续验证边界

- 本次未运行 E2E 或全量 Unit，也未做浏览器视觉验收。
- 反向数量控件使用原生 `input[type=range] dir=rtl`，不实现自定义坐标或键盘换算。Unit 验证方向属性、范围、步长、填充及 input/change 提交契约；真实浏览器指针和键盘行为由后续 E2E 覆盖。
- 相关问题记录于 bugs.md。后续运行 `/x4:verify ship-equip-compare` 和对应 E2E 工作流，由用户验证后再决定提交。

## 用户界面修订（2026-11-12，优先于下方原规划的对应描述）

- 对比复用原 ShipBuildPanelStats / MetricsPanel 的双列指标、简略／详细切换和数值＋差值条形，不新增独立视觉布局。
- B 蓝图入口与 A 共用原浮层（包含预设、保存蓝图及原操作），仅向左弹出；选择和预设只作用于操作侧，禁止两侧使用同一保存 ID。
- 删除可见 A/B 标记及顶部编辑对象切换；点击配装面板确定内部编辑侧。保存按钮沿用“保存”，保护对话框用左／右侧方案说明对象。
- 船型与蓝图入口保留原头部位置；右侧只保留配装内容区的镜像与蓝图箭头／浮层的向左方向。

本次 UI 修订另补充右侧原浮层方向、预设只修改右侧及复用原 Stat 的 Unit 检查。

## B 选型复用与回退检查（2026-11-12）

- 删除自行设计的 B 船型／蓝图搜索列表弹窗及其 search/choices 通用列表逻辑。B 选型复用 ShipBuildSelectorView，通过 side 参数将确认结果提交到 B，取消不改变双方工作副本。
- 已移除独立 ShipBuildCompareStats.vue；工作台直接使用原 ShipBuildPanelStats。保留原 Stat 排布、样式、档位和目标值＋差值呈现。
- 已移除 A/B 标记、编辑对象切换栏与头部位置交换。右侧蓝图使用同一个原浮层，只有方向向左；预设也由同一路径按侧应用。
- 必须保留：独立工作上下文与保存目标、默认候选规则、预览／确认路由、三栏切换、共享默认刻度、同 ID 限制、逐侧丢弃保护。这些是数据正确性，不应随重复 UI 一并撤掉。
- 保存界面已收敛：删除 ShipBuildCompareDialogs，命名和保护均复用工具栏现有 SmartSaveDialog 实例；保留侧和会话身份绑定。useShipBuildCompareStatsPresenter 只负责数据组装，可进一步并入原 Stat presenter，不应再发展为独立界面。
- 右侧装备栏、数量滑条和蓝图浮层方向是此前明确要求的差异；不扩散到原船型选择器和头部入口布局。

本轮 focused Unit：工作台 13 项、原选型筛选生命周期 5 项、原 Stat 15 项、通用指标 4 项通过。生产构建通过；未执行 E2E 或用户验收，未提交。

## 统一保存／退出保护界面（2026-11-12）

- 删除 ShipBuildCompareDialogs.vue，工具栏只使用原 SmartSaveDialog；未复制模板或维护第二套样式。
- SmartSaveDialog 接受可选方案上下文及 autoClose=false。旧调用默认仍自动关闭，import 事件与 SmartSaveStep 策略不变。
- 船只 presenter 负责捕获侧与 sessionId、解释 SAVE/SAVE_AS/NEW 步骤、成功后继续退出或处理下一侧。NEW 在保护上下文表示继续已绑定动作，不是无条件新建方案。
- 写入失败、空名称、失效会话均保留当前弹窗和工作副本；关闭按钮取消整个待执行动作。A 保存后继续 B 时同一弹窗更新方案名和输入状态，取消不撤销先前已成功保存。
- ship-equip-compare-smart-save.spec.ts 覆盖实际共享弹窗与工具栏：失败重试、未保存方案命名及取消、A→B 顺序、绑定身份、旧调用自动关闭及 import 兼容。

## 中间属性区对比按钮（2026-11-12）

- 展开／退出使用相同的 compare-toggle 描边样式，均置于原 Stat 的标题动作区；移除配装标题上的展开按钮。
- 默认退出保留左侧，只保护将关闭的右侧。右侧 clean 直接退出；dirty 时共享 SmartSaveDialog 提供保存、放弃和取消。保存失败、命名失败或取消不关闭会话；左侧未保存修改不被自动保存。
- 保留右侧操作反向保护左侧，完整提升右侧工作上下文；选择器期间禁止退出。

### 默认名称及识别风险审查（2026-11-12）
- Workspace presenter 统一默认名称为当前状态 + 最小未占用正整数；工具栏旧船型命名入口复用此方法。仅未命名方案使用默认值，已有名称不变。
- 中英文 Unit 验证 B 高配首次保存为序号 1，另一船型 A 高配随后默认序号 2；smart-save 与 workspace 两文件合计 23 项通过。
- 用户截图确认舰队选择列表已有舰船名称分组，不能将 FleetGoalCard 单独条目的代码观察泛化为舰队界面缺少船名；本次不提出舰队界面修改。
- FleetGoalSearchBox.vue:221 按船型显示分组标题，配装蓝图菜单也限定当前船型且有船型标题，本次短名称没有丢失船型上下文。
- TransitTransportShipSelector.vue:92 有船型分组，但 :97 起的蓝图行不显示 name，仅显示引擎／性能；同船相似配装原本就难区分。按用户要求仅记录到本 change 的 spec，暂不修改，不列为本次完成阻塞项。
- 未修改上述审查发现涉及的其他界面；保存、载入、舰队及运输选择以 ID 关联，不因默认名称变化而改绑。

### 已保存蓝图与未保存预设的显示规则
恢复原规则：已有保存目标应用预设时保留蓝图名、高亮和保存目标，根据保存基线显示红点。没有保存目标时才显示预设名及预设高亮，原样预设不显示红点。菜单高亮和悬停背景统一覆盖包含操作按钮的整行，与默认配装等宽。
参数化组件测试分别验证 A／B：选高配有变化时名称不变且显示红点→保存更新原记录不新增→再次选相同高配无变化不显示红点→删除后自定义和红点→再次选高配显示预设名、高亮、无红点且需另存；另一侧不变。修正前两例 RED，修正后四文件 61 项 Unit 通过。样式宽度是 CSS 修改，未通过 jsdom 假测布局尺寸。

### 修改配装期间的比较范围
选择器打开时复用原 Stat 单船预览，current 为操作侧工作副本、target 为该侧预览；隐藏所有展开／退出／保留侧对比操作。关闭选择器后恢复双方对比。新增两侧跨船型组件用例，检查输入归属、操作隐藏、取消恢复及副本不变；相关两文件 25 项通过，构建通过。

### 同侧具体槽位直接切换
Fit 和 workspace 的选择器入口允许同侧重入；跨侧和命名／保护弹窗仍拒绝。复用目标 watcher 丢弃旧预览并更新候选、详情及属性输入，大类型入口保持原行为。A／B 组件测试实际点击引擎再点击附属护盾，检查高亮、目标、未写入旧预览以及确认后只装备护盾。相关两文件 27 项 Unit 通过，构建与 diff 检查通过。

### 切换槽位默认选中已安装装备
候选校验移至 post flush，避免槽位信息更新的中间态误清空选中装备。A／B 已装备引擎与附属护盾来回切换测试覆盖 currentEquipmentId 和 highlightedEquipmentId，空槽位用例保留。workspace 22 项及选择器／装备面板／单候选回归 36 项通过，共 58 项；构建和 diff 检查通过。

### 装备属性对比位置恢复
从候选列表下方移回属性栏顶部，复用单船装备对比布局，A 右栏／B 左栏。两侧实际点击候选的组件用例检查位置和比较数据，相关两文件 43 项通过。

### 双侧标题保存入口
名称框内加入独立保存图标，A 位于名称左、B 位于名称右；原菜单按钮与保存按钮共享边框而不嵌套。菜单另存为使用独立分组。两入口经 Fit presenter 绑定所在侧并复用 workspace 保存与 SmartSaveDialog。两侧组件测试覆盖全局编辑侧不同仍保存正确侧、无目标命名、另存为关闭菜单、选择器锁定；相关两文件 35 项通过，构建及 diff 检查通过。

### 另存为默认新名称
已有保存目标时默认名称使用去掉尾部数字的名称主体加可用序号，避免原名及已有名称；保护提示仍引用原名。A／B SmartSaveDialog 实际输入与提交测试验证 High 1、High 2 已占用时另存为 High 3，原记录不变。相关两文件 37 项通过。

### 站内删除确认
新增通用纯 UI ConfirmDialog，按原 SmartSaveDialog 风格显示遮罩、名称、取消和删除。workspace 捕获侧、会话与记录并管理锁定，取消不删除，确认复用 store 删除与占用限制。A／B 原删除流程测试改为实际点击站内取消和确认按钮；相关两文件 37 项通过，构建及 diff 检查通过。

### 筛选与退出操作交互完善
筛选只隐藏高亮而不清空当前选择，重新可见即恢复；原空槽位详情表现保持。另存为 Esc 取消；保护文案分离标题与正文并包含蓝图名。退出按钮改为明确的左右保留操作，独立两列与属性条对齐。保存图标侧补充分隔线。两文件 37 项 Unit 通过，构建和 diff 检查通过；当前 Chrome 截图已核对两列对齐及左右镜像分隔线。

### 退出按钮回到标题行
根据最新反馈，将两个按钮移回标题行，短文案“保留左侧／保留右侧”加退出提示。使用对称网格使左按钮右边缘对齐左属性条右边缘、右按钮左边缘对齐右属性条左边缘；删除不再使用的 header-bottom 插槽。当前 Chrome 已截图核对中缝对齐。本轮仅布局与文案变化，无保存逻辑变更。

### 2026-11-12 交互审查修复
- 修复 BUG-14～17：跨尺寸目标同步、双侧独立换船、无输入保护弹窗焦点、属性视图模式保持；选型期间真实 DOM 包装隐藏 workspace。
- RED：两侧 L→M 当前装备未更新、A 换船不独立、详细 36 行退为 21 行及保护焦点失败。
- GREEN：ship-equip-compare 三文件 49 项，通用 metric-panel-ui 4 项通过；npm run build 通过。未运行完整测试或 Playwright。
- 按用户要求先提交修复，再通过当前 Chrome 进行跨船型及实际保存／另存／删除复检。

### 提交后 Chrome 人工复检（2026-11-12）
- 全局安装 @fission-ai/openspec，openspec --version 为 2.0.0。
- 04c8911e 后刷新 localhost:5174，避免热更新中的旧 store 闭包；左侧由 L 磁星换 XL 巨像，右侧保持；右侧再换 S 新星，左侧未保存高配保持。两侧取消选型均保持对比。
- 巨像两侧 L→M1／M2 默认选中 M 光束炮塔，直接确认仍为 2/2；详情同步，不再显示旧 L 炮塔。详细模式跨编辑、换船、保留侧退出及再展开保持。
- 保存测试蓝图“交互校验 1”；切低配后名称保持，保护正文正确，直接 Esc 关闭；普通保存后另存默认“交互校验 2”，确认产生独立记录。
- 另一侧换同船型自动选择非本侧“交互校验 1”，本侧“交互校验 2”在对侧菜单禁用选择及删除。
- 用户在实际删除时确认删除“交互校验 1”：删除后显示自定义，菜单记录移除；选高配恢复高配，再次保存重新命名为“交互校验 3”。
- 右侧低配修改经“保存并继续”退出；再展开载入已保存“交互校验 3”。左侧换 M 水星后右侧 XL 巨像不变；左侧高配未保存时保留右侧，选择“不保存并继续”，正确保留巨像。
- 最后停留 XL 巨像“交互校验 3”与 L 磁星“高配 3”的详细属性对比；保留测试蓝图 2、3，不要求恢复原数据。
- 本轮未再复现 BUG-14～17。人工检查不是全量 E2E 或完整验证。
