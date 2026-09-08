# Direct migration · Generation 1

这是当前generation的人读入口。它承接旧direct-migration尚未完成的行为验收，保留已证实的迁移成果，并把下一轮工作分成可以立即开展的只读调查与仍需事实、授权的后续草案。

本次补齐Revision 1的任务索引、25份合同和决策记录；[plan.md](plan.md)及两份已有输入证据保持原样。这里的executable表示具备派发合同，不表示已派发或完成。本轮没有产品/测试修改，没有运行Unit、E2E或build，也没有新增任务结果、独立review或接受记录。

## 从哪里读

- [plan.md](plan.md)：目标、完整验收、历史成果逐项继承与Planning horizon。
- [tasks.md](tasks.md)：T001–T025完整索引；点入每份合同可读精确边界、输入、资源、验证与返回条件。
- [decisions.md](decisions.md)：D02环境、D07a/b/c三项独立布局争议，以及其他调查事实边界、开放条件和Returns to。
- [input-manifest.sha256](evidence/input-manifest.sha256)与[input-status.txt](evidence/input-status.txt)：Base之外的dirty/untracked内容身份与原用户变动；它们不授权覆盖或reset。

## 当前可以做什么

独立dispatcher会话采用这份coherent Revision 1后，可以并行派发T001–T009只读调查：核实runner前提；核对已审核成果和M8.3/M9.1独立审查缺口；寻找自动站点变化的真实入口；定位独立drag demo的两项hover失败；逐项核对规范冲突；明确建筑流/目标/预览/计算前置；建立地图空间身份oracle；核对报告额外限制是否既有必需验收。

这些合同不启动browser/build、不改产品或测试，结果由各自唯一执行者写入新的本代attempt路径，独立review由另一会话完成。环境问题不阻塞源码/规范调查；M5.3独立demo不阻塞正式LogicFlow；M14.1五项独立验收不等待3.3的steps入口裁决。

## 还未完成什么

T010–T025全部仍为draft，不能直接执行。先通过T001事实修订T010完成真实构建/runner验证，再逐项落实自动工作台保护、drag demo修复与十项pointer验收、AutoSupply、sector来源、地图完整身份保存/reload、三项装备布局，以及建筑流/目标/预览/计算和tooltip剩余验收。T024等待原合同范围核对，当前没有产品/测试Owned paths；不能猜测额外DLC政策或悄悄丢弃原必需条款。

争议依然包括独立AutoSupply与统一基础设施、sector与savedEmpire来源、Fit占2/3、tags>3两行、三行两列与指定列宽/行高、最终No Demand与Resource。它们各自需要明确权威来源和独立审查；涉及新产品选择时由用户决定。源码与历史勾选不是规范撤销依据。

继承成果按[Acceptance mapping](plan.md#acceptance-mapping)保留。latest单次运行、历史组合、collection和审核记录分别记载；旧日志缺失不会自动否认明确历史通过，也不会产生本次pass。特别是M9.1已有placed class/marker仍未证明station/sector/position完整持久化；M5.3历史最新8/10、M7.2的Case5原skip、M7.3四项sector失败与M10.2三布局仍不能关闭。

最终T025还需冻结同一工作树候选，给出完整canonical E2E、build、canonical Unit、diff和独立review闭合证据。原71个canonical文件及新增spec场景都要有去向；全量保持原collection和并行配置，不用filtered run或逐功能串行拼接替代。工具不可用可以标unavailable，但没有当前全绿证据就不能宣称全功能通过。

## 下一步与校验

下一步交独立dispatcher采用Revision 1并分配T001–T009；收到事实和独立审查后，带实际attempt结果、候选身份、受影响任务及Returns to请planner做最小修订。所需事实、写入授权、验收和资源绑定齐全后才提升相关draft。无需提交或回到router；planner不接受自己的计划、不管理执行状态。

本轮角色核验已匹配planner（gpt-6-astra / high）；不据此替dispatcher启动执行。机械校验只判断结构，不能代表任务或产品验收通过：

~~~bash
python3 /home/slepher/.codex/skills/codex-workflow/scripts/workflowctl.py validate docs/plan/unified-test-repair/direct-migration/generation-1
~~~

