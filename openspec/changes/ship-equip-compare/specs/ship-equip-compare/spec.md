# Ship Equip Compare Specification
## 用户界面修订（2026-11-12，优先于下方原规划的对应描述）

- “展开对比”位于属性标题区；双侧对比时，“保留左侧／保留右侧”放在标题行内，左按钮右边缘对齐左列属性条右边缘、右按钮左边缘对齐右列属性条左边缘。选择装备期间隐藏这些操作。
- 对比复用原 ShipBuildPanelStats / MetricsPanel 的双列指标、简略／详细切换和数值＋差值条形，不新增独立视觉布局。
- B 船型选择复用 A 的原 ShipBuildSelectorView，不新增弹窗、搜索列表或独立选型界面；确认只替换 B，取消保持原会话。
- B 蓝图入口与 A 共用原浮层（包含预设、保存蓝图及原操作），仅向左弹出；选择和预设只作用于操作侧，禁止两侧使用同一保存 ID。
- 保存、另存为及退出／替换保护统一复用原 SmartSaveDialog，不保留独立的对比弹窗；双侧上下文和保存成功后才继续的行为由 presenter 管理。
- 删除可见 A/B 标记及顶部编辑对象切换；点击配装面板确定内部编辑侧。保存按钮沿用“保存”，保护对话框用左／右侧方案说明对象。
- A 侧标题保持原样；右侧标题整体按原要求水平镜像，船型／蓝图入口、入口内部控件和收藏位置反向排列，文字保持正常可读；不添加 A/B 文字标记。两侧蓝图菜单项继续左对齐，右侧浮层向左弹出。


## Purpose

提供两份完整船只建造方案的独立编辑和属性对比，在固定三栏中复用装备选择器，并为全局保存和退出对比建立明确的对象归属。本增量定义对比模式；单船模式继续遵守现有 ship-build-stat 与 ship-status-diff 规则。

## ADDED Requirements

### Requirement: Independent Blueprint Comparison Session

系统 SHALL 在已有蓝图时直接展开对比，以 A 的具体 shipId 按默认蓝图选择规则初始化 B，保留 A 工作副本；B SHALL 可更换船型或载入不同 ID 的已保存蓝图，支持同船及跨 class。

#### Scenario: Add B Without Reloading A
- **前提**：A 有未保存配装修改。
- **当**：用户从蓝图名称旁展开对比。
- **那么**：A 的内容、保存基线和 dirty SHALL 保留，B SHALL 使用相同 shipId 下最新创建且不是 A 的已保存蓝图，无候选才创建空配装，不复制 A 的配装或保存身份，编辑对象初始化为 A。
- **并且**：B 初始 SHALL 为 clean，载入已有记录时绑定其保存目标，无候选的空配装首次保存 SHALL 另存为；无需先选保存蓝图即可进入三栏。

#### Scenario: Hidden Blueprint Remains Available
- **当**：某一侧船只面板因另一侧选择装备而隐藏。
- **那么**：该侧工作副本、保存身份和 dirty SHALL 保留，修改期间仅操作侧参与修改前后比较，不依赖 Vue 面板是否挂载。

### Requirement: Latest Created Blueprint For Target Ship

#### Scenario: Resolve Default Blueprint On Open Or Ship Change
- **当**：展开对比或为 B 确认不同船型。
- **那么**：系统 SHALL 精确按目标 shipId 筛选已保存蓝图，排除 A 当前蓝图 ID，按 createdAt 降序选最新创建的记录，不按 lastUpdated 排序，不包含内置预设。
- **并且**：createdAt 相同时 SHALL 按蓝图 ID 升序稳定选择；载入候选的船体与保存配装，绑定其保存目标及 clean 基线，不修改 A。

#### Scenario: No Other Saved Blueprint
- **前提**：目标船型无已保存蓝图，或排除 A 后候选为空。
- **当**：初始化或更换 B 船型。
- **那么**：系统 SHALL 创建目标 shipId 的空配装方案，明确无保存目标且以初始内容作为 clean 基线，首次保存 SHALL 另存为。
- **并且**：系统 MUST NOT 自动使用其他船型的蓝图或复制 A。

#### Scenario: Explicit Blueprint Selection
- **当**：用户通过 B 的“载入蓝图”明确选择有效的非 A 蓝图。
- **那么**：系统 SHALL 使用选定记录，不以默认创建时间排序替换用户选择。

### Requirement: Three Column Mirrored Equipment Editing

系统 SHALL 仅使用一个共用属性面板和三个逻辑栏位。

#### Scenario: Default Comparison Layout
- **当**：处于对比模式且无装备选择器打开。
- **那么**：从左到右 SHALL 为“船只 A、属性对比、船只 B”，建造材料栏隐藏。

#### Scenario: Edit Equipment On A
- **当**：A 打开装备选择器。
- **那么**：从左到右 SHALL 为“船只 A、A 选择器、属性对比”，B 船只面板隐藏。

#### Scenario: Edit Equipment On B
- **当**：B 打开装备选择器。
- **那么**：从左到右 SHALL 为“属性对比、B 选择器、船只 B”，A 船只面板隐藏。
- **并且**：装备详情 SHALL 放在选择器区域内，不新增栏位。

#### Scenario: Finish Equipment Selection
- **当**：用户确认或取消装备选择。
- **那么**：系统 SHALL 关闭选择器并恢复默认三栏，窄屏保持相同逻辑顺序。

### Requirement: Mirrored Right Ship Fit Panel

#### Scenario: Mirror Existing Fit Structure
- **当**：B 面板在默认对比或 B 选择装备状态显示。
- **那么**：系统 SHALL 基于现有配装结构镜像头部船型／蓝图入口及内部控件位置，将竖栏移到右侧、连接／分组与槽位标签从右排列、兼容性和卡片文字右对齐、数量移到左侧。
- **并且**：E/R/S/W/T/C/U 上下顺序 SHALL 保持，蓝图展开箭头 SHALL 朝左，文字、数字和非方向性图标 SHALL 正常阅读；仍点击装备卡片选择装备，不增加独立更换按钮。

#### Scenario: Mirrored Quantity Slider
- **当**：用户在 B 调整数量滑条。
- **那么**：最小值 SHALL 在右、最大值 SHALL 在左、填充 SHALL 从右向左增长，点击和拖动换算 SHALL 与该方向一致。
- **并且**：数值范围、步长及实时更新／提交语义 SHALL 保持原有规则，A 和单船滑条方向 SHALL 不变。

#### Scenario: Mirror Scope And Return To Single
- **当**：切换编辑侧、隐藏并恢复 B 或退出对比保留 B。
- **那么**：B 在对比模式 SHALL 保持镜像，成为单船后 SHALL 恢复普通布局。
- **并且**：共用属性与装备选择器 SHALL 不随 B 镜像，A/B 与 B − A 方向 SHALL 保持；C/U 仅调整分类入口位置，不扩展仓储子面板内部镜像。

### Requirement: Independent Metrics And Class Default Scale

系统 SHALL 使用各自船体与配装计算 A/B 值；差值 SHALL 固定为 B − A；每项上限 SHALL 取双方尺寸 class 的默认上限较大值。

#### Scenario: Different Hulls And Classes
- **前提**：A、B 属于不同 class，某项默认上限分别为 100、300，实际值分别为 20、40。
- **当**：显示该项。
- **那么**：共享上限 SHALL 为 300，差值为 +20，而非把 40 当作上限。
- **并且**：两侧质量、阻力、连接数量和装备 SHALL 来自各自方案。

#### Scenario: Same Class And Unit Conversion
- **前提**：A、B 属于相同 class。
- **当**：展示属性。
- **那么**：上限 SHALL 使用该 class 默认值；雷达等单位转换 SHALL 对实际值与默认上限采用一致口径。
- **并且**：槽位指标若显示，SHALL 取双方 `ship_slots` 对应槽位类型和装备尺寸的默认最大数量取高。

#### Scenario: Zero Missing And Overflow
- **当**：有效默认上限均为零、任一默认上限缺失或实际值超限。
- **那么**：零上限 SHALL 不绘制比例；缺失默认上限 SHALL 显示刻度不可用；超限 SHALL 保留真实数值与差值并裁剪条形。
- **并且**：系统 MUST NOT 用实际属性补齐或抬高上限，缺失实际值 SHALL 显示 `—` 且不计算该项差值，有效零值 SHALL 显示 0。

#### Scenario: Stable Comparison Direction
- **当**：用户切换编辑对象或属性面板移动位置。
- **那么**：A/B 标识、行序、简略／详细选项和 B − A 方向 SHALL 保持一致。
- **并且**：越低越好的指标 SHALL 按指标方向判断优劣，不把正差值统一解释为提升。

### Requirement: Side Scoped Preview Isolation

#### Scenario: Preview On Either Side
- **前提**：某侧选择器已打开，另一侧工作副本也有修改。
- **当**：高亮候选装备。
- **那么**：系统 SHALL 在操作侧工作副本的临时副本上预演，按该侧 connection/group 范围及 shield 映射规则计算。
- **并且**：属性面板 SHALL 复用单船预览界面，仅比较操作侧修改前工作值与修改后预览值，另一侧 SHALL NOT 参与此次比较；双方工作副本、保存数据和 dirty 均不因预览改变。
- **并且**：选择器打开期间 SHALL 不显示展开对比、退出对比、保留另一侧操作；确认或取消后 SHALL 恢复双方对比和对比操作。

#### Scenario: Confirm Or Cancel Preview
- **当**：确认选择。
- **那么**：只有操作侧的目标连接 SHALL 更新且重新计算 dirty，不自动保存。
- **当**：取消选择。
- **那么**：系统 SHALL 丢弃预览，双方工作副本保持不变。

### Requirement: Explicit Global Save Target

#### Scenario: Activate A Side
- **当**：用户点击某侧配装面板、操作其装备或使用顶部编辑对象切换。
- **那么**：该侧 SHALL 成为全局保存／另存为对象，按钮明确显示“保存 A”或“保存 B”。
- **并且**：属性区点击 SHALL 不切换对象，切换编辑侧 SHALL 不写入持久化活动身份。

#### Scenario: Save One Side
- **前提**：两侧均有未保存修改。
- **当**：保存当前编辑侧成功。
- **那么**：只更新该侧保存记录及基线，另一侧的内容、身份和 dirty SHALL 不变，名称旁各自显示 dirty 标记。

#### Scenario: Save As And Failed Save
- **当**：某侧另存为成功。
- **那么**：仅该侧 SHALL 绑定新 ID 与基线，不重新加载另一侧。
- **当**：取消命名或持久化失败。
- **那么**：工作副本、dirty 和待继续操作 SHALL 保留，系统 SHALL 不报告保存成功或提前关闭该侧。

#### Scenario: Picker And Save Dialog Ownership
- **前提**：装备选择器打开。
- **那么**：保存、另存为及其快捷键 SHALL 禁用，切换侧／替换方案／退出 SHALL 要求先结束选择器。
- **当**：无选择器时打开保存命名对话框。
- **那么**：对话框 SHALL 绑定打开时的侧与工作副本身份，不能因后续焦点变化保存到另一侧。

### Requirement: Non Conflicting Saved Identities

#### Scenario: Reject The Same Blueprint
- **前提**：用户给 B 选择 A 当前保存目标的同一蓝图。
- **当**：在 B 载入蓝图。
- **那么**：列表 SHALL 禁用该候选并说明原因，提交入口 SHALL 拒绝相同蓝图 ID，保持原会话，不自动复制蓝图或触发另存为。
- **并且**：A 的未保存配装修改 SHALL 不改变同一蓝图的判断；名称和配装内容 SHALL 不参与身份判断。

#### Scenario: Different Blueprints With The Same Hull
- **前提**：A、B 使用同一船体但蓝图 ID 不同。
- **当**：用户在 B 载入该蓝图。
- **那么**：系统 SHALL 允许对比；同一蓝图自身的配装变化继续使用已有单船装备预览对比。

#### Scenario: Missing Or Unsaved Save Target
- **前提**：某侧未命名、由内置预设派生，或其保存目标已删除。
- **当**：保存该侧。
- **那么**：系统 SHALL 走另存为，不依赖全局 activeBlueprintId 推断另一侧记录作为目标。

### Requirement: Safe Return To Single Blueprint

#### Scenario: Exit And Keep A
- **当**：用户选择“退出对比”。
- **那么**：B 无修改时直接关闭；B 有修改时 SHALL 提供“保存 B 并退出”“放弃 B 修改并退出”“取消”。
- **并且**：A 的未保存修改 SHALL 原样保留，成功退出后恢复 A 的建造材料栏。

#### Scenario: Keep B And Return
- **当**：用户选择“保留 B，返回单船”。
- **那么**：系统 SHALL 对即将关闭的 A 执行同样的 dirty 保护，将 B 的工作副本、身份与基线完整提升为单船，不从保存记录重载 B。

#### Scenario: Save Before Closing
- **当**：用户选择保存关闭侧后继续。
- **那么**：只有保存成功后 SHALL 关闭；另存为取消或保存失败 SHALL 保持原会话，不能修改保留侧。

#### Scenario: Replace B
- **当**：用户在 B 载入另一份已保存蓝图。
- **那么**：旧 B 有修改时 SHALL 提供保存／放弃／取消保护；仅在选择完成且保护流程成功后替换。
- **并且**：取消选择或取消保护 SHALL 保留旧 B，安装候选前 SHALL 再次拒绝与 A 相同的蓝图 ID，相同 ID 被拒绝时保留旧 B。

#### Scenario: Change B Ship Model
- **前提**：B 已存在，用户打开 B 的船型选择弹窗。
- **当**：确认另一个有效船型。
- **那么**：系统 SHALL 先保护旧 B 的未保存修改，再按新 shipId 载入最新创建的非 A 蓝图，无候选才创建空配装，不带入旧 B 装备、不改变 A；B SHALL 具有 clean 基线，已有记录绑定保存目标，空配装首次保存走另存为。
- **并且**：取消选择、取消保护或保存失败 SHALL 保留旧 B；选择当前船型 SHALL 不重置其配装。底层对比三栏 SHALL 在弹窗选择期间保留。

### Requirement: Session Lifecycle And Compatibility

#### Scenario: Destructive Session Transition
- **当**：新建、加载、删除或版本切换将丢弃会话中的工作副本。
- **那么**：系统 SHALL 检查所有将丢弃侧的 dirty，逐侧处理保存／放弃／取消，不能只检查当前编辑侧。
- **并且**：任一步取消 SHALL 阻止会话切换；已显式成功保存的记录无需回滚。

#### Scenario: Persistence Boundary And Single Mode
- **当**：显式保存方案或返回单船。
- **那么**：系统 SHALL 沿用现有蓝图存储结构及活动身份语义，不持久化对比会话、选择器或预览。
- **并且**：单船装备预览、保存／另存为和建造材料功能 SHALL 保持兼容。

#### Scenario: Architecture And UI Contract
- **当**：实施本方案。
- **那么**：领域状态和计算 SHALL 由 store 提供，UI 结构 SHALL 由 presenter 组装，Vue SHALL 通过 presenter 取数和触发行为，不增加第四层。
- **并且**：新增标签 SHALL 支持中英文，侧、选择器、属性与保存／退出操作 SHALL 提供稳定 UI 标识。

### Requirement: 默认蓝图名称不携带船型
未命名方案 SHALL 使用当前配装状态标签及从 1 开始的首个可用整数，跳过所有已保存蓝图中的同名记录；A、B 与单船 SHALL 共用此规则。已有名称 SHALL 保留。高配未改动时默认名称为“高配 1”，该名称已被另一船型保存时默认名称为“高配 2”。

### 后续事项：运输船选择器的蓝图名称展示（暂不实施）
- `TransitTransportShipSelector.vue` 已显示舰船名称分组，但蓝图行只显示引擎与性能，没有显示蓝图名称，同船型的相似配置可能不易辨认。
- 后续可在现有蓝图行展示 `blueprint.name`；按用户要求，本 change 仅记录此事项，暂不修改界面，不作为本次实现或验收的阻塞项。
- 舰队选择列表已显示舰船名称分组（用户截图确认），本次默认名称缩短不要求调整该列表。

### Requirement: 蓝图菜单高亮和删除保护
- 当前侧已保存蓝图 SHALL 强高亮，另一侧正在使用的已保存蓝图 SHALL 弱高亮。
- 当前侧、另一侧及悬停高亮 SHALL 覆盖整行（包含收藏和删除按钮），与同菜单默认配装行等宽，不随名称长度收缩。
- 菜单及 store SHALL 禁止删除另一侧正在使用的已保存蓝图；另一侧没有对应保存记录时 SHALL 不施加该限制。
- 删除当前侧蓝图 SHALL 保留工作配装，清空保存身份和名称并标为未保存，标题恢复“自定义”；另一侧保持不变。不因删除无关记录而触发双侧保存保护。

### Requirement: 区分已保存蓝图应用预设与未保存预设
- 已有保存目标时，A、B 选择高配等内置预设 SHALL 保留蓝图名称、保存身份及该蓝图的当前高亮；标题 SHALL NOT 切换成预设名。普通保存 SHALL 更新原记录，不新增记录。
- 配装相对保存基线有实质变化时 SHALL dirty 且显示红点；无实质变化时 SHALL clean 且不显示红点。不能因为点击预设就强制 dirty，也不能因配装等于预设就隐藏已保存蓝图的红点。
- 删除当前蓝图后 SHALL 保留配装，显示自定义和红点；此时再选高配，标题与高亮 SHALL 恢复高配，保存身份 SHALL 保持未保存，下一次保存 SHALL 进入另存流程。未修改的未保存预设 SHALL dirty 但不显示红点。
- 两侧 SHALL 使用相同状态判定，单侧上述操作 SHALL 不改变另一侧工作副本。

### Requirement: 同侧具体槽位直接切换
- 当前侧装备选择器已打开时，用户点击同一大类型内的另一具体槽位，系统 SHALL 直接切换，不要求确认或取消旧槽位。
- 系统 SHALL 丢弃旧槽位未确认预览，同步当前槽位高亮、候选装备、详情、护盾标识及当前侧修改前后比较；切换本身 SHALL NOT 修改任一工作副本或保存记录。
- 确认 SHALL 只应用新槽位的选择，旧槽位未确认候选 SHALL NOT 被应用；A、B SHALL 一致。
- E／R／S／T／C／U 大类型入口 SHALL 保持原有切换并关闭选择器行为；跨侧、命名／保护弹窗期间切换限制 SHALL 保持。

#### Scenario: 切换后默认选择当前已安装装备
- **当**：在同侧已安装装备的具体槽位之间切换。
- **那么**：当前装备和候选默认选中 SHALL 指向新槽位已安装装备；旧槽位未确认候选 SHALL 丢弃，旧槽位信息／筛选的中间状态 SHALL NOT 将新槽位选中项误清空。
- **并且**：原本为空的槽位 SHALL 默认选中空装备；A、B SHALL 一致，切换 SHALL NOT 写入配装。

### Requirement: 修改配装时显示装备属性对比
修改 A 或 B 配装时，系统 SHALL 在属性栏顶部复用装备属性对比面板，其下为舰船修改前后属性。A 修改时属性栏在右侧，B 修改时在左侧。选择不同已安装装备与候选时 SHALL 同时提供当前值及目标值；面板 SHALL NOT 放在候选列表下方。

### Requirement: 双侧标题保存与菜单另存为
- 配装名称框 SHALL 提供独立保存图标。A 图标位于名称左侧，B 位于名称右侧，与展开箭头相对；文字和保存图标 SHALL NOT 翻转。
- 点击保存图标 SHALL 仅保存所在侧，不依赖当前全局编辑侧，不展开菜单。无保存目标时 SHALL 使用原 SmartSaveDialog 命名流程。
- 两侧菜单 SHALL 提供独立分组的“另存为”，点击后关闭菜单并对所在侧进入原另存流程，不改变另一侧方案。
- 装备选择或其他保存保护／命名锁定期间，标题保存及菜单入口 SHALL 禁用；原名称、红点和保存保护规则 SHALL 保持。

### Requirement: 另存为默认不同名称
已有保存目标的方案另存为时，默认名称 SHALL 不同于当前名称且避开所有已保存蓝图名。编号名称 SHALL 使用原名称主体加可用序号，不重复拼接数字后缀；用户仍可编辑建议名称。普通保存及原蓝图名 SHALL 不受影响。A、B 和保护弹窗另存为 SHALL 一致。

### Requirement: 站内蓝图删除确认弹窗
- 删除蓝图 SHALL 使用与另存为风格一致的站内模态弹窗，显示目标名称、取消与删除操作，SHALL NOT 使用浏览器 confirm／alert。
- 确认前 SHALL NOT 删除记录；取消或关闭 SHALL 保持记录和工作副本。A、B 删除 SHALL 绑定请求侧与会话，确认时仍禁止删除另一侧使用中的记录。
- 弹窗期间 SHALL 锁定配装及保存操作；删除失败 SHALL 保留弹窗并提示，成功后关闭并沿用原删除状态恢复流程。

### Requirement: 筛选不改变候选选择
筛选 SHALL 只改变可见列表，不改变当前选中装备或预览。当前选择被筛掉时列表 SHALL 无选中行，不自动选中空槽位；取消筛选后该装备重新出现 SHALL 恢复选中。显式选择空槽位时保留原装备详情展示，不增加卸装提示。

### Requirement: 弹窗取消及退出操作表达
另存为弹窗 SHALL 支持 Escape 取消且不保存。退出按钮 SHALL 在标题行内显示“保留左侧／保留右侧”，悬停提示说明退出对比；左按钮右边缘与左属性条右边缘对齐，右按钮左边缘与右属性条左边缘对齐。保护弹窗 SHALL 使用简短标题，正文包含操作和方案侧、已保存蓝图名称，避免标题正文重复。保存图标与名称之间 SHALL 使用与箭头侧一致的竖线分隔，两侧镜像。

### Requirement: 双侧换船与交互状态一致
- A／B 更换船型 SHALL 只保护并替换目标侧，另一侧工作副本与保存身份 SHALL 不变，对比 SHALL 保持展开；取消 SHALL 不改变双方或布局。
- 两侧 SHALL 对目标船型采用相同候选规则：最新创建的非另一侧保存蓝图，无候选则空配装。
- 同一装备大类型跨尺寸及分组切换 SHALL 同步候选选中、当前装备、属性与预览；直接确认 SHALL 保留新槽位现装装备。
- SmartSaveDialog 无名称输入时 SHALL 自动获得焦点并支持立即 Escape 取消。
- 舰船属性简略／详细模式 SHALL 在编辑、取消、确认及对比切换中保持。

#### Scenario: 航母跨尺寸炮塔切换
- **前提**：任一侧巨像高配，L 与 M1／M2 均已安装炮塔。
- **当**：打开 L 炮塔编辑并直接切换 M1、M2，再确认。
- **那么**：默认候选 SHALL 是目标分组当前炮塔，不得选空或沿用 L 炮塔；另一侧不变。

### Requirement: 混合分组未选择确认保持原样
混合分组打开选择器 SHALL 无候选高亮且无卸装预览；未主动选择直接确认 SHALL 保持原装备、数量、保存身份与 dirty，且关闭选择器。明确点击空槽位后确认 SHALL 清空目标分组；选择具体装备 SHALL 按分组规则应用。取消 SHALL 不写入，重新打开 SHALL 回到混合未选择状态；A／B 行为一致且不改变另一侧。

### Requirement: Deterministic preset supplies
系统 SHALL 完整应用预设装备与补给，不继承当前补给数量；同船同预设结果一致，A／B 一致。

#### Scenario: Preset resets supplies
- **前提** 任一侧已设置补给数量
- **当** 选择空配、低配、中配或高配
- **那么** 空配清空全部装备和补给；其他预设未定义的补给清零，明确规则的无人机按预设更新
- **并且** 页面立即反映真实数量，后续调整其他补给不得恢复旧值，另一侧和保存记录不变

### Requirement: Favorite state is consistent on both sides
收藏操作 SHALL 同步同 ID 的工作副本与蓝图记录，标题和菜单状态一致，A／B 使用同一规则。

#### Scenario: Favorite survives saving
- **当** 用户在任一侧收藏或取消收藏已有蓝图，然后保存
- **那么** 标题、菜单及持久化记录保持用户最后选择
- **并且** 另一侧工作副本和未保存状态不变
