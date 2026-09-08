# unified-test-repair · Generation 6

Revision 1 承接 direct-migration 的有效成果与剩余验收，交付为 working-tree。当前 Base 为 `d0614371558b2f6b30e8fd6b148347868228c413`；旧 manifest 的2496项全部核验一致。旧运行状态、lane和提交门不接入本代。本次只发布规划，没有执行产品测试或接受任务。

[plan.md](plan.md) 提供完整验收和逐项保留映射，[tasks.md](tasks.md) 索引25份合同，[decisions.md](decisions.md) 记录裁决点，[input-evidence.md](input-evidence.md) 记录当前事实。

T001–T009可立即进行只读调查。优先环境、规范冲突、Build前置及地图空间oracle；继承审核对应、自动工作台保护、drag根因与额外范围核对可独立安排。T010也是executable，待T001接受后按固定命令运行当前build、canonical Unit、collection和建材UI六项smoke。T011–T025为draft，按各分支事实成熟逐项开放，不等待所有调查结束。

旧handoff已被后续证据部分覆盖：M3图/草案/地图UI、M6方案/布局、M8导航/筛选、M10滑块和船体/性能、M15 sector聚合均保留最新具体通过范围。仍未满足的是M5.3两项hover、M7.2一个原skip、M7.3四项sector来源、M10.2三项布局、M15.2最终文案，以及自动工作台保护、地图完整身份持久化和M11–M14迁移。M8.3/M9.1运行通过与独立接受分开记录。

开放语义包括AutoSupply/统一基础设施、sector/savedEmpire、三项独立装备布局、No Demand/Resource；先核对权威替代条款，只有新产品选择交用户。T009另核对内部调用/live flow、列宽80/70和DLC Live/bulk是否既有必需。M14独立五项不等待3.3；3.3须找到build-material、非空modules、非空target rates的明确入口，不重复旧不可达路线。

最终T025仍须在同一候选上给出完整canonical E2E、build、canonical Unit、diff与独立review闭合证据。原71文件和新增spec均保留场景去向；历史通过、collection或smoke不是当前全量通过。

下一步由当前dispatcher采用Revision 1并派发。planner不写status、不管理会话、不提交。结构校验命令：`python3 /home/slepher/.codex/skills/codex-workflow/scripts/workflowctl.py validate docs/plan/unified-test-repair/generation-6`。
