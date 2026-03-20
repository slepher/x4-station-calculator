# Request: save-resource-extract

## 目标

将保存资源提取逻辑重写为 TypeScript：核心逻辑放在 `src/utils/`，命令行入口放在 `scripts/` 下的 `tsx` 脚本。实现需准确反映当前确认的需求：先从实际存档中提取星区资源点，再基于 `resourceareas.json` 与 `regions.json` 的 region 定义进行尽最大努力映射，最终输出用于校验理论值的 `total.json`。

该变更的重点不是设计新的运行时资源模型，而是明确这套工具作为“提取 + 校验聚合”工具的职责、映射规则与输出结构，并固定读取 `8.0-Diplomacy` 资产。

## 已确认方案（审核重点）

### 1. 提取层保留存档事实粒度

- 存档中的基础事实粒度是 `ware + yield_name + 坐标 + max + time`。
- `extract_sector_resources` 的输入来自 save XML 中 sector 下的 `resourceareas/area`。
- 若一个资源点在 XML 中存在多个 `<yield>`，提取阶段按存档粒度展开为多条记录，每条记录保留单个 `yield_name`。

### 2. 星区 JSON 继续作为提取中间结果

- 单个 sector JSON 继续保留 `ware -> yield_name -> resources[]` 的中间结构。
- 该结构用于保留原始提取结果，供后续聚合和 case 回查使用。
- 不再采用旧文档中 `yields[]` 数组嵌入 resource 的方案。

### 2.1 TS 落地方式

- 核心逻辑放在 `src/utils/saveResourceExtract.ts`
- 命令行入口放在 `scripts/extract_resources.tsx`
- 若需要 XML 解析库，则作为运行时依赖加入 `package.json dependencies`
- 该实现仅针对 `8.0-Diplomacy` 资产，不做版本切换抽象

### 3. 聚合前必须做 region 映射

- `total.json` 的计算不能只按 sector 内资源点直接求和。
- 每个资源点需要先尝试映射到 `resourceareas.json` 中的 region。
- region 候选条件同时包含：
  - `ware` 一致
  - `yield_name` 一致
  - 以该点为中心的 `64km x 64km x 64km` 方块与 region 空间范围有重叠
  - 对 `cylinder`，`position.y` 表示底边 `y`，竖向范围按 `[position.y, position.y + linear]` 解释

### 4. 尽最大努力映射与重叠保留

- 如果属性和空间匹配后只命中一个 region，则归入该 region。
- 如果命中多个 region，且这些 region 的空间匹配都成立，则同时归入多个 region。
- 如果多个 region 在该 sector 内存在重叠关系，则这些 region 必须先合并为一个重叠组合桶。
- 只要某个点命中这个重叠组合中的任一 region，就统一归入这个组合桶。
- 因此，若 `A` 与 `B` 重叠，则不再保留单独 `A` 或单独 `B` 的统计意义，只保留 `A+B`。

### 5. `total.json` 是校验视图

- `total.json` 仍按 `sector -> ware` 输出。
- `ware` 下不再只有一个总 `max`，而是一个聚合桶数组。
- 每个聚合桶表示一个重叠组或特殊空组：
  - `{ max, regions: [{ ref }] }`
- 若未命中任何 region，则使用 `regions: [{ ref: "" }]`
- `time` 不需要出现在 `total.json` 中。

### 6. `max` 的语义

- 每个桶的 `max` 是按映射后的重叠组得到的总量。
- 若 `A` 与 `B` 在该 sector 内重叠，则与 `A/B` 相关的点统一进入 `A+B` 桶。
- 不再输出跨所有重叠组汇总后的 ware 总 `max`。
- 该总量用于和理论值做校验，不等于几何去重后的唯一自然总量。

## 边界

### In Scope

- 实现 `src/utils/saveResourceExtract.ts`
- 实现 `scripts/extract_resources.tsx`
- 清理旧规范中与当前需求冲突的设计
- 明确提取阶段、中间 JSON、region 映射、聚合输出、歧义处理与校验用途
- 为后续实现保留可执行的 DoD 和任务拆分

### Out of Scope

- 当前阶段不要求迁移成多版本资源提取器
- 不引入新的运行时资源数据结构
- 不要求在本次文档阶段解决所有几何判定细节
- 不编写测试代码或运行测试

## 验收标准（DoD）

1. 文档明确区分“存档提取层”和“校验聚合层”。
2. 文档明确 sector JSON 继续使用 `ware -> yield_name -> resources[]` 中间结构。
3. 文档明确 `total.json` 的目标结构为 `sector -> ware -> [{ max, regions[] }]`。
4. 文档明确 region 匹配同时依赖 `ware`、`yield_name` 和 `64km x 64km x 64km` 空间重叠。
5. 文档明确 `cylinder.position.y` 是底边 `y`，不是中心 `y`。
5. 文档明确 sector 内重叠 region 必须先折叠成同一个组合桶。
6. 文档删除与当前需求冲突的 `yields[]` 聚合模型和 `ware + yields数组` 聚合规则。
7. 文档明确核心逻辑在 `src/utils/`，CLI 在 `scripts/` 的 `tsx` 文件中。
8. 文档明确读取的静态资产固定为 `8.0-Diplomacy`。

## 未决项

无。
