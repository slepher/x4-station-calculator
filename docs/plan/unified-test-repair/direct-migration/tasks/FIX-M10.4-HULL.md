# FIX-M10.4-HULL

Astra medium，主agent派发，禁止再委派。Resolved change fix-ship-build-analysis-contract，仅HULL任务/BUG-HULL。

独占src/store/logic/analyzeShipBlueprintBuild.ts、tests/unit/ship/ship-build-hull-materials.spec.ts、该change的HULL task/bug节、results/FIX-M10.4-HULL.md。其余源/test/helper/fixture只读。不是唯一编辑者，保留他人改动与debug，无提交。

读取M10.4报告、change及全部getBuildAnalysis消费者。按x4-bug-fix/apply真实独立Unit先red再green：production/hull同ware与独有ware、装备/storage各计一次、price min/mid/max、卡/汇总/total一致、hull缺失/空/零、输入不变、方法切换不丢hull且不增加时间。复用现有shipEntry，不只修单UI、不改未使用的resolveBlueprintMaterialCost或归一化接口、不加fallback链。有限消费者以rg确认现有建材/shared analysis tests，不跑全量。

无build/browser/fullUnit，交主agent统一窗口。该项完成不等待STATS通过；过难须具体失败/尝试/阻碍/恢复，未尝试不归阻塞。
