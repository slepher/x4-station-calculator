# FIX-M15.1 — Unit/build/E2E verified, submitted for review

Resolved change: fix-blueprint-save-active-identity；BUG-001。Astra medium，主agent独立合同。已读 x4-bug-fix → x4-apply/openspec-apply；schema spec-driven，T1完成，T2由主agent协调。未委派、未git写、未build/fullUnit/browser；前序DLC源改动与debug完整保留。

## 修改

`useBlueprintProductionStore.ts` 相对派发时副本仅新增4行（before.ts 可逐字对比）：
1. saveEmpire完成保存身份赋值时，通过现有setter同步activeViewStore.activeEmpireId持久化；不改变当前模块/工作台。
2. saveEmpireAs在生成新UUID前记录活动站在原有有序站列表中的index，UUID重建后映射到对应副本站；无活动站则保持null；重建当前派生Map供新站点ID使用，然后普通save。

不调用loadEmpire/switchToEmpire，不修改加载/删除/未保存草稿的策略，不增加fallback链。调用链审查详见 M15.1.md；load本身正确同步身份，create保留未保存草稿，delete有其他记录走load，initialize优先activeView身份使缺失save同步成为实际恢复错误。

## Unit 与证据

`tests/unit/production/blueprint-save-active-identity.spec.ts` 使用真实Blueprint/ActiveView/EmpireData stores，只隔离游戏数据源为明确Energy产量3000的小数据集。8项：save/saveAs多帝国重新Pinia恢复B及A保留2项；两站选第二站另存映射1项；新ID缓存与3000/6000/9000独立产量1项；其他当前视图保持2项；overview无选站1项；原ID普通保存保持缓存1项。

- RED：6 failed / 2 passed，1 file，exit1，973ms，`/tmp/x4-migration-FIX-M15.1/red.log`。身份、站点映射、旧缓存三类均实际失败。
- GREEN：8/8，1 file，exit0，1.05s，`green.log`。
- 有限消费者：4 files / 17 tests passed，exit0，1.02s，`consumers.log`。包含前序Blueprint DLC 4项，未被根修回归。
- owned diff-check exit0。`source.diff` 是相对本任务开始副本的精确改动；`final.sha256` 记录候选。

```bash
npm run test:unit -- tests/unit/production/blueprint-save-active-identity.spec.ts
npm run test:unit -- tests/unit/production/blueprint-save-active-identity.spec.ts tests/unit/production/blueprint-dlc-calculation.spec.ts tests/unit/current/active-view/activeViewStore.spec.ts tests/unit/production/planning-canonical-state.spec.ts
git diff --check -- src/store/useBlueprintProductionStore.ts tests/unit/production/blueprint-save-active-identity.spec.ts
```

## Apply 阶段交接（历史，后续验证见下节）

主agent调度fresh build（技能默认apply build要求由明确合同中的集中构建安排覆盖）；独立browser阶段复验M15.1既有9失败与完整46，必要M7.1保存/加载/另存消费者。当时尚无修复后E2E证据，Unit green未称为最终Verified；原M15.1失败记录保留。

## 独立浏览器验证阶段（apply之后）

主 agent统一fresh build exit0：`/tmp/x4-migration-FIX-M10.2-DETAILS/combined-build-final.log`。

- M15.1原9失败9/9 exit0 26.5s：`/tmp/x4-migration-M15.1/post-fix-failures.log`。
- M15.1完整46/46，0skip，exit0 2.0m：`/tmp/x4-migration-M15.1/post-fix-full.log`。E2E spec未因产品修复修改。
- M7.1必要保存/加载/刷新消费者2/2 exit0 5.3s：`/tmp/x4-migration-FIX-M15.1/m7-consumers.log`，PORT22271。仅选择 `load modal opens and shows saved empires|保存的帝国数据在刷新后保留`；未跑无关拖放。

T2完成，BUG-001 Verified；原red与apply阶段结果保留。本报告与M15.1结果已更新，交主agent最终审核；未git写。
