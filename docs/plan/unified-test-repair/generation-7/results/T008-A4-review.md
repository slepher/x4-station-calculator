- Task: T008
- Contract revision: 1
- Result: T008-A4.md
- Candidate snapshot: HEAD `8b5894bc85a7de3d608efa8db74357d942764519` plus generation-7 planning tree and the current four owned build/plan specs matching the source copies retained in `evidence/T008-A3/playwright-results/**/trace.zip`
- Verdict: changes-required

## Findings

1. **High — 43 条收集结果属实，但“保留 43 tests”没有完成合同要求的改写/合并/退休交代。** 基线四文件为 63 条（build-flow 27、goal 21、preview 9、compute 6），当前为 43 条（6、21、9、7）；净减少全部来自 build-flow 的 27→6。当前 6 条覆盖 clean/seeded、菜单绑定/解绑、拖放、绑定 reload 和 archive，但源与目标都是 `lf-1-g1` 的同卡 self-binding，不满足 T008 Acceptance 1 的“可区别的源/目标组”，也没有公开 restore 用例。T008-A4 未说明其余 build-flow 行为被合并到哪条当前用例、因何退休或转交哪个决策，因而不满足 Acceptance 7。Correction owner：T008 implementation owner 负责在四个 owned specs 内补齐可达覆盖和逐项去向；确需退休或替代的公开行为由 planner 决定。Allowed correction：只改四个 owned specs/result evidence，不改源码、Unit、helper、fixture 或 config；若无法构造可区别输入，保留具体入口、输入和实际结果后交 planner。Verification：重新收集四文件并检查行为映射；focused run 必须显示可区别 group/card identity、精确 assignment/edge，以及 archive/save/reload/restore 的最终去向。

2. **High — T008-A4 对 6 个失败只做了场景罗列，没有按证据准确分类，其中 steps 失败被错误描述为功能失败。** A3 traces 显示：(a) binding reload 已恢复 assignment，唯一失败是持久化对象省略空 `archivedGroupIds`，属于 test oracle correction；(b) archive 后内存为 `['lf-1-g1']`，公开 Save/reload 后变回 `[]`，属于公开持久化行为边界；(c) compute 3.4 的页面运行在 `9.0`，菜单只有“无规划”，在点击不存在的 `flow-plan-menu-item-logic-flow-1` 时超时，根本没有打开 modal 或执行 summary/steps switch，属于 fixed-input/setup correction，尚不能判定 steps 能力；(d) goal 2.5 和 3.3 都在删除后菜单仍打开时再次点击 menu trigger，随后等待刚被关闭的菜单，属于 helper/test sequencing correction；(e) goal 3.10 的公开结果明确是 `Unplanned Line` + `Energy Cell Production` + `Target`，属于当前 oracle wording correction。Correction owner：T008 implementation owner 修正 (a)、(c)、(d)、(e)；planner 处理 (b) 的产品行为去向。Allowed correction：固定 compute 的 8.0 输入并走现有公开选择路径；让 plan helper 感知删除后的菜单状态；按当前公开 unplanned 表示更新断言；不得把未触达 steps 的结果标成产品异常。Verification：同一候选重新执行完整 43 条 focused 命令，分别保留每项新状态；steps 正例必须实际到达 E1-S1 modal、默认 summary、非空 steps、切回 summary。

3. **High — archive persistence 已足以形成 needs-decision 边界，restore 不可达边界的 retained evidence 仍不足。** 当前 trace 完整证明了公开 archive click → zone 消失 → toolbar Save → reload 后 archive identity 丢失，因此该持久化行为可以交 planner；但当前 spec 在 archive 后只断言 `.build-flow-zone` 为 0，没有尝试或记录标题栏 archive 入口、archive modal、restore action，也没有在 `evidence/T008-A3` 中保留 T008 Acceptance 6 要求的已搜索入口/输入/分支与实际结果。T008-A4 也完全未说明 restore 边界。Correction owner：T008 implementation owner 先补齐 bounded reachability evidence；确认无公开路径后由 planner 决定替代/退休范围。Allowed correction：只读检查现有公开入口并在 owned spec/evidence 中复现；不得用内部 store restore 代替公开路径，也不得新增产品入口。Verification：证据须明确区分 archive persistence failure 与 restore-entry unreachability，并记录可复现的入口、固定输入、分支和实际 UI 结果。

## Acceptance

本次运行数字可信：`evidence/T008-A3/playwright-results` 恰有 43 个 trace（6 build-flow、21 goal、9 preview、7 compute），`.last-run.json` 列出 6 个失败；逐 trace 的顶层错误也正好是同 6 条，因此 37 passed / 6 failed / 0 skipped 如实。四类代表 trace 内嵌的 spec 源码分别与当前四个 owned files 完全一致，运行证据绑定到当前候选。`git diff --check` 的 exit 0 也被如实保留。

当前候选在 goal/Fleet、preview 和显式 compute 的多数路径上保留了有意义的公开 UI 与持久化断言；37 条通过不能关闭 6 条真实失败，也不能替代缺失的 build-flow 行为去向和 restore 可达性证据。工作树中虽有其他 owner 的并行 test 变更，但 T008 候选声明和 trace source 均只绑定四个 owned specs；未发现可归于 T008 的源码、Unit、helper、fixture 或 config 越权修改。

## Explanation

T008-A4 正确保留了失败命令和 37/43 结果，没有把失败伪装成通过。需要返工的是失败 disposition 和合同闭包：四个可直接修的测试问题应回到 T008 owner，compute steps 必须在固定 8.0 公开路径上真正执行后再判断，archive 保存丢失可直接交 planner，而 restore 不可达还需补齐合同规定的边界证据。完成这些修正并重新运行受影响的完整四-spec focused suite 后，再进行独立复审。
