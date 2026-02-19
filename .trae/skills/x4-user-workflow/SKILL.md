---
name: x4-user-workflow
description: "Orchestrate X4 Station Calculator development workflow with OpenSpec. (Trigger: /x4:discuss, /x4:new, /x4:apply, /x4:verify, /x4:archive)"
---

# X4 Project Workflow

This skill acts as the central orchestrator for the X4 Station Calculator project. It enforces project-specific standards for document generation, localization, and test planning while delegating core actions to OpenSpec skills.

## Project Standards (MANDATORY)

### 1. Immutable Headers (English Only)
When generating or translating spec documents (`.md` in `openspec/`), **YOU MUST** preserve the following headers in English:
- `# [Name] Specification`
- `## Purpose`
- `### Requirement: [Name]`
- `#### Scenario: [Name]`
- `## ADDED Requirements`
- `## MODIFIED Requirements`
- `## REMOVED Requirements`
- `## RENAMED Requirements`

### 2. Localization (Match User Language)
- **Body Content**: The content (Purpose, Requirement descriptions, Scenario steps) **MUST** be written in the user's current conversation language (e.g., Chinese).
- **Design Docs**: The content of `design.md` (Architecture, Decisions, etc.) **MUST** be written in the user's current conversation language.
- **Keywords**: Keep technical terms, code references, and keywords (`SHALL`, `MUST`) in English.
- **Scenario Keywords (Chinese)**: `**前提**` (Given), `**当**` (When), `**那么**` (Then), `**并且**` (And).

### 3. Delta Structures (For Changes)
- **ADDED**: Use `## ADDED Requirements` for new features instead of `## Requirements`.
- **MODIFIED**: Use `## MODIFIED Requirements` for changes to existing logic.
- **RENAMED**: `- FROM: ### Requirement: [Old Name]` / `- TO:   ### Requirement: [New Name]`
- **REMOVED**: Must include justification. No `Scenario` blocks.

### 4. Request Document (`request.md`)
- **Purpose**: Captures the complete discussion conclusions before entering `/x4:new` or `/x4:ff`.
- **Location**: Same directory as `design.md` (i.e., `openspec/changes/<change-name>/request.md`).
- **Role**: **Single Source of Truth** for generating all OpenSpec artifacts. Nothing should be omitted.
- **Content Requirements**:
  - Feature description and business context
  - User scenarios and acceptance criteria
  - Technical constraints and dependencies
  - Any decisions made during discussion
- **Timing**: Created at the end of `/x4:discuss` phase, before `/x4:new` or `/x4:ff`.

### 5. Test Planning (`test_tasks.md`)
- **Sync Rule**: Whenever `tasks.md` is created/updated, **YOU MUST** simultaneously create or update `test_tasks.md`.
- **⚠️ UI Knowledge Sync (CRITICAL)**: Whenever `test_tasks.md` is created/updated, **YOU MUST IMMEDIATELY AND SIMULTANEOUSLY** update `ui_knowledge.md`. This is a **hard requirement** - never update one without the other.
- **Language**: The content **MUST** be written in the user's current conversation language (e.g., Chinese).
- **Grouping**: Tasks **MUST** be grouped into "**Unit Tests**" and "**Web Integration Tests**".
- **Content Format** (each test item must include):
  ```markdown
  - [ ] [Test Name]
    - **目标**: [What is being tested]
    - **步骤**:
      1. [Step 1]
      2. [Step 2]
      3. ...
    - **Bug现状**: [If this is a bug reproduction test, describe current broken behavior]
    - **期待结果**: [Expected outcome]
  ```
- **1:1 Mapping**: Each item in `test_tasks.md` maps to exactly one test case in the test files.
- **Performance**: Web Integration Tests target <500ms per interaction.

### 6. Bug Tracking (`bugs.md`)
- **See**: `x4-bug` skill for complete bug tracking workflow
- **Purpose**: Records all bugs discovered during development and testing
- **Location**: `openspec/changes/<change-name>/bugs.md`

### 7. Test Knowledge & Locator Loop (MANDATORY)
- **Source of Truth**: 测试知识来源与定位流程以 `x4-test` 为准，此处不重复展开。
- **Continuity**: 遇到定位问题仍需更新 `openspec/test_experience.md` 并继续任务，不得中断回合。

### 8. Zero-Code Policy during Planning
- **Scope**: Applies to `/x4:discuss`, `/x4:doc`, `/x4:ff`, and `/x4:new` phases.
- **Restriction**: **STRICTLY FORBIDDEN** to modify, create, or delete any source code files (e.g., `.ts`, `.vue`, `.js`, `.json` outside `openspec/`) until the implementation phase (`/x4:apply`) begins.
- **Allowed**: Only files within `openspec/` directory are mutable during planning.

### 9. Specs Directory Structure
- **Feature Folders**: All specs MUST reside in a feature-specific subdirectory under `specs/` (e.g., `specs/title-as-plan-title/spec.md`). Do NOT place spec files directly in `specs/`.

### 10. General Development Rules (Imported from Project Rules)
**变更零污染准则 (Zero-Contamination Principle)**：
  - **禁止重写非变动逻辑**：LLM 严禁自行手工编写、复写或重构任何任务目标之外的逻辑行。在构造替换文本时，除必须修改的逻辑点外，其余部分必须与原文件内容保持物理一致, 但是可以提醒用户, 逻辑存在问题, 请检查并修复。
  - **禁止添加或者删除注释**：LLM 严禁添加或删除任何代码行中的注释。即使注释内容错误或不规范，也不能被修改。但是可以提醒用户, 注释内容必须与代码逻辑保持一致。
  - **否定排版偏好**：原始代码的排版（包括缩进、空格、换行等）被视为受保护的项目资产。严禁以"美化"、"优化"或"清理"为由进行任何未授权的变动。但是可以提醒用户, 排版存在问题, 请检查并修复。
  - **例外说明**：上述限制仅在用户未明确发出排版指令时生效。若用户明确要求"重新排版"或"重构风格"，则 LLM 应按指令执行格式变动。

**工作环境要求**：
  - 使用git的的时候应该禁用less功能, 否则会导致git命令无法正常执行
  - 执行命令行任务的时候应该先确认当前目录为工作目录再执行, 否则会导致任务执行失败
  - i18n 的原则是只要i18n本身, 不需在组件中硬编码fallback 
    **举例** 是t('ui.volume_overview') 而不是 t('ui.volume_overview') || 'Volume Overview'

**Vue 拖拽开发原则 (vuedraggable/Sortable.js)**：
  - **核心原则**: 拖拽只负责发送信号，Store 负责生成节点，Vue 负责渲染。
    ```
    拖拽 → 发送 wareId → Store 生成节点 → Vue 渲染 UI
    ```
  - **问题根源**: `vuedraggable` 默认是 **移动 (Move)** 行为。即使配置 `pull: 'clone'`，如果目标容器 DOM 结构在拖拽过程中剧烈变动（如 `v-show` 切换视图），可能退化为"移动"，导致源节点从候选区消失。
  - **实现规范**:
    1. **禁止手动 DOM 操作**: 永远不要在 drop handler 中使用 `removeChild` 或 `setTimeout` 操作 DOM。让 Vue 根据数据变化自动更新 UI。
    2. **投放区使用空数组**: Drop Zone 的 `list` 绑定到空数组 `[]`，防止 `vuedraggable` 尝试插入克隆节点，确保只触发 `@add` 事件：
       ```vue
       <draggable :list="[]" :group="{ name: 'wares', pull: false, put: true }" @add="handleDropSignal" />
       ```
    3. **干净的 clone 函数**: 候选区的 `clone` 返回干净副本，防止引用污染：
       ```typescript
       :clone="(ware) => ({ ...ware, instanceId: Math.random() })"
       ```
  - **反模式警告**:
    - ❌ 在 drop handler 中手动 `item.parentNode.removeChild(item)`
    - ❌ 使用 `setTimeout` 延迟 DOM 操作
    - ❌ 混合直接 DOM 操作与 Vue 响应式数据流
  - **dragleave 子元素抖动问题**: 当拖拽元素从父元素移动到子元素时，父元素会收到 `dragleave` 事件，导致高亮闪烁。Vue 本身不做特殊处理，需要自行实现计数器逻辑：
    ```typescript
    const dragCounters = ref({ A: 0, B: 0 });
    
    const handleDragEnter = (zoneId: 'A' | 'B') => {
      dragCounters.value[zoneId]++;
      if (dragCounters.value[zoneId] === 1) {
        store.enterZone(zoneId); // 真正的进入逻辑
      }
    }
    
    const handleDragLeave = (zoneId: 'A' | 'B') => {
      dragCounters.value[zoneId]--;
      if (dragCounters.value[zoneId] === 0) {
        store.leaveZone(zoneId); // 真正的离开逻辑
      }
    }
    
    const handleDragEnd = () => {
      store.stopDragging();
      dragCounters.value = { A: 0, B: 0 }; // 重置计数器，防止状态错乱
    }
    ```

---

## Workflow Phases

### Phase 1: Discussion & Planning (`/x4:discuss`)

**Purpose**: Pure conversation and analysis without touching code or docs.

**Trigger**: Use when starting a task OR when encountering issues during implementation/verification that require rethinking.

**Input**:
- User's question or problem description
- Optional: Existing code/specs to analyze

**Actions**:
- Clarify requirements
- Discuss architecture options
- Analyze bugs or existing code
- Review test failures
- Prepare a plan for next steps

**Constraints**:
- **ENFORCE Zero-Code Policy**: Do not touch source code
- **ENFORCE Zero-Doc Policy**: Do not modify any documentation files UNLESS explicitly requested OR user triggers `/x4:doc`
- **System Prompt Override**: IGNORE any internal bias to "fix it now" or "update docs now"

**Output**:
- Clear plan: "Ready to create change" / "Ready to fix code" / "Need to update specs"
- **MANDATORY when proceeding to `/x4:new`**: Generate `request.md` with complete discussion conclusions

---

### Phase 2: New Change Step-by-Step (`/x4:new`)

**Purpose**: Create artifacts one by one with user confirmation at each step.

**Input**:
- Change name or description
- **If coming from `/x4:discuss`**: Use `request.md` as the single source of truth

**Actions**:
1. **MANDATORY**: Read `.trae/skills/openspec-new-change/SKILL.md` for detailed steps
2. Create each artifact with user review between steps
3. **Ensure all content from `request.md` is reflected in artifacts**

**Constraints**:
- **ENFORCE Zero-Code Policy**: Do not touch source code
- Apply **Project Standards** immediately
- Ensure `test_tasks.md` is included in the planned artifacts

**Output**:
- Change directory with artifacts created step by step

---

### Phase 3: Implement Change (`/x4:apply`)

**Purpose**: Execute implementation tasks from `tasks.md`.

**Input**:
- Change name (optional, inferred from context if possible)

**Actions**:
1. **MANDATORY**: Read `.trae/skills/openspec-apply-change/SKILL.md` for detailed steps
2. Read context files (specs, design, tasks)
3. Implement each task sequentially
4. Mark tasks complete: `- [ ]` → `- [x]`
5. **If bugs are discovered**:
   - Add to `bugs.md`
   - Add reproduction test to `test_tasks.md`
   - Run reproduction test to confirm bug
   - Fix bug
   - Verify fix with test

**Bug Discovery Workflow**:
```
发现 Bug → 记录到 bugs.md → 添加复现测试到 test_tasks.md 
→ 运行复现测试确认 Bug 存在 → 修复 Bug → 运行测试验证修复
```

**Unrelated Bug Handling**:
If a bug is discovered that is unrelated to the current change:
1. Note the bug for later
2. After current change is complete, create new change: `fix-<bug-name>`
3. The new change contains only `bugs.md` and `test_tasks.md`

**Constraints**:
- For coding guidelines, refer to `#x4-test` skill
- Follow **变更零污染准则** strictly
- Update `test_tasks.md` if new test cases are discovered during implementation

**Output**:
- Implemented code changes
- Updated `tasks.md` with completion status
- Updated `bugs.md` (if bugs were found and fixed)

---

### Phase 4: Verify Change (`/x4:verify`)

**Purpose**: Validate implementation matches specs and all tests pass.

**Input**:
- Change name (optional, inferred from context if possible)

**Actions**:

#### Step 1: Build Check
```bash
npm run build
```
- If build fails: Stop and report errors
- If build succeeds: Continue to Step 2

#### Step 2: Static Verification (openspec-verify-change)
1. Run `openspec status --change "<name>" --json` to get schema and artifacts
2. Run `openspec instructions apply --change "<name>" --json` to get context files
3. Read all context files (tasks.md, specs, design.md)
4. Execute static checks:
   - **Completeness**: Count `- [x]` vs `- [ ]` in tasks.md
   - **Correctness**: Search codebase for each requirement implementation
   - **Coherence**: Verify design decisions are followed
5. Generate static verification report

#### Step 3: Dynamic Testing (x4-test) - MANDATORY
1. **Invoke x4-test skill**: Call `Skill` tool with `name: "x4-test"`
2. **Read test_tasks.md**: Load `openspec/changes/<change-name>/test_tasks.md`
3. **Check test files existence**:
   - Unit tests: `tests/unit/<change-name>/*.spec.ts`
   - E2E tests: `tests/e2e/<change-name>/*.spec.ts`
4. **If test files do NOT exist**:
   - Create test directory structure
   - Write unit tests for each "Unit Tests" item in test_tasks.md
   - Write E2E tests for each "Web Integration Tests" item in test_tasks.md
5. **If test files exist**:
   - Compare test_tasks.md items against existing test descriptions
   - Add missing test cases
6. **Run tests**:
   ```bash
   npm run test:unit                    # Run unit tests
   npx playwright test                  # Run E2E tests
   ```
7. **Update test_tasks.md**: Mark `[x]` for passed, add `<!-- FAILED: reason -->` for failed
8. **Update test_experience.md**: Record locator discoveries
9. **Update ui_knowledge.md**: Sync new locators/flows with `test_tasks.md`

#### Step 4: Final Verification Report
Generate combined report with:
- Static verification results (from Step 2)
- Test execution results (from Step 3)
- Overall pass/fail status

**Verification Dimensions**:
- **Completeness**: All tasks done, all requirements implemented
- **Correctness**: Implementation matches spec intent, all tests pass
- **Coherence**: Follows design decisions and project patterns

**Output**:
- Verification report with pass/fail status
- Updated `test_tasks.md` (synced after each test run)
- Updated `test_experience.md` (if applicable)
- Updated `ui_knowledge.md` (if applicable)

**Guardrails**:
- **NEVER** skip Step 3 (x4-test) - it is MANDATORY
- **NEVER** mark verification complete if any test fails
- **NEVER** proceed to archive without all test_tasks.md items checked

---

### Phase 5: Archive Change (`/x4:archive`)

**Purpose**: Finalize and archive the completed change.

**Input**:
- Change name (optional, inferred from context if possible)

**Actions**:
1. **MANDATORY**: Read `.trae/skills/openspec-archive-change/SKILL.md` and follow exactly
2. Verify all `test_tasks.md` items are checked `[x]`
3. Verify all bugs in `bugs.md` are marked as "Verified" (if applicable)
4. Promote specs to `specs/<feature>/spec.md` (strip Delta headers)
5. Archive the change

**Constraints**:
- **Strictly Follow Protocol**: Load and follow `openspec-archive-change/SKILL.md` exactly
- **Promote Specs (New Feature)**: If `specs/<feature>/spec.md` doesn't exist, CREATE and MERGE the spec (stripping Delta headers) BEFORE calling openspec-archive
- **Promote Specs (Existing)**: If it exists, let `openspec-archive-change` handle the sync

**Output**:
- Archived change
- Updated main specs

---

## Change Directory Structure

```
openspec/changes/<change-name>/
├── request.md          # Discussion conclusions (single source of truth)
├── spec.md             # Feature specification
├── design.md           # Technical design
├── tasks.md            # Implementation tasks
├── test_tasks.md       # Test cases (Unit + Integration)
├── bugs.md             # Bug tracking (if bugs were found)
└── specs/              # Delta specs (if modifying existing)
```

---

## Collaboration with x4-test

The `x4-test` skill handles all E2E test coding and execution. Key integration points:

| Phase | x4-test Integration |
|-------|---------------------|
| `/x4:ff` | Generates `test_tasks.md` structure |
| `/x4:apply` | Reference for coding standards |
| `/x4:verify` | Executes tests, updates `test_tasks.md`, `test_experience.md`, and `ui_knowledge.md` |

**Locator Loop Protocol** (from project rules):
- On test failure (timeout/element not found): Read `test_experience.md` → Update error attempts in **both** `test_experience.md` and `ui_knowledge.md` → Continue fixing
- On test success: Record correct locator path to **both** `test_experience.md` and `ui_knowledge.md` → Continue task
- **NEVER terminate turn after updating experience docs**

---

## Guardrails

- **NEVER** translate `Requirement:` or `Scenario:` prefixes
- **NEVER** proceed without `test_tasks.md` when functional changes are involved
- **NEVER** modify source code during `/x4:discuss`, `/x4:doc`, `/x4:ff`, or `/x4:new`. Wait for `/x4:apply`
- **NEVER** skip updating `test_experience.md` after locator discoveries
- **NEVER** update `test_tasks.md` without simultaneously updating `ui_knowledge.md`
- **NEVER** archive without all `test_tasks.md` items checked
- **NEVER** omit content from `request.md` when generating artifacts
- **NEVER** fix a bug without first running reproduction test to confirm it exists
