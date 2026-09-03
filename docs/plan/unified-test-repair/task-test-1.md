# Test Task Contract

- Task: `task-test-1`
- Bundle generation: `1`
- Phase artifact: `task-test-1.md`
- Plan: `plan-1.md`
- Lane manifest: `lanes-1.md`
- Context: `context-1.md`
- Evidence target: accepted `task-coding-2` merge on target branch `develop`, containing `task-coding-1`
- Task kind: `test`
- Mode: `hard`
- Mode basis: 191 个现/旧 unit spec 的需求分类、迁移、去重、mock/fixture 修正共享同一 collection 和 public-boundary 判断，拆给多个 owner 易产生重复与相反删除结论。
- Execution strategy: `single-sup`
- Worker role: `sup_coding_worker`
- Lane: `integrate`
- Worktree: `/home/slepher/project/x4-station-calculator/.worktree/integrate`
- Branch: `codex/unified-test-repair-g1-integrate`
- Base: dispatcher 在 covered coding tasks 合入后绑定的 exact target HEAD
- Depends on: `none`
- Covers: `task-coding-1, task-coding-2`

## Bounded goal

把 unit 测试收敛到 `tests/unified-unit/`：迁移 `tests/unit/` 中仍有独立现行价值的覆盖，修复 unified 的 import/mock/setup/fixture/版本断言，删除退役实现和重复测试。只改 test-owned paths，不以修改产品来迎合旧预期。

## Coverage objectives

1. 所有保留 spec 可收集，禁止引用已删除的 `useEmpireStore`、`StationStateMap`、`stationComputeService`、旧组件路径或不存在的 map panel。
2. i18n、Pinia、gameData 与 map fixture 使用当前公开 seam；共享 setup 足够时不在每个 spec 复制全局 mock。
3. storage/schema/version 测试从当前导出常量或版本配置验证行为，不固定 v2/8.0 等历史数字。
4. Sidebar presenter/component/store tests 覆盖稳定 test-id、概览/station/Transit/menu 和 blueprint reorder；不检查旧 TabBar class/DOM。
5. 旧目录中的较新 build-plan、terraforming、map、version switch 等测试逐项判断：有独立现行行为则迁移；重复、私有实现或已退役需求则删除。
6. 测试不通过新增 fallback、过度 stub 或断言“函数存在”来替代行为；优先使用公开 store/presenter observable。

## Owned paths

- `tests/unified-unit/`
- `tests/unit/`

`tests/unit/` 只作为迁移/删除来源，完成时不得残留 `*.spec.ts`。产品、配置、fixture、E2E、skills tests、OpenSpec/guide/workflow 均只读。发现产品缺陷时保留最小 failing evidence 并停止，不得在 integrate lane 修产品。

## Ordered work

1. 冻结 target/integrate candidate，重跑当前 unified unit，按收集失败、setup/runtime、过期预期、疑似产品行为分类。
2. 先处理 34 个未收集文件：对齐当前 import；仅服务已退役 module/component 的测试直接删除。
3. 处理共享 mock/fixture 根因：i18n default export、active Pinia、fixture path、cluster shape、`getStorageKey` 等；能由 coding-2 公共 setup 解决的 spec 不再自带替代实现。
4. 处理 assertion failures：以当前 OpenSpec/guide/public API 为准；固定旧版本或私有结构的断言迁移或删除。
5. 扫描 `tests/unit/`，只迁移 unified 缺失的现行行为测试；同场景保留断言最强、依赖最少的一份。
6. 为 coding-1 的 stable test-id/presenter/reorder 补最小 unit coverage，不复制 E2E 用户链。
7. 运行完整 canonical unit 与 skills unit，确认默认配置不再采集 legacy 路径。

## Deletion evidence

每个删除文件在 handoff 分类为以下之一，并给出当前权威/等价覆盖：

- `retired-implementation`
- `duplicate-weaker`
- `archived-bug-detail`
- `obsolete-version-contract`

仅“现在失败”不是删除理由。若不能给出分类与证据，保留并修复。

## Blocking self-validation

- Commands: `npm run test:unit -- tests/unified-unit`; `npm run test:unit -- tests/skills/unit tests/e2e-skills/unit`; `rg -n "useEmpireStore|StationStateMap|stationComputeService|MapResourceFilterPanel|StationTabBar|SectorStationTabBar" tests/unified-unit`; `find tests/unit -type f -name '*.spec.ts'`; `git diff --check`

`rg` 与 `find` 的接受结果为无未解释匹配/无 legacy spec；任何保留匹配必须在 handoff 逐条说明。

## Required evidence

- exact target/integrate candidate、initial/final file/test counts、changed/deleted paths。
- 每个初始失败簇的 root-cause -> repair/delete mapping。
- legacy migration/deletion ledger，含当前权威或等价覆盖。
- Sidebar/reorder requirement-to-case map、完整命令/exits、skip/warning 与未运行项。

## Observable completion

- canonical unified unit 与 skills unit 在同一 immutable candidate 通过。
- `tests/unit/` 无 spec，Vitest 默认收集结果与 sitemap 一致。
- 无退役 import、硬编码旧 schema/version、虚假 public mock 或旧 TabBar DOM 断言。
- 删除均有需求退役/等价覆盖证据，没有因产品 failure 直接删测试。

## Stop conditions

- covered coding 未进入 target/integrate、candidate 改变、需要修改产品/config/fixture、当前规范互相冲突、或失败表现为真实产品回归。
- 删除用例无法证明过期/重复，或迁移会改变公开产品语义。

## Handoff

返回 `Status`、exact candidate、failure classification、迁移/删除 ledger、changed paths、final counts、commands/exits、product findings 和 risks。不得 stage/commit/merge、修改产品或宣布 initiative complete。
