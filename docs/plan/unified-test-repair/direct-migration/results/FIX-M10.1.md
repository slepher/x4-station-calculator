# FIX-M10.1

Resolved change: fix-ship-selector-filter-lifetime。T1/T2 完成，Unit5/5、build exit0、独立 E2E35/35；BUG-001 Verified。

生命周期检查：View 是 Selector 唯一挂载点。原 v-if 每次离开卸载，selectedShipId immediate watcher 再挂载回填，造成同级筛选丢失。仅改 v-show 会丢掉跨级取消回填，并残留取消的 pending；已向主 agent 申请并取得精确扩域。

修复：View 使用 v-show 保留 Selector，Workspace 仍按原条件挂载。新增同层 presenter 负责本次 pending/class/race/type、selectedShip 回填和确认/取消动作。取消清 pending，仅跨级按当前船回填；同级不回填。真实 selectedShipId 变化仍初始化筛选。候选/设备统计/布局保留原逻辑，无新增持久化、store路径或中间层。

隐藏检查：Selector 的 watcher 仅同步本地候选、分页、筛选、pending；PanelShip 无 watcher、onMounted、全局事件或布局测量。隐藏后外部蓝图载入的 selectedShipId watcher 继续回填是所需行为；挂载保留不执行确认或写蓝图。

命令：`npm run test:unit -- tests/unit/ship-build/ship-selector-filter-lifetime.spec.ts`

- RED exit 1，1 failed / 3 passed；同级取消再开 Argon 为 idle。
- GREEN exit 0，4 passed；同级保留且 blueprint 不变、跨级回填、取消 pending 不在下次确认误提交、不同船确认与隐藏时载入另一船回填。
- 日志：`/tmp/x4-migration-FIX-M10.1/unit-red.log`、`unit-green.log`。

测试 mount 实际 View 与 Selector，使用真实候选过滤器；mock Pinia 最小领域状态/动作与无关 Workspace/状态展示，不通过模板字符串检查实现。业务预期为明确 chip 状态和 selectedShip/blueprint 结果。

BUG-001 仍 Confirmed，待 fresh build 后原 E2E 失败与完整 35 项复验。未改 E2E、通用 store、diagnostic logs，无 git 写操作。

追加审查修正：同船 blueprint 加载不会触发 selectedShipId。已沿真实 loadBlueprint 所有成功分支确认会替换 blueprint 对象；presenter 使用 Pinia $onAction，仅成功 loadBlueprint 的 after 回填，前后对象未替换则跳过（无效 ID）。普通装备编辑、save/delete 不监听，不使用 deepwatch。订阅随组件作用域释放。

新增行为 Unit 对同船另一份加载、同份重新加载、普通装备编辑与无效加载不重置、unmount 后 action 不再改变 refs。补测 RED exit 1，1 failed / 4 passed，`unit-same-ship-red.log`；最终 GREEN exit 0，5 passed，`unit-green.log`。仍使用真实 mounted Selector/Pinia action hook，加载动作 mock 按源码的替换/提前 return 契约，不替代后续真实 E2E。

后续独占构建窗口：`npm run build` exit 0，Vite 9.86s，统一日志 `/tmp/x4-migration-FIX-M16.2-CALC/build.log`。随后切独立 E2E 阶段，同级取消原失败精确复验 1/1 exit 0，`/tmp/x4-migration-M10.1/post-fix/precise.log`；完整35进行中。

最终独立 E2E：初次 full34passed/1failed，唯一错误是bugfix-panel4.1旧DOMcount0，workspace已visible。主agent另行授权消费者迁移该一行到toBeHidden，保留workspace/shipId/blueprint断言；单项1/1 exit0，最终完整35/35、0 skipped、exit0（45.0s）。日志 `/tmp/x4-migration-M10.1/post-fix/{full,consumer-precise,final}.log`，trace保留。collection35 tests/5files、exit0。未为测试变更重build，BUG-001 Verified。
