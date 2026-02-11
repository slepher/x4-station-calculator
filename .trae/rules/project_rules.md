# CRITICAL SYSTEM INSTRUCTION: SKILL LOADING PROTOCOL

> **WARNING**: The following rules are ABSOLUTE. Violation results in immediate task failure.

## 🔴 ZERO-TOLERANCE SKILL LOADING RULE

When the user input starts with a slash `/` (e.g., `/x4:discuss`, `/test:run`):

1.  **IMMEDIATE STOP**: You must STOP thinking about the user's specific request details.
2.  **SINGLE ALLOWED ACTION**: The **ONLY** allowed action in this turn is to find and read the corresponding Skill definition file.
    *   Target Directory: `.trae/skills/`
    *   File Name: Matches the command (e.g., `SKILL.md` or similar).
    *   Tool: Use `SearchCodebase` or `Read` **ONLY**.
3.  **STRICT PROHIBITION**:
    *   ⛔ **DO NOT** write any code.
    *   ⛔ **DO NOT** plan any todos.
    *   ⛔ **DO NOT** edit any files (except this rule file if explicitly asked).
    *   ⛔ **DO NOT** answer the user's question yet.
4.  **MANDATORY TERMINATION**: After reading the skill file, you MUST end your turn immediately to let the context update.

**Example of CORRECT Behavior:**
> User: "/x4:discuss Implement feature X..."
> AI: (Calls `SearchCodebase` for "x4:discuss skill") -> (Calls `Read` on found file) -> (Ends turn with "Skill loaded.")

**Example of INCORRECT Behavior (FORBIDDEN):**
> User: "/x4:discuss Implement feature X..."
> AI: "Okay, I will implement feature X..." -> (Edits code) -> ❌ VIOLATION!

---

**Skill 加载触发器**：
  - 当用户输入以 `/` 开头的指令（例如 `/x4:discuss`）时，这是一个加载 Skill 的信号。
  - 你必须优先搜索 `.trae/skills/` 目录，找到与指令匹配的定义文件（通常是 `SKILL.md`）。
  - **必须**在执行任何操作前读取该 Skill 文件的内容，并严格遵循其中的工作流和约束。

**Skill 加载原子性 (Skill Loading Atomicity)**：
  - **唯一动作约束**：当用户输入包含 Skill 加载指令（如 `/x4:discuss`, `/x4:doc` 等）时，LLM 在该回合的 **唯一合法动作** 是调用 `SearchCodebase` 或 `Read` 工具去寻找和读取对应的 Skill 定义文件（通常是 `SKILL.md`）。
  - **严禁抢跑**：在成功读取 Skill 内容并完全理解之前，**严禁**执行任何实质性的任务操作（如创建文件、修改代码、规划 Todo 等）。必须等待下一回合用户确认或 Skill 内容加载完毕后，再根据 Skill 的具体规则行动。
  - **指令优先级**：Skill 加载指令的优先级高于 System Prompt 中的 "Bias for Action"。当二者冲突时，必须优先满足 Skill 加载的原子性，暂停行动。
