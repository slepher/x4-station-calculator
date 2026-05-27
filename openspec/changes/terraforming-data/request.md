# terraforming-data Request

## 目标

从 `x4raw_assets/<version>/` 下的 `libraries/terraforming/final.xml` 和 `md/terraforming/final.xml` 解析 X4 改造（terraforming）系统的数据定义与星球任务配置，生成 `terraforming.json` 供前端消费。

## 已确认方案

### 数据来源

- **项目定义与属性**: `libraries/terraforming/final.xml`
  - `<stats>`: 改造属性（temperature, airpressure, oxygen 等）的区间、颜色、宜居性
  - `<projectgroups>`: 项目分组（power, industry, water 等）
  - `<projects>`: 项目定义（id, group, resources, effects, conditions, deliveries, rebates 等）

- **星球配置与依赖链**: `md/terraforming/final.xml`
  - 每个星球（cluster）的初始 stats
  - `add_terraforming_project` 调用中携带的 `predecessors` 依赖关系
  - 特殊项目（如 ScalePlateGreen 的 `ame_zoo`）

### 输出结构

`terraforming.json` 包含四部分：

```json
{
  "stats": [],
  "projectGroups": [],
  "projects": [],
  "clusters": []
}
```

### 关键字段

- **projects[].predecessors**: `[{ref: string, type: "project"|"group", any: boolean}]`，从 MD 的 `<predecessors>` 提取，内嵌在 project 定义中
- **projects**: 所有文本引用使用 `nameId` / `descriptionId` 保持原样（如 `{20227,1010}`），收集后走现有 i18n 管线统一翻译
- **clusters**: 每个 cluster 记录 `id`, `macro`, `partName`, `initialStats`, `projectIds`
- **stats[].ranges**: 保留并补全 `start`, `end`, `state`, `habitable`, `rgb`, `descriptionId`，明确 value 到 state 的映射
- **effects/conditions**: 保留 `stat`, `change`, `min`, `max`, `value`, `minvalue`, `maxvalue` 等字段，并显式区分 `condition.min/max` 是 state 语义、`condition.minvalue/maxvalue` 是 value 语义

### 集成方式

- 逻辑模块位于 `scripts/x4-game/terraforming/`
- `scripts/x4_data_processor.py` 的 `run_for_config()` 中调用处理
- `save()` 中输出 `data/terraforming.json`
- nameId 收集到 `needed_raw_names`，使用现有 `extract_and_resolve_languages` + `refresh_exported_i18n` 管线

### 消费方推理流程

```
当前星球 initialStats + 全部 projects → 候选项
1. 从 cluster.projectIds 筛选候选
2. conditions 的 stat 要求是否被当前状态满足
3. predecessors 是否满足
4. 完成后应用 effects，刷新候选
```

### CLI 胶水脚本

- `analysis/scripts/terraforming/terraforming.ts`: 命令行入口
  - `--planet`: 星球 ID（如 `ScalePlateGreen`）
  - `--temperature`, `--oxygen`, `--methane` 等: 当前属性值，覆盖 initialStats
  - `--completed`: 已完成的 project ID 列表（逗号分隔）
  - 使用 `getopts` 解析参数
  - 输出依赖树格式的任务列表（分组 + 缩进树）

### 核心逻辑模块

- `src/store/logic/terraformingTaskResolver.ts`: 任务推理引擎
  - `resolveAvailableTasks(cluster, currentStats, completedProjects, allProjects)` → 可用项目列表
  - `checkConditions(project, currentStats)` → boolean
  - `checkPredecessors(project, completedProjects)` → boolean
  - 返回格式化的依赖树结构供 CLI 渲染

## 边界

### In Scope

- 解析 `libraries/terraforming/final.xml` 的 stats, projectGroups, projects
- 解析 `md/terraforming/final.xml` 的 cluster 初始化（初始 stats、projectIds、依赖链）
- 内嵌 predecessors 到 project 定义
- 输出足以还原游戏内 stat 方块显示的数据语义（state 编号、颜色、habitable、value 区间）
- 输出足以让消费方区分 condition 的 state 约束与 value 约束的字段
- 为每个 cluster 预计算 `taskProjectIds`（生成端固化）：根据 cluster 的 `Ignore*` flag / `removedStats` 过滤动态项目，非动态项目全部保留
- 生成 `terraforming.json` 到 `data/` 目录
- 收集 nameId 走现有 i18n 管线
- `src/store/logic/terraformingTaskResolver.ts` 任务推理逻辑
- `analysis/scripts/terraforming/terraforming.ts` CLI 工具

### Out of Scope

- 还原完整 MD cue 逻辑（对话、任务目标步骤、奖励触发等）
- 项目完成后的 sideEffects / events 的动态触发逻辑
- 前端消费代码
- 测试编写（属于 `/x4:test` 阶段）

## 验收标准 (DoD)

1. `scripts/x4_game/terraforming/` 下存在解析模块，可被 `x4_data_processor.py` 调用
2. 运行 `x4_data_processor.py` 后在 `data/terraforming.json` 生成有效 JSON
3. `terraforming.json` 中:
  - `stats` 包含所有 11+ 个属性定义及其 ranges
   - 每个 range 至少含 `start/end/state/rgb`，可唯一确定任意 value 所落入的 state 与颜色
  - `projectGroups` 包含所有分组
  - `projects` 包含所有项目定义（含内嵌 predecessors），总数 ≥ 80
   - `projects[].conditions` 中可区分 state 语义 (`min/max`) 与 value 语义 (`minvalue/maxvalue`)
  - `clusters` 包含所有星球（≥ 8），每个有 initialStats、projectIds 和 **taskProjectIds**
  - `clusters[].taskProjectIds` 为前端唯一源：按 cluster Ignore flag / removedStats 已过滤动态项目
4. 所有 `nameId` / `descriptionId` / `textId` 文本引用已纳入 i18n 收集管线
5. `npm run build` 无编译错误
6. `npx vite-node analysis/scripts/terraforming/terraforming.ts --planet=ScalePlateGreen` 可运行并输出任务依赖树
7. `--temperature`, `--oxygen` 等参数可覆盖当前状态

## 未决项

无。
