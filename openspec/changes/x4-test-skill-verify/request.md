# 需求说明：x4-test-skill-verify

## 1. 目标
本 change 仅包含验证脚本需求，分为两章：
- `test-doc verify`：校验 `test_tasks.md` 文档结构与语义。
- `test-impl verify`：校验 `test_tasks.md` 与多个 `spec.ts` 的实现映射关系。

## 2. 适用范围
### In Scope
- `validate_test_tasks_refs.py` 规则与输出契约。
- `validate_test_case_refs.py` 映射校验规则（任务/注释/断言）。
- `tests/skills/unit` 与 `tests/skills/data/impls` 的样例组织与命名规范。

### Out of Scope
- agent 文档流程编排。
- 业务功能实现与 UI 逻辑。

## 3. test-doc verify 章节（文档校验）
`validate_test_tasks_refs.py` 负责：
1. 四章结构与标题文本校验：
   - 必须且仅能包含 `## 1 单元测试`、`## 2 E2E 标准状态与状态迁移`、`## 3 E2E 测试场景`、`## 4 Bug 测试`。
   - 顺序固定，允许空章。
2. 任务树层级与缩进校验：
   - 顶层：`- [ ] x.x <description>`（0 空格）；
   - 二级：`  - [ ] x.x.x <description>`（2 空格）；
   - 三级：`    - [ ] x.x.x.n <description>`（4 空格，可选）。
3. 连续编号校验：
   - 顶层、二级、三级在同父级下均需从 `.1` 连续递增。
4. 顶层任务类型校验：
   - Chapter 2 仅允许 `状态:` / `切换:`；
   - Chapter 3 仅允许 `Case:`，且 case 名在章内唯一且长度不超过 64；
   - Chapter 4 仅允许 `BUG-<number>: <bug-description>`。
5. 一级任务完整性校验：
   - 每个一级任务必须至少包含一个二级子任务。
6. 最后子任务期望规则校验：
   - 一级任务最后一个二级子任务需含期望语义；
   - 若该二级子任务本身不含期望语义，则其全部三级子任务都必须含期望语义。
7. 统一期望标记校验：
   - 含期望语义的任务项必须使用 `#期望: [...]`。
8. Chapter 2 引用完整性校验：
   - Chapter 2 中 `状态/切换` 项必须在 Chapter 3 或 4 的子任务中有显式引用路径。
9. Chapter 4 bug 子项语义校验：
   - 必须包含至少一个复现步骤（无 `#期望`）；
   - 必须包含至少一个 `修复前` 断言（含 `#期望`）；
   - 必须包含至少一个 `修复后` 断言（含 `#期望`）。
10. Chapter 4 编号特例校验（强制）：
    - `修复前` 与 `修复后` 断言必须使用同一任务编号；
    - Chapter 4 中仅此场景允许同号重复，其他编号仍需连续递增。
11. 输出契约校验：
    - 文本模式输出可读错误并以非 0 返回；
    - `--json` 模式输出 `[{case, desc, error_code, error_msg}]`。

## 4. test-impl verify 章节（实现映射校验）
`validate_test_case_refs.py` 仅检查以下内容：
1. `test_tasks.md` 顶层任务与四类 `spec.ts` 文件中的 case 对应关系。
2. 一级任务标号对应 case `desc` 的标号。
3. 二级/三级任务标号对应 case 内注释标号。
4. 区间内容规则：
   - 若仅有二级任务：每个二级标号到下一个二级标号（或 case 结束）之间必须有实际内容。
   - 若二级下有三级任务：每个三级标号到下一个三级标号（或 case 结束）之间必须有实际内容。
5. 期望断言规则：
   - 若任务含 `#期望: [...]`，对应区间必须存在断言；
   - 断言值必须对应 `#期望` 中的值。
6. Chapter 4 双文件规则：
   - 每个 BUG 任务同时对应 `bug-*.spec.ts` 与 `bugfix-*.spec.ts`；
   - `修复前` 期望只对应 `bug` 文件，不要求对应 `bugfix`；
   - `修复后` 期望只对应 `bugfix` 文件，不要求对应 `bug`；
   - 若 `修复后` 期望项被勾选，根任务可不要求对应 `bug`，但仍必须对应 `bugfix`。

## 5. 单元测试组织规范
1. 真正执行校验的单元测试目录：`tests/skills/unit/`。
2. impl 样例数据目录：`tests/skills/data/impls/`。
3. 数据样例命名：`test_tasks-N-<case-name>.md`。
4. 对应样例 spec 需拆分为四类，并与 `test_tasks` 放在同一目录 `tests/skills/data/impls/`：
   - `test-unit-N-<case-name>.spec.ts`
   - `test-e2e-N-<case-name>.spec.ts`
   - `test-bug-N-<case-name>.spec.ts`
   - `test-bug-fix-N-<case-name>.spec.ts`
5. `N` 固定两位数字（`01`~`99`，个位补零）。

## 6. 验收标准（DoD）
1. `request/spec/design/tasks` 明确区分 `test-doc verify` 与 `test-impl verify`。
2. `test-impl verify` 仅包含第 4 章定义的校验项。
3. `tests/skills/unit` 与 `tests/skills/data/impls` 已建立命名规范对应样例。

## 7. x4-test verify 章节（运行结果回写）
`x4-test` 的 verify 脚本改为“运行结果回写器”，不再做一致性校验：

1. 输入模型
   - 输入必须显式给出成功 case 集合与失败 case 集合；
   - 失败 case 必须给出失败标号位置（支持二级 `x.x.x` 与三级 `x.x.x.n`）。
2. 更新范围
   - 未提及的 case 视为未运行，不更新其状态；
   - 按“每次测试”作为更新单位（一次测试通常包含多个 case），测试完成后统一更新；
   - 多次测试按测试执行顺序串行应用，不做并发批量更新。
3. 失败回写规则（同级规则）
   - 失败标号位置标记为 `[✗]`；
   - 同级中失败项之前标记为 `[✓]`；
   - 同级中失败项之后标记为 `[ ]`；
   - 失败项的父任务链路标记为 `[✗]`；
   - 上述规则同时适用于二级和三级子任务。
4. 成功回写规则
   - 成功 case 的顶层任务及其已定义二级/三级子任务均标记为 `[✓]`。
5. `--mode=test` 单元测试特例（仅本次单测）
   - 新增数据目录：`tests/skills/data/runs/`；
   - 文件命名沿用 test-impl verify 规则：
     - `test_tasks-NN-<case-name>.md`
     - `test-unit-NN-<case-name>.spec.ts|.spec.test`
     - `test-e2e-NN-<case-name>.spec.ts|.spec.test`
     - `test-bug-NN-<case-name>.spec.ts|.spec.test`
     - `test-bug-fix-NN-<case-name>.spec.ts|.spec.test`
   - 额外增加期望输出文件：`test_tasks_run-NN-<case-name>.md`（回写后的基准结果）；
   - `--mode=test` 下不得修改 `test_tasks-NN-<case-name>.md` 原文件，需以输出结果对照 `test_tasks_run-*` 做校验。
