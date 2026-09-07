---
name: x4-drag
description: "Design, implement, test, and debug X4 drag-and-drop interactions, including sorting, cloning, sidebar-to-map placement, custom shadows, placeholders, and hover stability. Use before choosing drag APIs or writing drag tests."
metadata:
  version: "2.0"
---

# X4 Drag

为拖拽任务选择可执行方案，沿真实输入链完成开发和验证。取代原 `x4-drag-test`；规则适用于所有执行者，不维护模型专用副本。

## 按任务读取

- 先查 [drag-playbook.md](references/drag-playbook.md)：场景选型、现有代码与 helper、验证结果和失败分类。
- 列表排序、跨区移动、clone 创建、插入占位、enter/leave 计数：读 [sortable-recipes.md](references/sortable-recipes.md)。
- sidebar → map、overlay 移动、坐标与命中、不同于源外观的 shadow：读 [map-drag-recipes.md](references/map-drag-recipes.md)。
- 只读当前任务需要的配方。复用现有业务能力，不提前建立通用拖拽框架。

## 先确定合同和方案

追踪源组件、目标组件、presenter、store 及共享函数的全部调用者。实施前用简短结论明确：

1. **语义与身份**：排序、移动、复制创建或空间放置；源是否保留；目标、新 ID、重复及拒绝规则。
2. **实现与 API**：选定机制、实际版本/配置、关键事件及理由。按配方给出具体连接路径，不能只写原则。API 不确定时先核对官方文档和安装源码，并安排最小验证。
3. **状态与提交**：谁拥有可写数组、临时状态和 DOM；hover 是否仅预览；释放、确认、保存的不同边界；一次交互只提交一次。
4. **视觉合同**：源的保留/隐藏与原位置空间；跟随指针的 shadow 外观和偏移；目标 placeholder 是否占布局空间；preview 如何表示业务落点；合法、拒绝、离开时各自表现。
5. **生命周期和输入**：启动阈值、平移/点击冲突、滚动/缩放、取消、输入中断、卸载清理；触控、键盘或按钮替代入口按需求明确，不默认鼠标覆盖全部输入。
6. **验证边界**：具体 Unit 与真实输入 E2E、独立预期、需在释放前观察的信号，以及尚无证据的分支。

只有存在实际争议时比较备选方案。已有失败指向 API 或归属问题时，回到方案阶段，不只调整鼠标路径。

## 实施约束

- 严格 `store → presenter → vue`。Store 拥有领域状态、持久化和可复用业务能力；presenter 组装 UI 数据并协调业务操作；Vue 处理 DOM 输入和必要的局部交互状态，通过 presenter 触发业务。不得增加等价中间层。
- 历史 Vue 直接调用 store 的代码仅供追踪；新实现不得照抄。持久化新增字段同步相应 `normalizeState()`。
- 区分源、shadow、placeholder、preview；不能把库的 clone/ghost 名称直接当成业务职责。明确库与 Vue 各自控制的 DOM，避免双重影像、手工移除 DOM 或通过定时器修补渲染。
- 不把只读 computed/过滤集合作为库可写权威列表，不用 fallback 链掩盖状态分支。占位不成为可持久化实体；插入索引不把占位或其他装饰项误计为真实项目。
- 先实现一个完整、可验证的合法操作，再扩展要求中的拒绝、取消及保存分支。取消和结束清理必须覆盖监听、计数、shadow、hover 和占位。

## 验证与停止条件

按当前阶段工作：本 skill 不改变上层任务权限。`x4-apply` 负责实现、focused Unit 和 build；E2E 文档/实现/运行仍由 `x4-e2e-test` 对应阶段负责。设计任务不要求未实施的测试通过；测试任务不自动授权产品修复。

1. 复用匹配机制的 helper；遵守仓库 fixture → reload → UI 设置语言规则。Live/save-binding 使用 `loadLiveBindingFixture(page)`。确认源合法、可见且身份明确，记录操作前状态，避免原状态已满足断言。
2. 测试 API 独立选择：完整操作可评估 `locator.dragTo()`；阈值、hover、取消、shadow、占位或精确命中使用分阶段 `page.mouse` 等真实输入。沿用 helper 已验证的移动步骤，不把固定步数和等待时间当通用保证。
3. 逐段验证：有效按下 → 拖动启动 → 精确命中/释放前视觉状态 → 释放后的精确业务结果 → 清理 → 合同要求的确认和刷新。`v-show` 下 DOM 存在不等于可见或已启动。
4. `page.evaluate` 可用于合法 fixture 初始化及只读几何/状态检查；真实拖拽 E2E 不以合成事件、直接 handler 或 store 写入代替。Unit 可直接输入事件/参数，但只能证明局部边界。预期不得由被测算法生成。
5. hover 出现不能证明投放成功；placeholder 可见不能证明不跳动；已有 overlay 移动不能证明 sidebar 创建；普通取消不能证明计数器嵌套边界正确。按配方补对应断言。
6. 在第一个失败阶段收集实际状态、命中元素、日志和 trace。区分环境、fixture、定位/断言和产品边界；未知根因标 `unknown`。后续未到达阶段不得声明通过。
7. 不以增加固定等待、重复拖动或更改业务预期消除失败。只有新证据或明确变更支持下一假设时才针对性复验；稳定性重复执行另行注明目的。超出权限交回任务负责人。

## 交付

设计：交互/视觉合同、机制与关键 API、状态/DOM 归属、提交/取消路径、最小验证方案和未决项。

实现或测试：再附复用入口、独立业务预期、已到达阶段、实际结果、命令/退出码/通过失败数量、日志/trace、缺测与下一步证据。修复说明根因及共享调用者回归。历史通过与本次运行分开；测试通过不自动代表完整合同通过。
