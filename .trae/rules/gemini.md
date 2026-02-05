# AI 输出与交互规范 (AI Output & Interaction Guidelines)

为确保代码变更的精确性、项目资产的安全性以及文档的可用性，系统必须严格执行以下规范：

## 1. 变更零污染准则 (Zero-Contamination Principle)

AI 在处理代码任务时，必须严格界定“修改范围”。严禁越界触碰非目标区域，确保项目资产的原始完整性。

### 1.1 逻辑完整性 (Logical Integrity)
* **禁止擅自重写**：严禁自行重构、复写或“优化”任何任务目标之外的逻辑代码。
* **物理一致性**：在构建 Diff 或代码片段时，除必须修改的逻辑点外，其余上下文必须与原文件保持严格的物理一致（字符级匹配）。
* **建议机制**：若发现非目标区域存在逻辑缺陷，**严禁擅自修复**，应在回复中以文字形式提示用户检查。

### 1.2 资产保护 (Asset Protection)
* **注释不可变**：严禁添加、删除或修改任何现有注释，即使注释内容存在错误或不规范。
    * *例外处理*：若注释与代码严重脱节，应提示用户修正，而非直接修改。
* **排版冻结**：源代码的排版风格（缩进、空格、换行符位置等）被视为受保护资产。严禁以“美化”、“清理”为由进行任何未授权的格式变动。
    * *例外处理*：若排版严重影响阅读，可提示用户。

### 1.3 规则例外 (Exceptions)
上述限制仅在用户未明确发出排版或重构指令时生效。若用户明确要求（如“请重构代码风格”、“修复错误的注释”），AI 应优先执行用户指令。

---

## 2. 代码变更输出规范 (Code Output Guidelines)

### 2.1 Diff 优先 (Diff Priority)
涉及现有文件的任何修改，必须优先采用 **Standard Diff** 格式输出，以确保变更点清晰且可被工具自动化应用。

### 2.2 聚合容器 (Unified Block)
* **单一入口**：若一次任务涉及**多个文件**的改动，必须将所有文件的 Diff 变更整合在 **同一个 Markdown 代码块** 中。
* **严禁拆分**：禁止将不同文件的变更分散在多个独立的 Markdown 容器中。

### 2.3 文件定界 (File Delimitation)
在聚合容器内部，必须使用标准的 Diff Header 作为文件区分的唯一依据。请严格保持以下格式（建议保留 `a/` 和 `b/` 前缀以符合标准 Patch 规范）：

* `--- a/path/to/source_file`
* `+++ b/path/to/target_file`

---

## 3. 文档生成规范 (Documentation Generation)

当任务涉及生成或修改独立文档（如 `README.md`、开发指南、配置文件）时：

### 3.1 源码输出 (Source Only)
必须输出 **Markdown 源码 (Raw Markdown)**，并将内容封装在代码块中。

### 3.2 禁止渲染 (No Rendering)
**严禁**直接在对话流中渲染文档的排版（例如：禁止直接显示富文本的一级标题、表格或引用块）。输出必须是纯文本代码形式，确保用户可以直接点击“复制”并保存为 `.md` 文件。

---

## 示例 (Examples)

### 示例：多文件代码变更
```diff
--- a/src/utils.py
+++ b/src/utils.py
@@ -10,2 +10,5 @@
 def parse_data(data):
-    return data.split(",")
+    if not data:
+        return []
+    # Fixed: Use strict delimiter
+    return data.split("|")

--- a/config/settings.yaml
+++ b/config/settings.yaml
@@ -5,1 +5,1 @@
-timeout: 30
+timeout: 60
```

### 示例：生成说明文档
请直接输出如下代码块：

```markdown
# 项目部署指南

## 1. 环境准备
运行 `pip install -r requirements.txt`

## 2. 启动
执行 `python main.py`
```