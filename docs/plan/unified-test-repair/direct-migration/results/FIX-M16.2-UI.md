# FIX-M16.2-UI

Resolved change: fix-station-dlc-ui。T1/T2 完成，Unit 6/6、build exit 0、独立 E2E 51/51；BUG-001 Verified。

Item 将原 DLC 展示 computed 移到 useStationPlanningItemPresenter；可见标签消费翻译名称，数量禁用明确合并 countDisabled 与 inactiveByDlc。未修改父组件、计算、存档、persisted modules 或诊断日志。

命令：`npm run test:unit -- tests/unit/current/dlc-settings/station-planning-item-dlc.spec.ts`

- 首次 harness 运行 exit 1，6 failed：默认 Node 环境缺少 document；补 jsdom 标记后开始有效复现。原记录 `/tmp/x4-migration-FIX-M16.2-UI/unit-red.log` 保留，不计产品 RED。
- 有效 RED exit 1，2 failed / 4 passed：可见 DLC 非翻译名称，受限 input disabled=false。`unit-red-mounted.log`。
- GREEN exit 0，6 passed：翻译及响应更新/base 无标签/受限输入和按钮无写入且删除可用/限制解除可编辑/原 countDisabled 保留/readonly 与 transfer/noClick 保留。`unit-green.log`。

日志目录 `/tmp/x4-migration-FIX-M16.2-UI/`。Unit 使用实际 mounted Item 和 X4NumberInput，仅 mock store 翻译/激活读值与 i18n，期望为显式文字、HTML disabled 和 emit 结果。

BUG-001 保持 Confirmed，等待 fresh build 和 M16.2 独立 E2E 两项复验；第三项计算失败不在此合同内。没有运行全 Unit、E2E、build 或 git 写操作。

后续独占构建窗口：`npm run build` exit 0，Vite 9.86s，统一日志 `/tmp/x4-migration-FIX-M16.2-CALC/build.log`。随后切独立 E2E 阶段，原三项精确复验 3/3 exit 0，`/tmp/x4-migration-M16.2/post-fix/precise.log`；完整51进行中。

最终独立 E2E：完整51/51、0 skipped、exit 0（1.3m），`/tmp/x4-migration-M16.2/post-fix/full.log`；collection 51 tests/3 files、exit 0。测试文件未改。原 red 保留；UI BUG-001 Verified。
