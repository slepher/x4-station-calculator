# Generation 6 · T017-A2-review F2 定向 amendment

- Role: planner
- Input plan revision: 5
- Published plan revision: 6
- Affected contract: T017 Revision 4 → 6（与新 plan revision 对齐）
- Status: amendment_published
- Returns to: dispatcher → T017 → 独立 reviewer → dispatcher → T025
- Runtime adoption/acceptance: 由 dispatcher 记录，本说明不代行

## 最小裁决

[T017-A2-review](T017-A2-review.md) verdict `changes-required` 所述 F2 是现有产品清理需要同步的遗漏 Unit 消费者。T017 原八个 Owned paths 已含 `ShipBuildPanelEquipment.vue` 与 `useShipBuildEquipmentPresenter.ts`，但不含 canonical-details Unit；源码已 owned 不授权跨文件改测试。本次唯一新增写权限：

`tests/unit/ship/ship-equipment-canonical-details.spec.ts`

现有代码核对：Equipment 第 18–22 行解构 `getEquipmentSummary1/2` 后以两条 `void` 假使用；Unit 第 23–25 行传旧 props，第 54/75/76 行从组件 setup state 读取 summary。Fit 第 777/1205–1212 行是实际 summary 消费者，使用现有 `useShipBuildEquipmentPresenter.ts`；同一文件还定义 `useShipBuildPickerPresenter`。不需要增加 presenter 文件或扩大产品 ownership。

## 换发后的修正与验收

1. T017 implementation owner 从 Equipment 解构及两条 `void` 语句移除两个死 summary 绑定，保留 presenter 函数和 Fit active picker 消费。Unit 删除旧 `panelMode/isPickerOpen/slotType/isShield` props，将 engine/thruster summary 断言指向 active picker 使用的现有 presenter，不再依赖 Equipment 组件 setup state 暴露 summary。
2. 保留四项原 Unit 场景及 canonical details 断言：turret 全字段和零 thermal；engine thrust/travel/charge 与 summary `5045:8`；shield current-only、candidate comparison、maxima、empty；thruster canonical fields 与两个非空 summary。不得删除、skip、弱化断言、改共享 physics，或为测试加产品 wrapper/adapter/兼容 props。
3. 静态搜索和实际消费者核对须覆盖 Equipment 旧 picker/props/死 summary 绑定、Unit 旧 summary 入口，以及 Fit active picker 和唯一 candidate/facet owner。focused Unit 命令为 `npm run test:unit -- tests/unit/ship/ship-equipment-canonical-details.spec.ts`，须保留原四项并全部通过；执行新合同列出的九个 Owned paths 的 `git diff --check`。
4. F3 的独占六-spec fresh-build 要求完整保留：完成 F2 后冻结修正候选，由 dispatcher 在整个默认 fresh build → preview → 测试周期独占 `shared-dist-build`、`chromium-runtime`、`preview-port-23117`，使用 [T017 Validation](../tasks/T017.md) 的原六-spec 命令、`--project=chromium --workers=1 --retries=0 --trace=on`。要求 exit 0、布局 3/3、其余 43/43、总计 46/46、0 failed/skipped/flaky；viewport、root font、全部几何子约束仍需断言通过。不得复用旧 dist 或 pre-final 46/46。独占窗口仍 404 则保留 trace/网络请求，交 dispatcher 路由 runner/asset-serving owner，T017 仍未关闭；不能为 404 改产品、测试或 oracle。

共享 config/helper/fixture（含 `tests/unit/ship/ship-test-fixture.ts`）以及 T017 Owned 之外源码保持只读。原八路径、任务角色 `sup_coding_worker`、Depends on、Resources、独立 review 和 Returns to T025 不变。本次没有新增任务或反向依赖；T014 Revision 5、T010 Revision 3、T025 Revision 4 和其他合同不变。

## 出版与采用

- [plan.md](../plan.md) 发布 Revision 6；[T017](../tasks/T017.md) 发布 Revision 6，新增上述单一路径、F2/F3 Acceptance、输入证据和必要 Validation。
- [tasks.md](../tasks.md) 同步 T017 revision；[decisions.md](../decisions.md) 新增 D16；[summary.md](../summary.md) 更新当前评估并保留历史说明。
- 修改前五份规划原文已先保存至 [revisions/revision-5/](../revisions/revision-5/)，其中 T017 为原 Revision 4。本文件新建，不覆盖既有 results/evidence。
- dispatcher 在 T017 交接点暂停受影响旧合同写入，显式换发 Revision 6 与本说明后恢复修正；其他任务继续原合同。为修复/验证和独立 review 分配下一空闲 attempt/result/evidence 路径，合同中的 A1 输出模板必须替换，不能覆盖 A1/A2。新候选绑定真实命令、cwd、exit、计数及日志/trace；planner 不预占 attempt 或更新 runtime status。
- T017 完成修正与必要验证 → 独立 reviewer 核对 F2/F3 → dispatcher 记录接受 → T025 原完整 canonical E2E/build/Unit/diff。若需要 T017 外路径，返回精确证据做局部 amendment；不由执行者自行扩权。

## 保留结果与限制

F1 的 viewport/几何闭合、旧 Equipment picker 主体清理及 FIT/DETAILS 已有成果保留。A2 最终 exit 1、44/46（布局 3/3、其余 41/43）是真实未全绿结果；旧 Unit 4/4 和 pre-final 46/46 各自只证明原候选。评审对 404 的环境/产物服务分类保留，不声称已找到具体外部改写者，也不将失败重标 pass。F2/F3 仍待新候选修正、验证和独立复审。

无新产品选择；其他既有未决项保持。本轮仅核对角色、合同、评审及相关消费者，出版并静态校验规划一致性；未修改源码、测试、配置、status、旧结果或 Git metadata，未运行 Unit/E2E/build，未派生 agent 或记录接受。implementation-simplicity 仅用于产品侧死绑定与实际消费者归属边界，不用于测试实现或审查。
