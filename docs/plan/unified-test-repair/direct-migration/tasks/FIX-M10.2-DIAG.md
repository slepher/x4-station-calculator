# FIX-M10.2-DIAG：装备行为与属性缺失分诊

状态：待派发。Astra medium，主agent分配，不再委派。

只读源码/规范/已有效失败证据，仅写 ../results/FIX-M10.2-diagnosis.md。测试、src、基础fixture与其他结果只读；不build/browser/提交，不重复已经确认的失败路线。

输入M10.2完整报告和旧ID映射。布局三项（Fit宽度、种族行数、展开两列/行高）已向用户询问当前三列是否为新基线，未答不改产品/规范/断言。

分诊其余五个失败：

1. 单候选slot点击应补满/清空，实际总打开picker；追全部target/候选限制/装备分配caller，明确Connection与Group语义，真实兼容/DLC候选集合与操作。复用当前领域动作，UI组装归presenter，不能在Vue新写store业务分支。
2. Group数量step为总容量，actual用connectionKeys.length。检查分配算法和异构容量约束，不以只改HTMLstep掩盖store实际计数错误。
3. canonical equipment-panel要求turret与engine完整字段，以及travelSpeed:travelCharge摘要，实际字段被过滤。追真实useEquipmentStats输入/output、全部summary消费者，区分当前数据确有数值/不适用值语义；不给不存在物理量编数字，不引入fallback链。

输出可独立apply的最小文件清单、现有helper/presenter复用点、各项Unit红绿与有限消费者/E2E验证。优先分成Fit点击/数量与属性展示两个功能合同；共享源真的不能稳定分工时给明确串行顺序。未决业务语义需具体条文/实际值/恢复条件，不扩成整个Ship重构。
