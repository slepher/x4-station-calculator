# Tasks: x4-test-skill-verify

## 1. test-doc verify

- [ ] 1.1 维护 `validate_test_tasks_refs.py` 的四章结构与编号规则校验。
- [ ] 1.2 维护 Chapter 2/3/4 语义与 Chapter 4 专项规则校验。
- [ ] 1.3 维护 `--json` 输出契约与错误归因稳定性。

## 2. test-impl verify

- [ ] 2.1 在 `validate_test_case_refs.py` 实现任务到四类 `spec.ts`（unit/e2e/bug/bug-fix）的映射校验。
- [ ] 2.2 实现 Chapter 1/4 顶层编号到 case 名、二/三级编号到注释标号的映射校验。
- [ ] 2.3 实现 Chapter 1/4 二层/三层“标号区间”实际内容校验。
- [ ] 2.4 实现 Chapter 1/4 `#期望: [...]` 的断言存在与值级匹配校验。
- [ ] 2.5 实现 Chapter 2 严格 helper 化校验：`2.x` case 禁止步骤注释/断言/业务操作；状态 case=1 helper，切换 case=2 helpers（先状态后切换）。
- [ ] 2.6 实现 Chapter 2 helper 内步骤注释区间与 `#期望` 断言校验。
- [ ] 2.7 实现 Chapter 3 `状态/切换` 子步骤到 Chapter 2 helper 的调用映射与“先状态后切换”顺序校验。
- [ ] 2.8 实现 helper 定位策略：基于 `case -> helper` 调用链静态解析（支持 `describe` 内 helper）。
- [ ] 2.9 实现 Chapter 4 `bug`/`bugfix` 双文件归属校验。

## 3. 单元测试与样例

- [ ] 3.1 在 `tests/skills/data/impls/` 新增样例集：`test_tasks-N-<case-name>.md` + `test-unit/test-e2e/test-bug/test-bug-fix` 四类 spec。
- [ ] 3.2 在 `tests/skills/unit/` 新增真正执行校验的单测（读取并验证 `tests/skills/data/impls/` 样例）。
- [ ] 3.3 补充 Chapter 2 严格 helper 化反例/正例样例（case 内联步骤、helper 缺失、helper 非唯一、helper 内缺注释）。
- [ ] 3.4 补充 Chapter 3 状态/切换 helper 复用与顺序校验样例（缺状态调用、缺切换调用、顺序错误、引用未定义 helper）。
- [ ] 3.5 确保 `N` 为两位数字以保持排序。

## 4. x4-test verify（运行结果回写）

- [ ] 4.1 将 x4-test verify 脚本职责改为结果回写，不再执行一致性校验。
- [ ] 4.2 支持显式输入成功/失败 case 集合，失败 case 支持二级/三级失败标号。
- [ ] 4.3 实现“未提及 case 不更新”与“按测试执行顺序、按次测试统一更新”。
- [ ] 4.4 实现失败回写规则：失败点 `[✗]`、同级前 `[✓]`、同级后 `[ ]`、父链路 `[✗]`（二级/三级均生效）。
- [ ] 4.5 实现成功回写规则：成功 case 顶层及其已定义二/三级子任务全部 `[✓]`。
- [ ] 4.6 新增 `--mode=test` 专用样例目录 `tests/skills/data/runs/`，支持 `test_tasks_run-NN-<case-name>.md` 作为期望输出基准。
- [ ] 4.7 确保 `--mode=test` 不修改输入 `test_tasks-NN-<case-name>.md` 原文件。
