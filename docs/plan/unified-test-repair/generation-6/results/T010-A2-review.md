- Task: T010
- Contract revision: 3
- Result: T010-A2.md
- Candidate snapshot: 未形成可重建的同一候选快照；结果仅声明 Base `d0614371558b2f6b30e8fd6b148347868228c413`、branch `develop` 和选择性 SHA-256
- Verdict: changes-required

## Findings

### F1 — High — A2 没有保留完整候选身份，且所指 Unit 候选已经漂移

- Evidence: `T010-A2.md` 只说候选“includes the T012 store/test patch”，没有 A2 的 `git status`、diff/patch、完整 tracked/untracked 输入清单或 retained snapshot。A2 记录的 Unit 文件 SHA-256 是 `65ab5917...`，当前文件及 T012 最终结果是 `55671c24...`；旧内容未保留。T012 最终候选还包含 `DragTestPage.vue` SHA-256 `78d5448c...`，A2 未绑定该路径。当前配置、package、smoke spec、fixture、store 等已列路径的 SHA-256 与 A2 记录一致，但这不足以证明其余工作树输入在四条命令间冻结或等于 Base。
- Affected evidence: `results/T010-A2.md`、`evidence/T010-A2/`；不要求修改源码、测试、fixture 或配置。
- Correction owner: dispatcher/evidence runner。
- Allowed correction: 若仍有 A2 的精确 retained snapshot，补充其不可变身份、完整 patch/untracked 内容及命令共用该身份的证明；否则在重新冻结的当前候选上分配新 attempt。不能用当前文件替代已消失的 `65ab5917...` 内容。
- Verification: reviewer 能从 Base 加 retained patch 重建候选、复算全部输入哈希，并确认 Unit、collection、build/smoke 与 diff-check 均绑定该同一身份。

### F2 — High — Unit、collection 和 diff-check 只有结果转述，没有 A2 原始执行证据

- Evidence: A2 证据目录只保留 `.last-run.json` 和六个 `trace.zip`；没有 Unit、collection、smoke/build、sandbox 失败或 `git diff --check` 日志。因而不能独立确认 `npm run test:unit` 的 exit `0`、`179` files/`1,014` tests、`VITEST_SUITE` 未选择 skills、skip/flaky 情况，也不能把 `842` tests/`74` files 绑定为 A2 的完整 collection。A1 的 `collection.log` 确实记录同样的 `842/74`，但它绑定 A1 的较早候选，A2 未证明所有 collection 输入未变并明确复用该证据。
- Affected evidence: `results/T010-A2.md`、缺失的 A2 command logs。
- Correction owner: evidence runner；dispatcher 分配新的证据写入边界。
- Allowed correction: 保留每条原合同命令的 stdout/stderr、cwd、exit、环境选择和真实计数；若原始输出已不存在，重新运行新 attempt。若复用 A1 collection，必须先证明全部 config/package/E2E/imported collection 输入在 A1→A2 间不变，并在结果中明确标为复用而非 A2 新运行。
- Verification: 原始 Unit 日志显示 canonical `tests/unit/**/*.spec.ts`、`VITEST_SUITE` 非 skills、179/1,014、0 fail/skip/flaky；原始 list 日志显示仓库配置下完整 `tests/e2e` collection 的 842/74；diff 日志及 exit 可直接核对。

### F3 — Medium — 六项 browser 行为有 trace 支持，但 build/readiness/权限合同未完整留证

- Evidence: 六个不同 trace 均记录 Playwright `1.57.0`、Chromium/Chrome `143.0.7499.4`、端口 `23110`、六个预期标题与完成的断言；其中可见固定 `18,172 m³`、`00:12:36`（756 秒）和 `90` workers。`.last-run.json` 为 `passed` 且 `failedTests` 为空，未见 trace error，因此六项 smoke 的行为结果可接受为 `6/6`。但没有 webServer/build stdout，无法直接核对 build 输出/exit、`Local:` readiness 或首次 `listen EPERM`；结果也只记录“approved local-listener permission”，未记录 browser sandbox 模式。仓库配置证明预期命令是 build→preview、`reuseExistingServer: false` 和 `/Local:/` gate，不替代实际运行日志。
- Affected evidence: T010 的 build、readiness、port/permission/browser-sandbox 部分；六项 smoke 行为本身不需重写。
- Correction owner: evidence runner；权限事实若变化返回 T001/planner 指定 owner。
- Allowed correction: 补交同一成功命令的完整日志和权限/launch 记录；日志不存在则在新冻结候选上重跑。保留首次 `listen EPERM` 为失败环境证据，不得用成功 attempt 擦除。
- Verification: 日志同时显示内置 `npm run build` 成功、preview 的精确 `Local:` readiness、最终命令 exit `0`、6 passed/0 failed/0 skipped/0 flaky、实际 browser sandbox/launch 状态及失败与成功 attempt 的权限边界。

## Acceptance

| Contract item | Independent judgment |
|---|---|
| Canonical Unit `179/1,014` | **Not accepted**：计数合理但无 A2 完整日志、suite 环境和可重建候选绑定。 |
| Full collection `842/74` | **Not accepted as A2 evidence**：A1 有同数日志，A2 只有转述且输入复用未证明。它只是 collection，绝不是 full E2E execution/pass。 |
| Six-test smoke `6/6` | **Accepted only as bounded browser behavior**：六个 trace 与 `.last-run.json` 支持六项通过及固定 expected；不外推其他 E2E。 |
| Build | **Not accepted**：无 A2 build stdout/exit 的 retained evidence。 |
| Readiness | **Not accepted**：trace 证明页面可访问，但合同要求的 `Local:` stdout gate 未留证。 |
| Permission/browser sandbox | **Partially observed, not accepted**：成功 listener/browser 可由 trace 观察；首次 EPERM、批准边界和 browser sandbox 模式未留证。 |
| Dependency/browser identity | **Partial**：package/config 哈希匹配；trace 支持 Playwright 1.57.0 与 Chrome 143.0.7499.4；完整安装/runtime 身份未与 A2 snapshot 绑定。 |
| Evidence binding | **Not accepted**：选择性哈希和已消失的 Unit 内容不能重建统一候选。 |
| Full canonical E2E | **Not run**：842/74 是收集，6/6 是 focused smoke。 |

T010 revision 3 因 F1–F3 未满足，不能由本 review 接受。六项 smoke trace 是可保留的部分证据，但不能单独关闭 T010。

## Downstream consumption

T018、T019、T020、T021 均声明 `Depends on: ["T010"]`，并要求在 T010 完成且其实际 attempt 被接受后执行。因此当前四项均 **不可把 T010-A2 作为已满足依赖消费**。它们可以保留“仓库 runner 曾在 23110 启动 Chromium 并完成六项 smoke”的有限环境事实，但这不等于依赖闭合、当前候选 build 通过或 full E2E 通过。

恢复条件：dispatcher 取得关闭 F1–F3 的修订证据包或新 attempt，并由独立 reviewer 接受；随后显式把实际 T010 attempt/revision/candidate 绑定给 T018–T021。

## Explanation

A2 相比 A1 已证明 browser smoke 能实际运行且六项行为通过，也明确没有把 collection 写成 full E2E。剩余问题不是产品失败，而是合同要求的完整日志、build/readiness/权限记录和统一候选快照缺失。当前 verdict 只阻止用 A2 关闭 T010 及其依赖，不否定六项 trace 所证明的局部结果。
