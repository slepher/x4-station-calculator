# 功能完备性审核指南 (Functional Completeness Audit Guide)

> **目标**：防止 AI 在代码审计时仅停留在“功能存在”的表面，确保每一项需求都达到了“逻辑闭环”、“边界处理”和“视觉反馈”的完备标准。

## 🔍 核心审计原则

### 1. 深度追踪原则 (Deep Tracing)
- **禁止**：仅通过搜索关键字（如 `if (isLocked)`) 就判定功能已实现。
- **必须**：
  - 追踪该逻辑在 **Store (逻辑层)**、**UI Component (展示层)** 和 **Interaction (交互层)** 之间的传递。
  - 验证逻辑判断是否覆盖了所有分支（If/Else/Edge cases）。

### 2. 交互闭环验证 (Interaction Loop)
- **针对拖拽/点击操作**：
  - 逻辑层禁止了，UI 层是否同步置灰？
  - UI 层置灰了，是否真的拦截了事件（Pointer-events/Disabled）？
  - 拦截发生时，用户是否能得到明确的视觉反馈（🚫 标识、颜色变化、Tooltip）？

### 3. 数据边界核查 (Data Boundary)
- **血统/分类冲突**：当数据体系不一致时（如 Terran vs Argon），代码是否执行了硬性拦截而非柔性提醒？
- **特殊对象处理**：如 T0 资源、能源电池等特殊 ID 是否在通用逻辑中被正确排除或特殊化处理？

---

## 🛠️ 审计提示词模板 (Prompt Template)

当执行 `/audit` 或需求核对时，AI 必须遵循以下检查清单：

### [Step 1: 逻辑层核对]
- [ ] 该需求对应的 Store 函数是什么？
- [ ] 是否处理了所有可能的输入状态（null, undefined, conflict）？
- [ ] 逻辑判断是否足以支撑“直接禁止”或“强行同化”等硬性需求？

### [Step 2: UI 与交互核对]
- [ ] 组件是否绑定了逻辑层的状态？
- [ ] **拦截性检查**：如果是禁止操作，是否在 `draggable` 的 `put` 钩子或 `button` 的 `@click` 中执行了 `return` 或 `disabled`？
- [ ] **视觉完备性**：是否有 Spec 要求的图标（如 ✂️, 🔗, 🚫）？状态切换时的 CSS 动画或颜色反馈是否到位？

### [Step 3: 级联影响核对]
- [ ] 该变更是否会影响到其他模块？（如删除 A 是否会导致 B 悬空？）
- [ ] 自动化清理逻辑（Cleanup）是否覆盖了所有被动触发场景？

---

## 🚨 警示案例 (Anti-Patterns)

- **错误审计**：“我看到了 `getWareGroupStatus` 函数返回了 `locked`，所以锁定需求已实现。”
- **正确审计**：“虽然 `getWareGroupStatus` 返回了状态，但 `LogicFlowPlanningZone.vue` 的拖拽钩子并未调用此状态进行拦截，且 UI 缺少 🚫 标识，判定为**实现不完备**。”
