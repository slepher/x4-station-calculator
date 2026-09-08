# Generation 7：让旧 E2E 符合当前代码

Revision 1 规划已完成，尚未执行测试改写。当前代码是行为基准；generation 6 的旧产品恢复要求已替换。有效用例保留，过时用例可重写/合并，缺失的现有行为补测，已不存在的旧行为有证据地退休，不要求1:1或固定测试数量。

## 输入与主要发现

基线为 `8b5894bc85a7de3d608efa8db74357d942764519`，规划开始时工作区干净。该提交保留了drag及部分测试修复，撤回了AutoSupply、地图资源来源和装备布局等修改。当前有74份E2E文件；相比原71份，新增了auto-sector-group的graph、draft-transactions、map-details三份补充测试。历史结果只保留其原候选含义，本轮没有运行Unit/E2E/build。

本代的重要处理：

- AutoSupply：按当前统一自动设施改写旧skip，不恢复独立列表或设置入口。
- 地图资源载入：当前读取已保存帝国/逻辑组网，测试准确的来源、组内容和选择反馈，不找已消失的sector专用入口。
- 装备：当前picker采用三列、Fit为wide=false，改写“两列宽”旧断言，保留有效选择/详情行为。
- Tooltip：No Demand和80/70最小列宽仍是当前实现，保留有效覆盖，不做反向回退。
- 工作台：测当前公开模式切换，不继续为不可达自动station/transit事务补产品入口或Unit。
- 建筑规划：复用已保留目标/预览测试，去掉条件通过和空断言；steps仍有实现，需固定可达正例及无switch负例，不能因旧energycells+last前置失败而退休整个功能。

地图放置和独立drag已有成果先核对，正确且已覆盖的部分允许无diff交回当前运行证据，不重复造测试。

## 执行安排与边界

[10项任务](tasks.md)：一次当前基线、八个功能范围的测试核对/改写、一次最终完整验证。所有合同可按依赖执行；steps正例等技术细节由owner在任务内解决，没有等待用户重新选择旧产品语义的draft关卡。若出现尚未定位的其他spec失败，在本代增补精确测试合同。

实现仅写合同列出的E2E文件，`src/`、Unit、共享helper/fixture、配置和依赖只读。最终完整canonical E2E覆盖当前全部文件，单次运行并绑定最终候选；同时保留Unit、默认webServer的fresh build和diff结果。独立review核对改写后的行为与oracle。失败按实际性质交回，不能为通过测试改产品。

本轮只有新generation-7规划产物；generation-6、src、测试、status、Git metadata未修改，未提交。后续working-tree交付也不授权提交/合并，用户验证通过前不提交。

## 规划校验与未决项

- Published revision: 1
- Validation: `python3 /home/slepher/.codex/skills/codex-workflow/scripts/workflowctl.py validate /home/slepher/project/x4-station-calculator/docs/plan/unified-test-repair/generation-7`，exit 0；输出 `Structure/identity valid; acceptance still requires execution evidence.` 这是规划格式/身份校验，不是测试运行或产品接受。
- 产品方向已确认，无需再次询问是否允许重写旧用例。
- steps公开正例的具体输入、当前各文件运行结果尚待执行。无法取得公开路径时要求精确证据再决定具体覆盖去向；工具/真实产品异常如实记录，不声称全绿。

资料入口：[计划](plan.md)、[任务](tasks.md)、[决策和旧任务去向](decisions.md)、[覆盖事实](context/coverage.md)、[当前源码事实](context/current-behavior.md)。

## 新会话执行交接

控制仓库：`/home/slepher/project/x4-station-calculator`。
规划目录：`/home/slepher/project/x4-station-calculator/docs/plan/unified-test-repair/generation-7`。

执行使用role-profiles.toml中的dispatcher：**gpt-5.6-luna / high**。用`/new`开启新会话，通过`/model`选择该配置；仅切模型不等于分离规划上下文。粘贴：

```text
$codex-workflow execute /home/slepher/project/x4-station-calculator/docs/plan/unified-test-repair/generation-7
Repository: /home/slepher/project/x4-station-calculator
Published revision: 1
Read plan.md, tasks.md, decisions.md and summary.md. Reconcile current inputs and
existing results, then implement within the recorded authorized scope.
以当前代码实际行为更新旧E2E，允许重写、补写和有证据地退休过时行为，不要求1:1。
仅按本代合同修改E2E；不得修改src、恢复撤回内容或继承generation6产品修改权限。
工作树交付，不提交或合并。
```

执行入口应重新匹配实际dispatcher配置、核对当前用户输入并采用Revision 1。本轮止于规划交接，未代用户启动execute。
