- Task: T015
- Contract revision: 4
- Result: T015-A1.md (`sha256:1abd217197c269fd31071f8ec23d899603d632380acab5991391e1c8ed3b2853`)
- Candidate snapshot: `evidence/T015-A1/candidate.sha256` (`sha256:8309efca5babcf5fc1cc299b704527601e82695ded5e6e6a9b0d608cea81327c`); T015-only patch `sha256:452f89c46909c227d6e16e669a19e9d3756ce310e426b8907776cf5343b0190c`
- Verdict: changes-required

## Findings

### F1 — High — 契约要求的 97 项独占浏览器验证尚未运行

- Owner: dispatcher/evidence runner for exclusive resource; T015 owner if the run exposes product or test failure
- Evidence: `evidence/T015-A1/validation.md` 仅记录 E2E inventory：station-resource-group 16、dashboard 33、ware-selection 48，共 97 项；明确说明因未获得 dispatcher 独占浏览器资源而未执行浏览器命令。Unit 1 file/3 tests 通过只能证明领域查询与 presenter 的受控路径，不能证明四个恢复场景或另外 93 个既有消费者在当前候选上的运行结果。
- Allowed correction: 不先做推测性源码修改；由 dispatcher 提供独占浏览器/build 资源，针对当前或后续冻结候选运行 T015 契约中的精确 97-test 命令。若产生失败，再由 T015 owner 在 owned paths 内作最小修正并生成新候选证据。
- Verification: 97/97 passed，0 failed/skipped/flaky/retry；候选绑定的 report/trace 必须覆盖 3.2、3.3、3.9、3.12，以及 dashboard 33 与 ware-selection 48 的保留结果。

## Acceptance

- Accepted: T014→T015 shared-store 交接精确成立。`input.md` 在写入前确认 T014 handoff hash `ee9a9432...`；T015 patch 仅增加 sector/station/resource 查询所需 import、helper 和接口，不覆盖 T014 AutoSupply 计算。
- Accepted: Blueprint 来源使用当前 `activeEmpire` 和 `sourceView.sectors`/`orderedStationsBySector`；station resource tags 来自当前 `StationDerivedMap.getProductionFlows(station.id)` 的负净流量，而非 `savedEmpire`、静态 upstream 列表或兼容 store。
- Accepted: store 输出 sector/station/flow 领域查询；presenter 负责可加载菜单、空项过滤、分组、loaded source identity/type/label/highlight；Vue 新路径只绑定 presenter 数据与动作，没有新增直接 store UI 组装层。
- Accepted as bounded evidence only: 真实 Pinia Blueprint store + StationDerivedMap + presenter 的 Unit 3/3 通过，覆盖两个有需求 sector、一个空 sector、精确 station resource tags 及 loaded highlight 切换；E2E 源码静态覆盖 3.2、3.3、3.9、3.12，97 项均为 active inventory。
- Not accepted: 当前候选上的独占浏览器运行及 97 项回归结论。
- Candidate identity: 当前五个 T015 owned files 均与 candidate manifest 一致；owned patch 可从已验证的 T014 shared-store handoff 重建当前 T015 store 增量。

## Remaining

1. dispatcher 授予独占浏览器/build 资源并执行契约指定的 97-test 命令。
2. 保存候选绑定的完整 report/trace 与 97/97 汇总；若失败，由 T015 owner 仅修复实际失败并重新冻结候选。
3. 对具备浏览器证据的候选重新独立审查；当前 review 不授权更新 task/status。

## Explanation

静态实现、真实数据来源、presenter 边界与 T014→T015 store 交接均满足当前规范，未发现需要先行修改的 T015 产品代码问题。唯一阻断项是强制浏览器验收完全未执行；inventory 不能替代运行证据，因此 verdict 仍为 changes-required。本次审查未运行测试或 build，也未修改源码、规划、状态或 Git。
