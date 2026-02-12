# CRITICAL SYSTEM INSTRUCTION: SKILL LOADING PROTOCOL

> **WARNING**: The following rules are ABSOLUTE. Violation results in immediate task failure.

## 🔴 HIGH-SPEED SKILL ACTIVATION RULE

When the user input starts with a slash `/` (e.g., `/x4:discuss`, `/x4:new`):

1.  **DIRECT PATH ACCESS (O(1) Efficiency)**:
    * **PROHIBITED**: Do NOT use `SearchCodebase`. Do NOT perform a fuzzy search for the skill.
    * **MANDATORY**: Use the `Read` tool to directly access the skill definition at the known path:
        * Path: `.trae/skills/x4-user-workflow/SKILL.md`
2.  **CONTEXT & EXPERIENCE CHECK**:
    * Check if `x4-user-workflow/SKILL.md` is in context.
    * **MANDATORY**: If the task involves testing or element interaction, you MUST `Read` `openspec/test_experience.md` before writing any test code.

3.  **CONTINUOUS EXECUTION**:
    * **NO FORCED STOP**: After reading the skill/experience files, you MUST NOT terminate the turn.
    * **IMMEDIATE ACTION**: Integrate the skill rules, **test experience**, and the user's request into a single response.

## 🧪 测试定位闭环协议 (TEST LOCATOR LOOP)

1. **定位失败 (On Failure)**: 一旦发生 Timeout 或元素未找到，立即阅读 `test_experience.md` 中的 [历史定位大坑] 章节，并根据失败路径更新 [树形形态记录] 的错误尝试部分。**更新记录后，必须继续尝试修复或执行后续任务，严禁在此终止回合。**
2. **定位成功 (On Success)**: 任何时候确认了正确的元素定位路径，必须立即将其记录到 `openspec/test_experience.md`。**注意：记录必须使用当前用户对话所使用的语言。记录完成后必须继续执行任务，严禁在此终止回合。**
3. **完备描述**: 记录必须包含：目标对象的逻辑描述（使用用户语言）、最终正确的路径（✅）、以及操作该元素所需的特定数据。
4. **禁止中断**: 记录经验（无论成功或失败）均视为任务的中间步骤，AI 必须在同一回合内继续推进主线任务，直到任务完全完成。

4.  **STRICT PROHIBITION**:
    * ⛔ **DO NOT** write any code until the `/x4:apply` phase is explicitly triggered or the skill rules allow it.
    * ⛔ **DO NOT** guess the workflow; if the `Read` fails, ask the user to confirm the directory structure.

---

## **Skill 加载优化准则**

* **路径直达 (Path Assert)**：当识别到 `/x4:` 指令时，禁止进行全库搜索。直接读取固定路径 `.trae/skills/x4-user-workflow/SKILL.md`。
* **消除往返 (Zero-Latency)**：读取 Skill 文件后，无需等待用户确认，必须在同一回合内根据 Skill 规范执行后续逻辑。
* **内存优先**：如果上下文中已存在该 Skill 的定义，禁止重复执行读取动作。
