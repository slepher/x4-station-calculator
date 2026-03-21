# Request: save-resource-extract

## 目标

将保存资源提取逻辑重写为 TypeScript：核心逻辑放在 `src/utils/`，命令行入口放在 `scripts/` 下的 `tsx` 脚本。实现需准确反映当前确认的需求：先从实际存档中提取星区资源点，再基于 `resourceareas.json` 与 `regions.json` 的 region 定义进行尽最大努力映射，最终输出用于校验理论值的 `total.json`。

该变更的重点不是设计新的运行时资源模型，而是明确这套工具作为“提取 + 校验聚合”工具的职责、映射规则与输出结构，并固定读取 `8.0-Diplomacy` 资产。

## 已确认方案（审核重点）

### 1. 提取层保留存档事实粒度

- 存档中的基础事实粒度是 `ware + yield_name + 坐标 + max + time`。
- `extract_sector_resources` 的输入来自 save XML 中 sector 下的 `resourceareas/area`。
- 若一个资源点在 XML 中存在多个 `<yield>`，提取阶段按存档粒度展开为多条记录，每条记录保留单个 `yield_name`。

### 2. 星区 JSON 结构

- sector JSON 采用两层结构：`ware -> [{ yield_names, x, y, z, max, time, regions }]`
- 每个资源点直接展开，不再嵌套 `resources` 字段
- `yield_names` 数组包含该点的所有 yield 名称
- `regions` 数组包含聚合阶段分配的 region ref，未匹配时为空数组 `[]`

示例：
```json
{
  "sector_id": "cluster_01_sector001_macro",
  "ware": {
    "ore": [
      { "yield_names": ["lowminus"], "x": 100, "y": 200, "z": 300, "max": 50, "time": 120, "regions": ["region_a"] },
      { "yield_names": ["low"], "x": 400, "y": 500, "z": 600, "max": 80, "time": 180, "regions": [] }
    ]
  }
}
```

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
  - 以该点为中心的 `64km x 64km x 64km` 方块的**外接圆**与 region 空间范围有重叠
- region 空间范围解释：
  - **cylinder**：`position.y` 是中心 y，竖向范围 `[position.y - linear, position.y + linear]`（`linear` 是半高）
  - **box**：`position` 为原点，各轴向范围 `[position.axis - length.axis, position.axis + length.axis]`（`length.axis` 是半长）
  - **splinetube**：`spline` 中的坐标是相对坐标，实际世界坐标需要加上 `position`，即 `world_pos = spline_point + position`

### 4. 两阶段映射逻辑

#### 第一阶段：属性匹配
- 根据 `ware + yield_name` 筛选出所有符合条件的 region
- **如果只命中 1 个 region**：直接匹配，跳过坐标匹配
- **如果命中多个 region**：进入第二阶段

#### 第二阶段：坐标匹配
- 从第一阶段匹配的 region 列表中，用坐标进行空间匹配
- **如果坐标命中了部分 region**：使用坐标匹配的结果（命中的那些 region）
- **如果坐标没有命中任何 region**：回退到第一阶段匹配的全部 region 列表

#### 示例

假设 `ice/low` 有 3 个 region: A, B, C

| 场景 | 第一阶段 | 第二阶段（坐标） | 最终结果 |
|------|---------|-----------------|---------|
| 坐标命中 A | A, B, C | A | A |
| 坐标命中 A 和 B | A, B, C | A, B | A, B |
| 坐标未命中任何 | A, B, C | 无 | A, B, C（回退） |
| 只有 1 个 region | A | 跳过 | A |

### 5. 单次映射，不做二次确认

- 只使用 64km³ 方块的外接圆进行一次空间筛选
- 不做放宽半径的二次确认

### 6. 尽最大努力映射与重叠保留

- 如果属性和空间匹配后只命中一个 region，则归入该 region。
- 如果命中多个 region，且这些 region 的空间匹配都成立，则同时归入多个 region。
- 如果多个 region 在该 sector 内存在重叠关系，则这些 region 必须先合并为一个重叠组合桶。
- 只要某个点命中这个重叠组合中的任一 region，就统一归入这个组合桶。
- 因此，若 `A` 与 `B` 重叠，则不再保留单独 `A` 或单独 `B` 的统计意义，只保留 `A+B`。

### 7. `total.json` 是校验视图

- `total.json` 仍按 `sector -> ware` 输出。
- `ware` 下是一个聚合桶数组。
- 每个聚合桶结构：
  ```json
  { "max": 130, "cutted": 50, "regions": [{ "ref": "region_a" }, { "ref": "region_b" }] }
  ```
- `max`: 该桶内所有资源点的总量
- `cutted`: 该桶内坐标在核心区域（x[-448km, 448km], z[-448km, 448km], y[-64km, 64km]）的资源点总量
- 核心区域大小为 15×15×3 个 64km 方块（以原点为中心）
- `regions`: 该桶对应的 region ref 列表
- 未命中任何 region 时，`regions: [{ "ref": "" }]`
- `time` 不需要出现在 `total.json` 中。

### 8. `max` 的语义

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

1. 文档明确区分”存档提取层”和”校验聚合层”。
2. 文档明确 sector JSON 使用两层结构 `ware -> [{ yield_names, x, y, z, max, time, regions }]`。
3. 文档明确 `total.json` 的目标结构为 `sector -> ware -> [{ max, cutted, regions[] }]`。
4. 文档明确 region 匹配同时依赖 `ware`、`yield_name` 和 `64km³` 方块的外接圆与 region 空间重叠。
5. 文档明确 `cylinder.position.y` 是中心 y，范围 `[position.y - linear, position.y + linear]`；`box.position` 是原点，范围 `[position.axis - length.axis, position.axis + length.axis]`。
6. 文档明确只做单次映射，不做放宽半径的二次确认，未匹配时 `regions: []`。
7. 文档明确 sector 内重叠 region 必须先折叠成同一个组合桶。
8. 文档明确 `cutted` 字段统计核心区域（x[-448km, 448km], z[-448km, 448km], y[-64km, 64km]）的资源量。
9. 文档明确核心逻辑在 `src/utils/`，CLI 在 `scripts/` 的 `tsx` 文件中。
10. 文档明确读取的静态资产固定为 `8.0-Diplomacy`。

## 未决项

无。
