# 设计

依据 direct-migration/results/FIX-M10.2-diagnosis.md 的调用链，不扩成整个Ship重构。

## FIT
使用已有 extractEquipmentSlotCandidatesWithFacets 的未加临时UI筛选的合法候选基线，保证全部connection兼容。唯一候选的partial点击补满、满点击显式清空；0/多候选仍开picker。group step为totalCount，connection step为1。

复用store已有capacity resolver/分配器统一preview和commit，必要提供目标赋值/计数领域动作；不写第三套比例分配。滑块0保留equipmentId，点击清空才传null。新展示/点击判断在presenter，Vue只消费所迁范围的refs/动作，其他布局不重构。

## DETAILS
现有stats已提供所缺字段；只将本次metrics/summary组装移入presenter并恢复canonical字段，保留current/candidate/diff/max语义与现有额外字段。turret无热周期的既有0如实显示，engine travel摘要用既有travelSpeed和details.travelCharge生成speed:charge；不改变共享summary数字接口或物理公式。

两个合同文件互不重叠；如出现真实共享接口依赖，交主agent明确归属/顺序。保留debug，不引入新层/fallback链。布局三项冻结。
