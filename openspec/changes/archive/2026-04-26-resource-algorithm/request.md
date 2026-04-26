# resource-algorithm 需求说明

## 目标
实现完整的 X4 地图资源数据处理管线：从 XML 原始数据提取、region 模型构建、资源算法简化与计算、多版本(8.0/9.0)分流、到 processor 模块化架构重构。所有 5 个原子变更（map-resource-calc / map-resource-algorithm / resources-new / resourcearea-map-accum / map-resource-processor）已完成实现并在此合并。

## 已确认方案

### 1. 资源数据处理管线总览

实现了一个完整的资源数据处理管线，分为两大版本模型：
- **8.0 (regions 模型)**：解析 `region_definitions_final.xml` + `regionobjectgroups_final.xml` + `mapdefaults_final.xml`，生成 `regions.json`（region 模板定义）、`resourceareas.json`（region 到 sector 的实例引用）、`maps.json`（sector 级资源聚合摘要）
- **9.0+ (resourceareas 模型)**：解析 `regionyields_final.xml`（definition 节点）+ `mapdefaults_final.xml`（resourceareas 引用），生成 `resourceareas.json`（资源区数据）、`regionyield_definitions.json`（definition 模板数据）、`maps.json`（sector 级兼容摘要），不再生成 `regions.json`

### 2. 8.0 简化算法

- 移除 `<fields>` 节点依赖（但仍保留在 `regions.json` 中作为原始数据）
- 不再使用 `densityfactor`、`objectyieldfactor`、`gatherspeedfactor` 等系数计算
- 不再使用 noise 概率修正
- 产量统一公式：`yield = base × falloff × resourcedensity`
- **固体**：基础量 = 有效体积（截断封顶后），`solid_yield ≈ volume_km3 × falloff × resourcedensity`
- **气体**：基础量 = 有效方块数（64km³ 网格离散化），`gas_yield = hit_block_count × falloff × resourcedensity`
- 模板数据（`regions.json`）与实例计算结果（`resourceareas.json`）分离
- `regions.json` 中仅保留 `ware`、`resourcedensity`、`delay`、`gatherfactor`、`yield_name` 等模板字段，移除 noise 相关字段

### 3. regions.json 提取范围

- `regions.json` 保留 region 定义中的有效数据：region 级属性（`density`、`rotation`、`noisescale`、`seed`、`minnoisevalue`、`maxnoisevalue`）、`boundary`、`falloff`、`fields`（asteroids/debris/nebulae 三个数组）
- fields 中保留资源分析必需字段，不保留无明确用途的 `select macro` 列表
- group 产额信息内联到 field，不建立独立 group_catalog 文件
- 每个 region 下新增 `resources` 聚合字段，按 `ware` 聚合 field 数据
- sector 级继续聚合到 `sector.resources`，按代表矿区密度阈值（最高密度的 1/3）筛选
- yield/level 基于代表密度做固定对数分档

### 4. 多版本分流设计

- 版本判定在 Python 脚本内完成：`detect_map_resource_model(version_str)` 基于主版本号（`>= 9` 为 resourceareas 模型）
- 判定逻辑不暴露到 `versions.json` 或其他前端配置
- `< 9.0` 继续生成旧产物（`regions.json`、旧结构 `regionyields.json`），`>= 9.0` 停产 `regions.json`、生成 `resourceareas.json`、`regionyields.json` 固定为 `[]`
- 旧版解析逻辑与新版完全隔离，不复用错误的数据语义

### 5. resourceareas.json 格式统一

- 9.0 的 `resourceareas.json` 格式重构为与 8.0 一致的 `resources` 数组结构
- 扁平化的 `ware/yield/respawn/delay/factor/rating` 字段移动到 `resources` 数组内
- 同一 area 内相同 ware 的资源合并：`total_yield = Σ(yield × amount)`、`total_respawn = Σ(respawn × amount)`
- `factor` 重命名为 `gatherfactor`
- `rating` 从 area 层级移入 `resources` 数组

### 6. processor 模块化架构

- 整体架构采用两步分离：Step 1（`x4_map_processor`）负责地图生成 + 资源基础数据，Step 2（`x4_resource_processor`）负责资源计算
- Step 2 包含四个算法模块：固体估算、气体估算、固体逐格、气体逐格
- 8.0 采用两阶段处理：一阶段估算（理论储量）→ 二阶段逐格（精确储量）
- 完成了模块迁移：`processor/map/` → `step1_map/`，`processor/resource/` → `step2_resource/`，`processor/sector/` → `shared/sector/`，`processor/utils/` → `shared/utils/`，`processor/output_manager.py` → `shared/output_manager.py`

## 边界

### In Scope
- 所有版本（8.0/9.0+）的资源数据处理管线
- 区域资源数据提取、聚合、算法、输出全流程
- 简化 8.0 资源算法、9.0 新模型支持
- 数据格式统一（resourceareas.json 的 resources 数组结构）
- processor 模块化重构与文档化

### Out of Scope
- 前端 UI 改造
- 精确复刻引擎噪声实现
- 测试策略

## 验收标准（DoD）
- `regions.json`（8.0）包含 region 级详细结构、boundary、falloff、fields 与 resources 聚合
- `regions.json` 不含 resources 为空的无用 region
- `resourceareas.json`（8.0 和 9.0）格式一致，使用 `resources` 数组结构，字段命名统一
- `resourceareas.json`（9.0）包含 sectorResourceAreas 引用与 definitions 模板数据
- 8.0 算法简化完成，固体/气体使用统一公式
- 多版本分流正确：`< 9` 使用 regions 模型，`>= 9` 使用 resourceareas 模型
- processor 模块化迁移完成，step1_map/、step2_resource/、shared/ 目录到位
- 算法文档（固体估算、气体估算、固体逐格、气体逐格）完整
