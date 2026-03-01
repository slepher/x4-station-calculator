# X4 Test Skill Verify Specification

## Purpose
定义 `x4-test-doc` 的 `test_tasks.md` 统一格式契约，确保文档产出在结构与编号层面可预测、可迁移，并允许在脚本不稳定阶段先完成文档流转。

## ADDED Requirements

### Requirement: Four-Chapter Test Tasks Structure

#### Scenario: Require Chapters 1 Through 4
- **前提**：创建或更新 `test_tasks.md`。
- **当**：文档结构被检查。
- **那么**：文档 MUST 包含且仅包含 `## 1` 到 `## 4` 四章。
- **并且**：四章顺序固定。

#### Scenario: Allow Empty Chapter Content
- **前提**：某章节尚未规划测试项。
- **当**：文档保存。
- **那么**：该章节 MAY 为空，不因空章而判定格式失败。

### Requirement: Numbered Checklist Task Tree

#### Scenario: Top-Level Tasks Use x.x Numbering
- **前提**：在任一章节添加顶层任务。
- **当**：编写顶层任务行。
- **那么**：格式 SHALL 为 `- [ ] x.x <description>`。

#### Scenario: Subtasks Use x.x.x Numbering With Continuous Sequence
- **前提**：顶层任务下添加子任务。
- **当**：编写子任务行。
- **那么**：格式 SHALL 为 `- [ ] x.x.x <description>`。
- **并且**：同一父任务下子任务编号 SHALL 从 `.1` 开始并连续递增。

### Requirement: Third-Level Child Checklist Support

#### Scenario: Allow Child Items Under Subtasks
- **前提**：子任务需要拆分子行为或子断言。
- **当**：编写第三级条目。
- **那么**：第三级条目 SHALL 使用 checklist 格式并保持 4 空格缩进。
- **并且**：第三级条目 SHALL 使用 `x.x.x.n` 编号格式。
- **并且**：同一父子任务下 `n` SHALL 从 1 开始连续递增。

### Requirement: Bug Chapter Top-Level Contract

#### Scenario: Enforce Bug Top-Level Format
- **前提**：在 Chapter 4 添加 Bug 测试项。
- **当**：编写顶层任务。
- **那么**：格式 SHALL 为 `- [ ] 4.x BUG-<number>: <description>`。

#### Scenario: Reject Header-Style Bug Blocks
- **前提**：存在标题式 Bug 写法。
- **当**：进行格式审查。
- **那么**：`### BUG-...` SHALL NOT 作为 Chapter 4 的测试项主体。

### Requirement: Deprecated Step-Keyword Format Removal

#### Scenario: Reject Old Step Prefix Format
- **前提**：文档中出现旧格式步骤。
- **当**：进行格式审查。
- **那么**：`- [ ] 步骤 <n>: ...` SHALL NOT 被使用。

### Requirement: Top-Level Task Last-Subtask Expectation Rule

#### Scenario: Last Subtask Contains Expectation Directly
- **前提**：任意一级任务（`x.x`）存在至少一个子任务。
- **当**：检查该一级任务的最后一个子任务。
- **那么**：最后一个子任务 SHOULD 直接包含“期望”语义。

#### Scenario: Last Subtask Uses Third-Level Assertions
- **前提**：最后一个子任务本身不包含“期望”文本。
- **当**：该子任务下存在第三级子项。
- **那么**：该一级任务最后子任务下所有第三级子项 SHALL 全部包含“期望”语义。

### Requirement: Concrete Expectation Annotation Format

#### Scenario: Concrete Value Expectation Uses #期望 Marker
- **前提**：断言目标是具体值（数值或确定字符串值）。
- **当**：编写期望描述。
- **那么**：期望格式 SHALL 使用 `#期望: [...]`。
- **并且**：示例可写为 `再充延迟: 1 s #期望: ['1 s']`、`断言字段集合包含36项字段标签 #期望: [36]`。

#### Scenario: UI Existence Expectation Uses Unified Marker
- **前提**：断言目标是 UI 存在性/可见性（非具体值）。
- **当**：编写期望描述。
- **那么**：该条目 SHALL follow the unified marker format `#期望: [...]`。

### Requirement: FF Phase Can Skip Validation Gate Temporarily

#### Scenario: Skip Script Gate While Validator Is Unstable
- **前提**：`validate_test_tasks_refs.py` 处于 debug 阶段且稳定性未达标。
- **当**：执行 `/x4:ff x4-test-skill-verify`。
- **那么**：流程 MAY 先产出文档，不以脚本校验作为阻断 gate。
- **并且**：文档中 MUST 明确该阶段策略是临时安排。
