# FIX-M16.2 只读诊断

状态：诊断完成，可独立派 UI 修复；Blueprint 计算可形成第二个有限合同；Live reference/fact 扩展应单列，不能因它阻塞两个 UI 缺陷。已有 M16.2 48 passed / 3 failed 是复现输入，本轮没有重复 browser、build 或 Unit，没有修改 src/test。

## 1. 三个失败的真实路径

### 可见名称与禁用数量

`BlueprintProductionWorkbenchView.vue` → `useProductionPlanningPresenter` 的 plannedModules/enforceDlcActivation → `StationPlanningPanel.vue` → `StationPlanningItem.vue`。

- Item:64–66 已算 shouldShowDlcTag/dlcLabel/isDlcActive；97–98 模板把 `dlcLabel` 仅放 title，可见文字写死 `DLC`。主因是渲染消费错误，不是翻译数据错误。
- Panel:335–340 给计划行传入准确 `inactiveByDlc = enforce && !isModuleDlcActive(id)`；isModuleCountEditable:207–211 只排除 habitation，因此传给 Item 的 countDisabled 没合并 DLC 条件。
- Item:108–109 把 countDisabled 传给 X4NumberInput；delete 是独立按钮。可在 Item presenter 合并“调用方禁用”与“明确 inactiveByDlc”两项状态，不必动删除或重写整个 Panel。
- Item 其他消费者：Panel 推荐/auto/存档只读行、ArchiveModuleList、transit-hub/TransitHubBuildPanel。它们未传 inactiveByDlc 的 readonly 行应保持事实显示；标签翻译修复自然共享，数量禁用只作用调用方明确限制的计划行。
- 数量操作的另一个现存旁路：Panel.applyScale、handleUpdateModuleCount、transfer 最后都 emit updatePlannedModules；`store/actions/productionModuleActions.ts:updatePlannedModules` 无 count-policy 检查。单独 updateModuleCount 虽接收 store.isModuleCountEditable，实际 Panel 走的是批量更新入口。禁止数量编辑若要覆盖 scale/transfer，需要另加明确任务，不能把 disabled input 当成所有写入口已封闭；这不阻塞本轮两个已复现 UI 小修。

### 计算为什么仍是 3000

1. Blueprint `getComputeDeps`（141–148）已有 enforceDlcActivation 和 isModuleDlcActive；`getDerivedStaticDeps`（152–160）重建对象时仅保留 modulesMap/waresMap/workforceConsumptionMap。Live 的1326–1345有同样丢失。
2. StationDerivedMap.StaticDeps（24–28）根本无 policy；computePlanResult（538起）把原 inputModules/reference floor 交给自动工业，随后 habitation/core；没有任何 DLC 过滤。auto producer、habitat、storage/pier 选择都依赖传入 modulesMap，必须同时限制候选集合，不能只在最终 flows 上过滤数字。
3. Blueprint.activeStationState（248）继续调用 `productionStationShared.buildDerivedActiveStationState`。该函数按原 plannedModules 重新构成 effectivePlannedModules，再调用 deriveFinalSupportState（108起）重新计算 habitation/core/infrastructure。因此只改 StationDerivedMap/cache 后，UI仍可被这条二次计算恢复为3000。
4. resolvedModules 当前直接拼接 effective planned + auto industry/habitat/infrastructure（shared:211起）。Blueprint.stationState 把它同时赋给 resolvedModules 和 modules（947–948）。Dashboard presenter 的 displayModules/workerModules 最终进入 StationDashboard.vue:79/89 的 analyzeStation；成本、材料体积、建造时间、工人容量/需求都由这些模块输入计算。仅过滤 productionFlows 不会修成本/工人/仓储。
5. 计算基础函数 `calculateProductionFlows.ts`、`calculateInfrastructureModules.ts`、`analyzeStation.ts` 不识别 DLC policy，都是普通纯模块分析器。应在 planning 输入边界统一选出可计算模块与可选模块库，再让现有算法复用，避免给每个算法单独添加相同过滤。

## 2. watcher / cache 生命周期

- Blueprint:331 与 Live:1797 都只 watch enforceDlcActivation，没有 watch activeDlcs。用户仅增减 DLC（策略保持true）时，已缓存自动工业与帝国/星区聚合不会获得完整刷新。
- Blueprint watcher 当前只向既有 Map upsert；Map.staticDeps 在构造时保存。将 policy boolean 或过滤后的 modulesMap 接进去后，仍必须在 DLC 设置改变时重建 Map/更新依赖，不能用旧 deps 重算。
- Live policy watcher 已 resetPlanningDerivedMap + 全站 seed，但同样缺 activeDlcs；它没有刷新 liveFlowMap，表明现结构已区分规划和存档事实。
- 需对 activeDlcs 的内容变化（不仅数组引用）与 enforce 的变化使用一个响应式刷新来源，整批同步计划 station，再更新聚合。原 plannedModules/persistence 不得过滤或回写。

## 3. plan / full / archive 边界

`useLiveProductionStore.createDerivedMap`（573）目前同时服务 planningDerivedMap 与 liveFlowMap。

- `syncLiveFlowMapForStation`（618–672）由 archive.stationEntry.modules/workforces 构建 `modulesMode:'full'`，保留 archiveSemanticsSource。Live mode activeStationState:1530返回 archiveModules、building模块与存档 workforce/flow；这是事实态。
- planning 的 buildPlanningSeed:1368由用户 station plan + archive built/building referenceModules 产生 `modulesMode:'plan'`。
- shared.buildCanonicalPlanningStationState:281 会把 plan effective+auto 与 `getReferenceProductionFloorModules(archive built+building)` 做 max，再重算 habitation/core/infrastructure。这是第二个必须处理的重新引入点。
- canonicalBase 同时成为 finalPlannedModules、effectiveTargetModules 和 resolvedModules；Dashboard 在 planning+archive 时 built scope 来自原 archiveBuiltModules，all/worker scope 来自 effectiveTargetModules。两者兼任目标表达与计算输入，不宜简单删掉 inactive reference floor。

**裁决边界**：station-dlc-tag 明确约束“空间站规划界面/计算”，没有要求改写 live/full 存档事实。建议 full/live 保持原始事实；规划计算过滤应与持久计划/存档事实/参考下限分开。关于 inactive archive reference 是否仍形成建设目标下限，以及 planning built scope 是否展示事实成本或政策后成本，本次三失败没有覆盖，已读规范没有足够条文裁决。不能在通用Map里全局过滤full，也不能过滤archive源数组。若主agent接受“仅规划有效分析受限、目标与事实保留”，可另派Live合同设计明确字段的职责；不要扩大当前Blueprint修复来隐式决定它。

## 4. 建议独立 apply 合同与精确文件

### UI 合同：可立即执行，两项已确认缺陷

写入：

1. `src/components/empire/StationPlanningItem.vue`：可见标签消费本地化名称；DLC相关组装迁往 presenter；input 消费 presenter 的最终 disabled。其他计算/日志/模板不重构。
2. `src/components/empire/presenters/useStationPlanningItemPresenter.ts`（新）：仅持有已有 DLC 标签三个 computed 与计数限制组合，直接调用中央 gameData store；没有新中间层。
3. `tests/unit/production/station-planning-item-dlc.spec.ts`（新）：实际 mounted Item 上先 red 后 green。

Unit 独立 oracle：非base dlc传入固定 gameData 翻译“人类的摇篮”，可见标签必须是它而非DLC；base无标签；inactiveByDlc=true 且countDisabled=false时真实输入disabled、删除仍emit remove；策略关闭/active或未传inactive时输入恢复；原countDisabled=true（habitation）仍禁用；readonly archive无可编辑input。少量参数化对照即可。

后续浏览器：M16.2 两个label/count原失败精确复验，保留base/delete/recovery对照；不需等第三项计算修完才交接。

### Blueprint 计算合同：可有限执行，不触碰 Live policy 含义

建议明确先修 Blueprint，写入：

1. `src/store/useBlueprintProductionStore.ts`：planning依赖传递；DLC active内容+enforce变化后reset/重建全站Map，聚合同步。
2. `src/store/state/StationDerivedMap.ts`：plan计算入口支持规划DLC依赖；过滤实际输入与自动模块候选库，cache和aggregate均来自同一结果；full模式不受影响。
3. `src/store/logic/productionStationShared.ts`：`buildDerivedActiveStationState`/finalSupport 使用同一有效计算模块集合，resolvedModules排除禁用项，但返回plannedModules保持原样；修正被本次过滤触达的 finalSupport=0 数值不能被旧cache `||` 重新替代问题。不要改 canonical archive目标语义。
4. `src/store/logic/productionDlcPolicy.ts`（如需共用纯域helper）：只有“从现有DLC policy得到可用模块库/模块列表”的可复用过滤，不做UI组装、不引入额外层。现代码无等价模块过滤helper；可放在既有合适domain文件以减少新文件，派发时固定一个位置。
5. `tests/unit/production/station-dlc-calculation.spec.ts`（新）：下述完整输入/输出契约。

可以通过扩展 StationDerivedStaticDeps 承载已有 StationComputeDeps policy，或传入已限定modulesMap；两者只选一个，避免并行两套政策。关键不是加两个字段本身，而是缓存输入、自动候选、二次计算与分析resolved列表共同一致。

Unit 红绿设计：

- 简小合成模块：一个inactive DLC生产者（固定产出/消耗/工人需求/建设材料）+ inactive DLC仓库/居住 + base对照；开启限制时planned原列表完全保留，effective/resolved/flows/actualWorkforce不含inactive；将resolved交真实analyzeStation验证成本/体积/工人固定期望为base贡献，不能仅验输入长度。
- 真实 StationDerivedMap 两站点，检查station flow和empire/sector聚合是同一过滤结果；policy关闭恢复相同固定贡献，不使用被测算法生成expected。
- activeDlcs变化而enforce保持true：真实Blueprint store与其实际watcher驱动下一tick，自动工业与聚合刷新；再次激活恢复，计划持久化内容保持不变。不能只手工map.refresh来冒充watcher证据。
- 生产需求需要自动上游时，inactive producer候选不被选用；可用base替代时选base；habitat/storage/pier候选同样来自限定模块库。只从最终结果移掉inactive不够。
- full模式对照保持原facts。Blueprint不带reference路径先闭环；带archive/reference路径为下一合同，不宣称本合同覆盖。

有限消费者：现有 `tests/unit/production/phase-boundary.spec.ts`、`station-derived-map-autofill-dedup.spec.ts`、`production-dashboard-presenter.spec.ts`；focusedUnit通过+新build后，M16.2第三个生产归零/关闭恢复case以及原51整体。必要保留现有生产module-management/dashboard有限E2E对照，避免无依据全仓库扩大。

### Live 规划扩展合同：独立后续

只有业务边界确认后再授权：`src/store/useLiveProductionStore.ts`（planning/full deps分开，activeDlcs+policy刷新planning）、`productionStationShared.ts` canonical计算与reference目标分离、必要 `useProductionDashboardPresenter.ts` 的planning scope输入、`tests/unit/production/planning-canonical-state.spec.ts` 与对应新增DLC回归。不应修改ArchiveDB、archive records、full事实或持久化原modules。该合同可能与Blueprint共享shared文件，必须串行或明确不重叠区块，不能抢写。

## 5. 当前交接结论

两项UI修复没有业务裁决阻碍。Blueprint计算第三项有明确最小边界，但要覆盖缓存+自动选择+finalSupport+resolved分析列表，不能只隐藏3000。Live事实和archive参考下限的决定只阻塞Live扩展闭包，不应阻止UI或无archive Blueprint迁移。未标任何失败通过，原M16.2失败证据与logs保留。
