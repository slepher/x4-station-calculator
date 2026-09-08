# Generation 6 输入核验

核验日期：2026-09-08；仓库：`/home/slepher/project/x4-station-calculator`。这是 planner 只读事实，不是任务完成、测试通过或 runtime status。

| 核验 | 实际结果 |
| --- | --- |
| `git status --short` | 创建本代前仅 `?? docs/plan/unified-test-repair/workflow-resume-handoff.md` |
| `git diff --stat` | 空；tracked 工作树没有差异 |
| `git rev-parse HEAD` | `d0614371558b2f6b30e8fd6b148347868228c413` |
| `git branch --show-current` | `develop` |
| `test ! -e docs/plan/unified-test-repair/generation-6` | exit 0，随后创建新目录 |
| `sha256sum --quiet -c docs/plan/unified-test-repair/direct-migration/generation-1/evidence/input-manifest.sha256` | exit 0，无不一致项；2496 项历史内容均一致 |

旧 [manifest](../direct-migration/generation-1/evidence/input-manifest.sha256) 的 SHA-256：`857ee9beea436b7dbaca73e7512a817e1dfb723875d7d5fdef75ebc841afb9ec`。旧 input-status 属于旧快照，不能恢复或套到本树。当前 immutable Base 已足以标识 tracked 内容；后续变更须另留存实际候选。untracked handoff 是已有用户/dispatcher 工作，本 planner 不修改。

已读取 direct-migration handoff、README、generation-1 四份规划、相关原任务与结果，以及 generation-4/5 plan、旧 status、generation-5 current-failure-summary 和 M13/M14 独立 review。最新单次结果优先于同文件旧失败段；没有新的执行结果或接受记录。M6.1 pending/README 审核、M8.3/M9.1 独立接受、M10.4 审核对应仍交 T002/T003 精确核对。

已读取当前 playwright.config.ts、package.json、vitest.config.ts 和 `tests/e2e/build-ui-component/build-ui-component.spec.ts`。配置为 canonical `tests/e2e`、fullyParallel、stdout `Local:` readiness、默认 build→preview；Unit 默认 `tests/unit/**/*.spec.ts`。建材 UI spec 为六项真实 UI 事务，固定 9.0 recipe 的 volume=18,172 m³、time=756 秒、workers=90，适合作为 T010 小型 browser witness。没有运行 build、Unit、E2E，也没有把历史 /tmp 日志当当前可用产物。
