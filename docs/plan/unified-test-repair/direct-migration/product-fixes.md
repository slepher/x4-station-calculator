# 独立产品修复记录

各项继续由主agent派发，未修复项不是已通过，也不因列入队列便认定过难。测试原失败保留，真实依赖外的迁移继续。

| 项目 | 当前证据 | 状态/下一步 |
|---|---|---|
| FIX-M5.2 compact同物料不同module名称 | Unit6/6、build、原失败1/1、原49/49 | 已审核通过，原red保留 |
| FIX-M16.2-UI标签/数量输入 | Unit6/6、统一build、原失败3/3和完整51/51通过 | 已审核通过；不宣称批量scale入口全覆盖 |
| FIX-M16.2-CALC Blueprint统一DLC计算输入 | Unit4/4、消费者9/9、统一build、原失败3/3和完整51/51通过 | 已审核通过；Live archive/reference范围明确未决 |
| FIX-M10.1 selector筛选生命周期 | Unit5/5、统一build、消费者可见性迁移后35/35 | 已审核通过；此前34/35失败日志保留 |
| Core非玩家hub默认virtual | 当前共享入口已修4行；focused Unit3/3、消费者3/3、build；E2E原失败1/1及当前15/15 | 该缺陷审核通过；其余core补充验收保留 |
| FIX-M3.2透明清空及覆盖层2/3 | M3.2两项严格复现；显式规范无替代 | 独立合同已派发Live，在M4.3后apply；原失败保留 |
| FIX-M10.2-FIT唯一候选/数量 | 真实mounted Unit7/7含standalone shield，消费者54/54 | 审核通过：统一build/Unit969，原behavior在完整43/3中全通过；3布局未决 |
| FIX-M10.2-DETAILS标准装备字段 | Unit4/4，有限消费者34/34 | 审核通过：统一build/Unit969，原details在完整43/3中通过；三项布局不在修复内 |
| FIX-M15.1保存及另存活动身份 | Unit red6fail2pass → green8/8，消费者17/17；源增4行 | 审核通过：统一build，原失败9/9、完整46/46、M7.1消费者2/2 |
| FIX-M10.3 items原生滑块与clamp值不一致 | mounted red6fail2pass → green8/8，FIT7/7 | apply就绪，等待统一build/原真实拖动；透明input不宣称可见thumb错误 |
| FIX-M10.4-HULL合法船体材料遗漏 | M10.4实际2197，独立expected2297；schema及normalize均保留hull | 独立apply合同已派发Ship，未修复 |
| FIX-M10.4-STATS平均DPS及回充率 | 两船36.7/50.2与100s偏离现行规范 | 独立apply合同已派发Ship，其他34指标通过；保留1位格式 |

Tooltip Resource/No Demand、独立AutoSupply、资源loader星区/帝国属于尚未解决的规范冲突，分别保留M15.2、M7.2、M7.3未完成；不在本表暗中裁决。

最新合并Unit：168 files / 950 tests pass，exit0，`/tmp/x4-migration-FIX-M3.1/combined-unit-final.log`。此前945pass/2fail是旧game-version mock缺activeDlcs，已补当前mock并focused4/4；历史失败保留，没有产品fallback。

更新：FIT/DETAILS/保存identity合并build通过；canonical Unit **171 files / 969 tests pass**，exit0，`/tmp/x4-migration-FIX-M10.2-DETAILS/combined-unit.log`。该次不包含之后slider源修。首build因未消费的presenter返回内部private类型TS4060失败，收敛返回接口后build exit0，首失败log保留。
