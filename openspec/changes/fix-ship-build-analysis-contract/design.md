# 两个独立修复

HULL在analyzeShipBlueprintBuild现有ship条目的材料输入中累加显式hull材料与选中production成本，复用现有价格/汇总流程，避免只补summary而各卡/total不一致。不额外计入建造时间，不新增UI卡类型/适配层。没有hull时保持原行为，不修改输入，重名ware相加一次。

STATS依据现行接受request/design：炮塔平均totalDamage/turretCount，无额外方向除数；回充率boost.recharge/100，单位%/s。共享useEquipmentStats的装备详情数值接口不改。保持当前一位小数格式：原始301.105的显示可断言301.1，不能接受50.2。修正既有公式不得新增Vue-store业务路径；若需迁出本次组装，只限相关cohesive函数至同层presenter，不整板重构或引入中间层。
