# FIX-M16.2：站点 DLC 标签、禁用输入与计算过滤

状态：待派发；执行 Astra medium，主 agent 负责归属和后续授权边界，不再委派。不启用 codex-workflow。

## 当前证据与验收

M16.2 保留 48 passed / 3 failed / 0 skipped，见 ../results/M16.2.md。权威 openspec/specs/station-dlc-tag/spec.md 要求：可见标签翻译名；限制开启后保留行/删除但禁数量编辑；未激活模块排除全部分析输入，政策关闭恢复，activeDlcs 和政策变化都刷新自动工业。

已复现：Terran energy 模块标签 DLC 而非人类的摇篮；inactive row 的 input enabled；UI 与 domain production 仍 3000 而非 0。不能只把一个流量数字隐藏来通过。

## 首阶段独占职责

只读诊断全部调用路径，提交 ../results/FIX-M16.2-diagnosis.md。不得修改 src/spec/测试/其他人的文件，不跑浏览器或 build，不提交。当前失败 trace 已足够，无代码变化前不重复同路线。

给出最小修复写入文件清单、各处责任、独立 Unit 红绿设计、需要的消费者验证。主 agent 据此派发 apply 合同。重点查明：

- StationPlanningItem 已有 dlcLabel；countDisabled / inactiveByDlc 的呈现归属，遵循 store → presenter → Vue，不增加新中间层，不扩成整组件重构。
- useBlueprintProductionStore / useLiveProductionStore 将 compute deps 的 DLC policy 丢在 StationDerivedStaticDeps 构造外；StationDerivedMap 的 plan/full、autoIndustry、aggregate，以及 productionStationShared 再计算 finalSupport/canonical 的实际路径。
- plannedModules 必须保留持久化/列表；resolved/effective 计算输入与成本/工人/仓储/wareFlow 的统一边界，不能删除 persisted modules。
- activeDlcs 与 enforceDlcActivation 的 watcher；Live archive 的事实态与规划态是否共享政策，若规范未决定不能自行改变历史存档事实。

## 失败保留

若最小修复需要未决业务裁决或无法稳定交接，记录明确阻碍、未满足项、已查/已试路径与恢复条件，只阻塞 M16.2 和真实消费者闭包。不得标通过、删除任务或降低断言。不是唯一编辑人，不撤回他人修改，保留 console/debug 日志。
