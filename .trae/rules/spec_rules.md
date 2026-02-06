# OpenSpec 格式规范 (rule.md)

## 1. 核心原则
本规范定义了 OpenSpec 文档的强制结构，旨在确保文档被 AI 或自动化工具读取时的稳定性，同时保留人类编写的灵活性。
**规则总结：** 标题层级与英文关键词**绝对不可变更**；正文描述与逻辑步骤**支持本地化（中文）**。

## 2. 标题层级 (Immutable Headers)
以下标题必须严格保留英文原词与 Markdown 阶级，**严禁翻译、本地化或修改大小写**。

| Markdown 阶级 | 强制关键词 (Pattern) | 说明 |
| :--- | :--- | :--- |
| `#` | **[Name] Specification** | 文档主标题，[Name] 可变，后缀 Specification 不可变 |
| `##` | **Purpose** | 文档目的，必须紧跟主标题 |
| `###` | **Requirement: [Name]** | 单个需求块，冒号前内容不可变 |
| `####` | **Scenario: [Name]** | 场景/验收标准，冒号前内容不可变 |

## 3. 增量文档结构 (Delta Structure)
在描述变更的文档（在changes/specs/${spec-name}下命名为 `spec.md`）中，二级标题必须使用以下保留词。不同类型的变更对内容结构有不同要求：

### 3.1 常规变更 (Standard Deltas)
以下标题属于内容实质性变更，**必须**编写完整的 `### Requirement` 块以及至少一个 `#### Scenario` 块以定义行为：
- `## ADDED Requirements`
- `## MODIFIED Requirements`

### 3.2 删除变更 (Removal Deltas)
以下标题用于废弃功能，**必须**编写完整的 `### Requirement` 块：
- **正文要求**：必须在标题下方直接编写废弃原因、替代方案或迁移说明（如：Deprecated in favor of...）。
- **结构约束**：此类变更通常**不包含** `#### Scenario` 块。
- `## REMOVED Requirements`

### 3.3 重命名变更 (RENAMED Special Syntax)
`## RENAMED Requirements` 标题下**不编写**常规需求块，而是必须使用列表定义映射关系，格式强制如下：
- `- FROM: ### Requirement: [Old Name]`
- `- TO:   ### Requirement: [New Name]`

## 4. 内容编写规范 (Localizable Content)

### 4.1 需求定义 (Requirement Body)
- **位置**：紧随 `### Requirement` 标题后的正文段落。
- **规范**：允许使用中文描述具体业务规则或系统行为。
- **强制约束**：需求正文描述中**必须**包含英文关键词 `SHALL` 或 `MUST`（不区分大小写），以确保需求的规范性与约束力。

### 4.2 场景逻辑 (Gherkin Steps)
- **位置**：`#### Scenario` 标题下的列表项。
- **规范**：推荐使用以下中文引导词以保持语义清晰，也可以混用英文：
  - `- **前提** ...` (对应 Given)
  - `- **当** ...` (对应 When)
  - `- **那么** ...` (对应 Then)
  - `- **并且** ...` (对应 And)

## 5. 标准格式示例 (Standard Template)

以下是一个符合规范的文档片段示例：

---

# Search Specification

## Purpose
描述全局搜索功能的交互逻辑。

### Requirement: 搜索响应
系统应在用户输入时提供实时反馈。

#### Scenario: 自动联想
- **前提** 用户焦点位于搜索框内
- **当** 用户输入超过 2 个字符
- **那么** 下拉菜单应显示匹配的建议列表
- **并且** 高亮显示匹配的关键词