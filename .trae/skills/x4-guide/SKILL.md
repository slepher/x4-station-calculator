---
name: x4-guide
description: "根据当前 change 或用户描述，按 behavior/anchor/index/functions 结构增量维护 guide 文档与模块子文档（empire/logic-flow/ship），保持行为、UI 锚点、函数映射与导航索引同步。"
---

# X4 Guide

在 X4 项目中，`guide/` 文档用于描述：
- `behavior`: 系统行为（用户如何触发、系统如何响应）
- `anchor`: UI 锚点（测试/定位所需的稳定入口）
- `index`: 可选导航索引文档（用于目录映射与树形结构）
- `functions`: 函数名到实现位置/状态的映射（各目录可选）

该 skill 的目标是 **增量更新**，不是全量重写。

## Trigger

- 用户提到 `/x4:guide`
- 或用户要求在实现某个 change 时同步更新 `guide/**`
- 或用户给出一段需求/行为描述，要求补齐对应 guide 文档
- 或用户明确要求补充 behavior/anchor/functions 文档

## Core Policy (MANDATORY)

1. 只改与当前 change 或当前用户描述直接相关的条目；不要全量重写 8 个文件。
2. 优先最小改动：保留未受影响段落与结构。
3. 若代码尚未提供稳定定位（如 `data-testid`），在 `anchor.md` 写明 `待实现`，不要编造已存在选择器。
4. 文档必须让 test case 编写者可落地：至少包含触发动作、目标页面/区域、可断言结果。
5. 顶层切换（tab）发生变更时，必须同步更新：
   - `guide/behavior.md`
   - `guide/anchor.md`
   - `guide/index.md`
6. 模块内行为发生变更时，只更新对应模块目录：
   - `guide/empire/*`
   - `guide/logic-flow/*`
   - `guide/ship/*`
7. `index.md` 为可选文档：仅在需要目录映射或树形导航时维护“业务目标到目录映射 + 目录树”。
8. `behavior.md` / `anchor.md` 不承担跨层目录导航；跨层路由统一通过 `index.md` 链式维护。
9. 选择器语义必须明确并保持一致：
   - `.xxx` 表示 class 选择器（用于页面区域可见性断言）。
   - `[data-testid='xxx']` 表示 testid 属性选择器（用于稳定交互定位，优先级高于 class）。
11. 条件判断来源规则（MANDATORY）：
   - 文档中的 `enable` / `disable` / `expected` 条件必须来自页面可达信息（DOM 属性、可见性、可交互状态、可读取文案等）。
   - 不得使用页面不可达的内部状态作为断言条件。
   - 若当前条件无法从页面直接到达或验证，必须在条目中显式标注为疑问（如 `疑问:` / `pending-question:`），等待确认后再固化。
12. 当更新任意下层 `index.md`（如 `guide/empire/index.md`）时，必须循环更新其上层目录树：
   - 先更新最近父级目录的树形结构
   - 再继续向上直到 `guide/index.md`
   - 保证上层树形目录始终反映最新下层结构
13. `pending` 章节规则（MANDATORY）：
   - `anchor.md` 必须包含 `## Pending` 章节；`functions.md` 若存在，也必须包含 `## Pending` 章节。
   - 章节内容保持极简，仅维护名字引用。
   - 允许空集合：`pending: []`。
   - `functions.md` 可在函数条目使用 `pending:true`，并在 `pending:` 列表重复该函数名。
14. `functions.md` 作用域与查找规则（MANDATORY）：
   - `functions.md` 在任意目录均为可选（如 `guide/functions.md`、`guide/ship/functions.md`、`guide/ship/workbench/functions.md`）。
   - `behavior.md` 中引用 `fn` 时，按“就近优先”解析：
     1) 先查当前目录 `functions.md`
     2) 再逐级查父目录 `functions.md`
     3) 直到顶层 `guide/functions.md`
   - 首个命中的函数定义即为生效定义；若全链路未命中，必须写入 `pending` 或 `疑问`，禁止假设实现位置。
15. `anchor` 中函数调用参数规则（MANDATORY）：
   - `anchor.md` 中的函数调用统一使用 `args` 数组，不使用对象键值参数。
   - `args` 每一项必须说明页面来源（如 selector + attr/text/value）。
   - 若某个参数页面不可达，不得省略；该参数必须标记 `pending:true`，并加入 `## Pending` 名单。
   - `pending` 名单仅保存参数名或函数名引用，保持最简。
16. `preset` 模板规则（MANDATORY）：
   - 需要“预查找数据”时，在对应 `behavior.md` 增加 `## Preset` 章节。
   - `behavior` 条目通过 `preset_ref` 引用预设数据，不直接内联大段实例数据。
   - `preset` 必须使用变量化占位（如 `$ship_id`、`$slot_plan`、`$input.ship_id`），禁止写死具体业务 ID（如 `ship_ter_m_corvette_01_a`）。
   - 函数调用推荐字段：`fn` + `args`（数组）+ `chain`（如 `nth(0)`）。
   - 若 `args` 中参数无法从页面读取但有固定来源，使用 `preset`/固定来源描述；仅在来源不确定时写 `pending`。

## Update Workflow

1. 确定更新来源：
   - 有当前 change：以 change 实际改动为准。
   - 无明确 change：以用户描述的行为/页面为准。
2. 识别影响范围（top-level / empire / logic-flow / ship）。
3. 读取受影响的 `guide` 文件现状。
4. 仅补充或修订受影响条目，保持树形结构语义一致。
5. 为每个新增/变更行为补充最小测试信息：
   - 触发方式（点击/输入/拖拽）
   - 前置条件（若有）
   - 成功判定（可见性/激活态/数据变化）
   - `expected` 字段（`action` 行为必填），用于描述该 behavior 执行后的结果
   - 涉及批量或预查找参数时，补充 `preset_ref` 与 `fn/args/chain` 字段
6. 为每个新增/变更锚点补充最小定位信息：
   - `anchor_id`
   - `type`（tab/button/panel/input/...）
   - 推荐定位策略（优先 `data-testid`，其次 role+name）
   - 若锚点包含函数调用，使用 `args` 数组声明参数来源；页面不可达参数进入 `pending`
7. 当需要维护目录映射或树形导航时，更新 `index.md`（固定两章）：
   - 第一章：`子目录`
   - 第二章：`树形结构`
8. `index.md` 第一章格式：
   - 使用 `guide.<domain> -> <folder>`（如 `guide.logic-flow -> logic-flow`）
9. `index.md` 第二章格式：
   - 仅写目录树，不写文件名
   - 使用相对根 `.`，不写 `guide/` 前缀
10. `behavior` 条目中的 `index` 字段遵循强制规则（有且仅有）：
   - 同级存在 `index.md` 且条目需要该层目录解析时，必须提供 `index` 字段。
   - 同级不存在 `index.md` 时，禁止提供 `index` 字段。
11. 若存在 `index.md`，且 `behavior.md` / `anchor.md` 出现重复目录映射内容，优先删重复并保留 `index.md`。
12. 顶层第一章格式要求：
   - `behavior` 文档使用单章结构，不再拆分“总览/详细”两章。
   - `behavior` 分四类：`action` 行为、`zone` 引用、`switch` 状态切换、`select` 列表选择。
   - `enable` / `disable` 为通用标签，可附加在任意 `behavior` 类型上，用于表达启用条件。
   - `enable` 表示“满足条件时可执行/可见”；`disable` 表示“不满足条件时不可执行/不可见”。
   - 推荐将条件写成可断言语句（如状态值、按钮是否可点击、字段是否为空）。
   - 可操作对象必须使用 `action` 字段；不可操作对象必须使用 `zone` 字段。
   - `zone` 条目使用 `zone` 字段表达。
   - `zone` 用于对子目录区块的引用，推荐字段：`zone`，`index` 按需提供。
   - `zone` 条目不引用具体文件名；具体文件解析统一交给对应层级的 `index.md`。
   - `switch` 用于描述互斥状态之间的切换关系（如 `selector <-> workbench`）。
   - `switch` 推荐字段：`switch`、`from`、`to`、`trigger`、`expected`（状态变化结果）。
   - `select` 用于描述“从候选列表中选择一个值”。
   - `select` 推荐字段：`select`、`source`、`value`、`expected`。
   - 下拉框类 `action` 推荐补充 `data` 字段：
     - `data.control`: 控件类型（如 `select`）
     - `data.options_ref`: 选项来源引用（如 `guide.language.options`），选项明细可放在下层文档
   - 每条 behavior 使用详细条目格式。
   - 顶层 behavior 条目可写 `index` 用于目录引用；是否提供取决于是否需要同级 `index.md` 解析。
   - `action`、`switch`、`select` 条目必须包含 `expected` 字段，且语义应可被测试断言；`zone` 条目可不写 `expected`。
   - `guide/anchor.md` 第一章与 `guide/behavior.md` 一一对应（同顺序、同数量）。
   - `guide/anchor.md` 第一章每条格式固定为：`<behavior_id> -> 点击 <locator>，断言 <assert_locator>`。
   - 其中 `<locator>` 优先使用 `data-testid`；`<assert_locator>` 可使用 `data-testid` 或 `.class`。
14. 输出变更文件列表与简要说明。

## File Scope

- Top-level:
  - `guide/behavior.md`
  - `guide/anchor.md`
  - `guide/index.md`
  - `guide/functions.md`（可选；子目录同名文件也可选）
- Module-level:
  - `guide/empire/behavior.md`
  - `guide/empire/anchor.md`
  - `guide/logic-flow/behavior.md`
  - `guide/logic-flow/anchor.md`
  - `guide/ship/behavior.md`
  - `guide/ship/anchor.md`

## Output Requirements

完成后必须给出：
1. 实际修改了哪些 `guide` 文件。
2. 每个文件对应的变更点（一句话）。
3. 若存在 `待实现` 锚点，明确列出，方便后续补代码或补测试。
