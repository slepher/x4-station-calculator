# 独立缺陷

## BUG-FIT
状态：Verified（见下方本轮Unit/build/E2E证据）。原Confirmed：M10.2 selector3.2、3.3、3.9已实际失败。额外slider0保留ID问题仅静态证据，Unit须先red。恢复：准确补满/清空/step，preview/commit一致且数量0保留ID；Unit/build/对应E2E复验。

FIT apply：实际mounted Fit/store Unit RED3failed（partial不补满、step1、preview0删除装备），最终7passed（补独立shield唯一候选/0保留ID/补满/清空），有限消费者4files/54passed，logs /tmp/x4-migration-FIX-M10.2-FIT/。最终合并focused证据见DETAILS日志final.log（4files/45passed）。源码完成，build/E2E待协调，状态仍Confirmed。

## BUG-DETAILS
状态：Verified（见下方本轮Unit/build/E2E证据）。原Confirmed：M10.2 turret、engine两项失败，beam/engine现有数据足够；无需编造物理值。恢复：canonical字段与travel摘要实际可见，Unit/build/对应E2E复验。

DETAILS apply：实际mounted Equipment/真实stats Unit RED2failed/2passed（缺turret/engine字段），GREEN4passed；有限消费者2files/34passed；最终FIT7+DETAILS4+消费者34共4files/45passed。日志 /tmp/x4-migration-FIX-M10.2-DETAILS/。展示组装迁至presenter，共享stats公式及summary数字接口未改。build/E2E待协调，状态仍Confirmed。

证据：direct-migration/results/M10.2.md 与 FIX-M10.2-diagnosis.md。布局3项继续失败/待裁决，不因这两个bug通过关闭整个M10.2。

共享构建阶段：首build exit2，DETAILS函数导出未消费comparisonData使私有ComparisonItem泄漏（TS4060）；父级授权核对消费者后仅移除comparisonData/viewMode返回项，保留内部计算。第二build exit0，Vite10.71s，`/tmp/x4-migration-FIX-M10.2-DETAILS/combined-build-final.log`，首失败`combined-build.log`保留。BUG-FIT/DETAILS仍Confirmed等待独立E2E。


## Independent E2E verification after shared fresh build

Current browser evidence: /tmp/x4-migration-M10.2/fix-focused.log initially3passed/2failed; DETAILS turret+engine andFITstep passed, but two FIT setup helpers still waited for a picker after a unique-candidate click that now correctly installs directly. Parent authorized consumer setup migration: one real standard slotclick installs1/1, groupclick fills2/2, nextgroupclick clears0/2; no storewrites or weakened verdicts. Also migrated the same clear setup in selector3.4.

Complete six-spec46-case run /tmp/x4-migration-M10.2/fix-full.log **43passed/3failed/0skipped**, exit1. All five original FIT/DETAILS product failures nowpassed in thisfullrun, including independent partial/full/step and canonicalturret/enginefields+travelcharge summary. Count0realdrag/pre-releasepurity/material/stat exclusion andothercomparison cases also passed. Onlythree separatelypendinglayout requirements remainfailed; they donotcloseM10.2. fix-collection.log46exit0, fix-diff-check.logexit0. Existingfailure logs remain.

Command: PORT=22302 npm exec playwright test -- --config=/tmp/x4-test-migration-env/preview-only.config.ts tests/e2e/ship/ship-build-equipment.spec.ts tests/e2e/ship/ship-equipment-selector.spec.ts tests/e2e/ship/bugfix-ship-equipment-selector.spec.ts tests/e2e/ship/build-ship-equipment-panel.spec.ts tests/e2e/ship/bugfix-build-ship-equipment-panel.spec.ts tests/e2e/ship/osaka-default-preset.spec.ts --workers=1 --retries=0 --trace=on --output=/tmp/x4-migration-M10.2/fix-full

ScopedBUG-FIT andBUG-DETAILS requiredUnit/build/E2E verified. WholeM10.2 remainsincompletependinglayoutdecision.
