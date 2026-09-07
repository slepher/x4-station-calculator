# BUG-001

状态：Verified（Unit + 主 agent fresh build + 独立 E2E）。

M15.1 candidate 3.5/3.7实际失败；`/tmp/x4-migration-M15.1/candidate.log`。最终多帝国完整46项为37 pass / 9 fail / 0 skip，exit1；`final.log` 中保存的新UUID进入savedEmpires.activeId，但activeView仍旧帝国，reload被旧身份覆盖。另存还保留失效的旧活动站点ID，3.2/3.6/3.10无法保存后继续直接编辑。不能以M7.1/M7.4空列表fixture通过替代。

Unit current red：`tests/unit/production/blueprint-save-active-identity.spec.ts` 8项，6 fail / 2 pass，exit1。真实store验证save/saveAs的新Pinia恢复B、A完整保留、另存第二站身份与计算缓存、其他当前视图不被切走，控制项overview与普通save均原先通过。未mock被测Blueprint/ActiveView/EmpireData store。

修复仅4行：saveEmpire成功同步持久化activeEmpireId；saveEmpireAs精确映射原选中站到新ID并重建派生Map，再调用save。未调用loadEmpire或switchToEmpire，未改前序DLC规则与debug。

同文件green 8/8 exit0；有限消费者（新增Unit、Blueprint DLC、activeView、planning-canonical-state）4文件17/17 exit0。日志 `/tmp/x4-migration-FIX-M15.1/{red,green,consumers}.log`。

恢复条件：主 agent 协调build、多帝国原失败与M15.1完整范围复验，原帝国/站点业务内容保留。apply阶段未执行build/fullUnit/E2E。

独立验证：主 agent统一fresh build exit0（`/tmp/x4-migration-FIX-M10.2-DETAILS/combined-build-final.log`）；M15.1原9失败9/9、完整46/46均exit0；M7.1必要保存/加载/刷新2/2 exit0。日志 `/tmp/x4-migration-M15.1/post-fix-{failures,full}.log` 与 `/tmp/x4-migration-FIX-M15.1/m7-consumers.log`。E2E原失败断言未改变，debug保留，未提交。
