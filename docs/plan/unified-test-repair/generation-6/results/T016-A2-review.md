- Task: T016
- Contract revision: 4
- Result: T016-A2.md
- Candidate snapshot: `tests/e2e/map/x4-import-move.spec.ts` SHA-256 `a318db00d1bbb4c4a5d16799ac768cb43aca51959b7582e9e1c85fe13698091d`（本次只读复核与 result/evidence 一致）
- Verdict: changes-required

## Findings

### F1 — High — 8.0 游戏版本与 storage key 未在 fixture 中冻结

- Evidence: 合同 Acceptance 2 要求先固定游戏版本及对应 storage key。候选 `tests/e2e/map/x4-import-move.spec.ts:167-172` 只复制 `db.json`、替换 `activeEmpire.sectors` 并注入；`db.json` 不含 `x4_game_version`。当前 `src/assets/versions.json` 默认版本是 9.0，`Desktop Chrome` 新 context 无既存版本时会由 `useGameDataStore.initialize()` 选 9.0，并使用 `x4_empire_data_v9`；候选却注入并在 `saveAndReload()` 中期待 8.0 的 `x4_empire_data`。A2 的 Chromium 命令在 webServer build 阶段 exit 2，未执行浏览器，因此没有运行事实排除此缺陷。
- Owner: T016 implementation owner。
- Allowed correction: 在本 spec 的局部 fixture 注入前显式写入 `dbData.x4_game_version = { version: '8.0', beta: false }`，继续只使用既有 8.0 fixture/key；不改共享 fixture、helper 或产品代码。
- Verification: 冻结修正后的 spec/config/fixture 指纹，在独占 `shared-dist-build`、`chromium-runtime`、`preview-port-23116` 下执行合同完整 8-test 命令，要求 fresh build、exit 0、8 passed、0 failed/skipped/flaky/retried。

### F2 — Medium — Save/reload 后没有再次断言 active empire 与 storage identity

- Evidence: `saveAndReload()` 在 reload 前检查 `storageKey`、`savedEmpires.activeId`、`activeEmpire.id`（`tests/e2e/map/x4-import-move.spec.ts:82-85`）；reload 后只返回 `readEmpireState()`。两个调用方在 `:333-340` 与 `:367-374` 只检查 station/sector/location/placed，未检查返回值中的 `storageKey`、`activeEmpireId`、`activeEmpireObjectId`。因此局部静态证据证明 dirty true → Save → dirty false 以及实体 location 可从 reload 后 active object 读出，但没有满足合同要求的 reload 后 active empire/save identity 显式断言。
- Owner: T016 implementation owner。
- Allowed correction: 在 reload 后、helper 返回前断言 8.0 storage key、`savedEmpires.activeId === 'empire-1'`、`activeEmpire.id === 'empire-1'`；保留两个实体的不同 id、未放置对照及各自 location 断言。
- Verification: 同 F1 的单次完整 8-test 独占运行；该断言必须在 reload 之后执行，不能用 reload 前 state 或仅凭 placed class 替代。

### F3 — Medium — 当前合同的 `{x,y,z}` 与规范/领域形状冲突，候选的 `y` 断言是合成值

- Evidence: T016 Revision 4 Acceptance 3 写 `{x,y,z}`，但 `openspec/specs/map-station/spec.md:91-95` 和 `EntityLocation`（`src/types/x4.ts:448-457`）的持久化形状均为原始 `{x,z}`。候选 `expectPlacement()` 在 `tests/e2e/map/x4-import-move.spec.ts:54-58` 通过 `{ x: location.pos.x, y: 0, z: location.pos.z }` 人工构造 `y: 0`，没有读取或验证候选数据中的 y。
- Owner: planner owns contract semantics；若坚持新增 y，则需另行分配产品 owner，T016 不能用合成值关闭它。
- Allowed correction: planner 将合同位置形状校正为现行规范的 `{x,z}`，并删除无效 y 断言；或在取得明确产品权威后扩展领域/持久化形状，再由 T016 对真实 y 做读回断言。不得保留当前伪 witness。
- Verification: 对修订后的合同与 `EntityLocation` 形状做静态一致性复核；随后执行 F1 的完整独占运行。

## Acceptance

局部可接受证据：候选保留原 3.1–3.6 六个 import 场景；新增 station 与 sector 两条真实 mouse down/move/up 路线；分别检查对象 id、目标 `cluster_id`/`sector_id`、独立静态中心 `{x:192000,z:-128000}`（6000 容差）、sunlight 123、五项 resources、overlay key、另一实体 location 未被误改，以及 dirty true → UI Save → dirty false → reload 后 location。目标值与 8.0 静态地图一致，不由被测转换函数反推。

但 F1/F2 使版本/保存身份合同未闭合，F3 使位置形状合同与权威输入不一致；同时 A2 只有 collection 8 和 diff-check 成功，浏览器 0 项执行。当前候选不得接受。

## Explanation

T016 已从旧 7 项补成静态上完整的 station/sector 双路线，但尚不是可执行验收证据。先做上述最小测试/合同修正，再以修正后候选独占重跑整份 8-test spec；不得拼接 A1 的 7/7、A2 的 collection 或其他任务的 build。T025 的最终全量仍是后续独立边界。
