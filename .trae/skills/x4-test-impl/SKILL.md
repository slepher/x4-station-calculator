---
name: x4-test-impl
description: "Implement and supplement Unit/E2E test code for X4 Station Calculator. Trigger with /x4:test-impl <change-name>."
metadata:
  version: "1.12"
---

# X4 Test Implementation

This skill handles test implementation updates for the X4 Station Calculator project.

## Trigger

User invokes `/x4:test-impl <change_name>`

## Purpose

Implement and supplement Unit/E2E/Bug/Bug-fix test code based on `test_tasks.md`, with mandatory task-to-test correspondence that can be validated by script.

## Parameters

- `<change_name>`: The name of the change folder in `openspec/changes/` (e.g., `storage-auto-fill`).
- `<change_name>` accepts abbreviation token and must be resolved by `x4-user-workflow` "Change Name Resolution" rules.

## Change Name Resolution (MANDATORY)

- Resolve `change-name` using `x4-user-workflow` rules before any action.
- If multiple matches or no match, stop and ask the user to choose; list available active changes.
- Do not auto-create a change on resolution failure.
- After resolution, print: `Resolved change: <change-name>`.

## Input

- `openspec/changes/<change-name>/test_tasks.md`
- `openspec/changes/<change-name>/ui_knowledge.md`
- `openspec/test_experience.md`
- Existing tests under `tests/unit/<change-name>/` and `tests/e2e/<change-name>/`

## Actions

1. Resolve change target and load test planning inputs.
2. Implement or update missing Unit/E2E/Bug/Bug-fix tests with 1:1 task mapping.
3. Run validation script and fix mapping issues.
4. Run syntax/type check and fix type-level issues.

## Mandatory Requirements

### Chapter A: Agent-Only Mandatory

#### A.1 Execution Baseline (MANDATORY)

1. 路径与目录约束
   - `UNIT_DIR = tests/unit/<change-name>`
   - `E2E_DIR = tests/e2e/<change-name>`
   - 禁止读写或兜底到其他目录
2. 目录处理
   - 如果 `UNIT_DIR` 或 `E2E_DIR` 不存在，立即创建
3. 映射原则
   - 严格按 `test_tasks.md` 进行 1:1 用例映射
   - 仅补足缺失断言/步骤，不破坏既有通过结构
4. 结果回传
   - 返回新增/修改文件、映射数量、未映射项（精确到任务编号）

#### A.2 Test Authoring Standards (MANDATORY)

- Unit 使用 Vitest + Pinia 既有模式。
- E2E 使用项目 `test-setup` 与 `ui_knowledge.md` 提供的定位语义。
- 断言必须是可观测结果断言，禁止低信息量布尔旗标式断言。
- 多分支任务（A/B）必须分别落地断言。
- 拖拽类场景遵循 `x4-drag-test` 规范，优先稳定 identity locator（`data-*`）。

#### A.3 State/Transition Authoring (MANDATORY)

当任务定义了状态/切换语义时，必须：

1. 提供可复用 helper（建态、断态、切换）。
2. 状态项有对应状态 case，切换项有对应切换 case。
3. 切换 case 执行顺序为：build -> assert(from) -> switch -> assert(to)。
4. 场景 case 复用 helper，避免散落式重复 setup。

#### A.4 Guardrails (MANDATORY)

- 不运行 `npm run build` 或完整 `npx playwright test` 作为本 skill 的默认动作。
- 不在 `test_tasks.md` 写入通过/失败标记。
- 禁止为了通过验证脚本而修改 `test_tasks.md`。

#### A.5 Mapping Semantics (MANDATORY)

- 规范要求 case/注释中“标号后的文本语义”应与 `test_tasks.md` 对应项一致。
- 即使 verify 当前不自动判定全文语义一致性，agent 仍必须按语义一致原则实现与维护测试代码。

### Chapter B: Agent+Verify Mandatory

#### B.1 Execution Flow With Verify (MANDATORY)

固定流程：实现测试 -> 跑脚本 -> 修复 -> 再跑。

命令：

```bash
python3 skill-scripts/validate_test_case_refs.py <change-name> --json
```

#### B.2 Mapping Contract (MANDATORY)

验证只覆盖任务到测试实现的对应关系：

1. 任务文件与测试文件对应。
   - 对应关系为双向：缺失映射与多余映射（case/comment）都应报错。
2. 顶层任务编号（`x.x`）对应 case 描述前缀编号。
3. 二级/三级任务编号（`x.x.x` / `x.x.x.n`）对应 case 内注释编号。
4. 若任务含 `#期望: [...]`，则对应代码块必须存在断言，且断言值覆盖期望值。
5. spec 文件内 case 标号必须按编号递增顺序出现。
6. 单个 case 内注释标号必须按编号递增顺序出现（同级与层级展开均需满足顺序约束）。
7. 当前 verify 脚本仅强制校验标号映射与顺序，不对“标号后全文语义一致性”做自动判定。

#### B.3 File Discovery Rules (MANDATORY)

- 变更模式（`change`）文件发现：
  - Unit: `tests/unit/<change-name>/<change-name>.spec.ts|.spec.test`
  - E2E: `tests/e2e/<change-name>/<change-name>.spec.ts|.spec.test`
  - Bug: `tests/e2e/<change-name>/bug-<change-name>.spec.ts|.spec.test`
  - Bug-fix: `tests/e2e/<change-name>/bugfix-<change-name>.spec.ts|.spec.test`

#### B.4 Step Content Rules (MANDATORY)

- 每个任务子项必须有同编号注释块。
- 注释块后必须有实际代码（不能只有空行/注释/符号）。
- 对纯二层任务：每个 `x.x.x` 注释块到下一个同级注释、上级注释或 case 结束之间，必须有实际内容。
- 对含三层任务：每个 `x.x.x.n` 注释块到下一个同级注释、上级注释或 case 结束之间，必须有实际内容。

#### B.5 Chapter 4 Route Rules (MANDATORY)

Chapter 4 需要同时映射 `bug` 与 `bug-fix` 两类文件，并按语义拆分校验：

- `修复前` 期望只对应 `bug` 文件，不要求对应 `bug-fix`。
- `修复后` 期望只对应 `bug-fix` 文件，不要求对应 `bug`。
- 若 `修复后` 期望项为已勾选（`[x]`/`[✓]`），顶层项可不要求 `bug` case，但必须有 `bug-fix` case。

#### B.6 JSON Output Contract (MANDATORY)

验证脚本在 `--json` 下输出数组项：

```json
[{"case":"1"|"1.1"|"1.1.1"|"1.1.1.1"|"global","desc":"Desc","error_code":"CODE","error_msg":"Message"}]
```

要求：
- `case="1"` 表示章节级错误（非任务树节点定位）。
- `case="global"` 表示无法归因的全局错误（如路径解析失败）。
- 对单元测试断言建议至少校验 `case` 与 `error_code`。

#### B.7 Validation Workflow (MANDATORY)

1. 按 Chapter A 规则实现测试。
2. 运行 `validate_test_case_refs.py`（推荐 `--json`）。
3. 修复所有映射/注释/内容/期望值问题直至通过。
4. 运行 `npx tsc -p tsconfig.test-check.json --noEmit`，修复类型错误。

## Constraints

- 仅修改测试实现与本 change 相关文档。
- 禁止将实现缺陷通过放宽 `test_tasks.md` 规则来规避。

## Output

- Updated test implementation files under `tests/unit/<change-name>/` and `tests/e2e/<change-name>/`
- Validation outcome summary (mapping + syntax/type status)

## Example Usage

```
/x4:test-impl storage-auto-fill
```
