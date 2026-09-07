# FIX-M15.1

状态：待派发，Astra medium，主agent分配，不再委派。Resolved change: fix-blueprint-save-active-identity。

独占：src/store/useBlueprintProductionStore.ts；tests/unit/production/blueprint-save-active-identity.spec.ts；该change tasks.md/bugs.md；../results/FIX-M15.1.md。其他src/E2E/helper/fixture只读，保留前序DLC修改及debug，不撤回别人修改，不提交。

当前多帝国E2E已red，按x4-bug-fix/apply分阶段。追save/saveAs/create/load/delete/initialize身份源，最小一致事务，不粗暴load/switchView。Unit实际store先复现再修：A已存且activeView=A→新B保存→新Pinia/storage恢复B；原A内容保留，另存新ID正确，保存时其他view不被切走。检查两站选第二站另存的ID映射和计算缓存；只有同事务确实失败才修，勿制造新兜底。

focused/必要有限消费者通过后交主agent调度build；apply不自行browser/fullUnit/build。困难需具体尝试/阻碍/未满足/恢复条件，不能用空列表重写fixture降低验收。
