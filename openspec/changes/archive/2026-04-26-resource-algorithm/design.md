# resource-algorithm 设计说明

## 设计目标
构建一个完整的、版本感知的资源数据处理管线，让地图资源数据（regions.json / resourceareas.json / maps.json sector.resources）能够按游戏版本正确生成，同时保持算法可理解、数据可追溯、模块可维护。

## 1. 版本分流架构

### 1.1 分流点与判定规则
版本分流在 `processor/resource/model_detector.py` 中完成：
```python
def detect_map_resource_model(version_str: str) -> str:
    major_version = int(re.match(r"(\d+)", str(version_str)).group(1))
    return "resourceareas" if major_version >= 9 else "regions"
```

### 1.2 各版本产物策略
| 版本 | regions.json | resourceareas.json | regionyields.json | regionyield_definitions.json | maps.json sector.resources |
|------|-------------|-------------------|-------------------|------------------------------|---------------------------|
| 8.0 | ✓ 模板定义 | ✓ 引用关系 | ✓ yield 定义 | ✗ | ✓ 聚合摘要 |
| 9.0+ | ✗ | ✓ 完整数据 | [] 空占位 | ✓ definition 定义 | ✓ 兼容摘要 |

## 2. 8.0 regions 模型数据结构

### 2.1 region 主体
每个 region 保留：region 级属性（density, rotation, noisescale, seed, minnoisevalue, maxnoisevalue）、boundary、falloff、fields（asteroids/debris/nebulae 三个数组）、resources（聚合摘要）

### 2.2 field 结构
fields 中每个对象保留：对象类型（asteroid/debris/nebula）、自身属性（densityfactor, rotation, rotationvariation, noisescale, seed, minnoisevalue, maxnoisevalue）、groupref、从 group 内联回填的 resource/yield/yieldvariation。nebula 的 resources 若为空格分隔的多资源字符串则拆分后参与聚合。不保留 select macro。

### 2.3 resources 聚合结构
以每个 ware 为一条聚合记录，包含累计模拟密度结果、volume_km3（统一使用 km³）、noise_coverage 显式字段、densityfactor_sum 解释字段。气体使用专用公式（含 K_gas=1000 因子）并额外输出 probe_density。

### 2.4 sector resources 聚合
按最高密度 → 阈值(1/3) → 候选矿区中选总量最大 → 输出 representative_*/max_amount_region_density。yield/level 按代表密度做对数分档。

## 3. 8.0 简化算法

### 3.1 统一公式
```
yield = base × falloff × resourcedensity
```
- 固体 base = 有效体积（截断封顶后）
- 气体 base = 有效方块数（64km³ 离散网格命中数）

### 3.2 有效空间与截断
| 维度 | 范围 |
|------|------|
| X 轴 | [-1024km, +1024km] |
| Y 轴 | [-1024km, +1024km] |
| Z 轴 | [-1024km, +1024km] |

**固体封顶**：
- cylinder: r ≤ 200km, h ≤ 2000km，面积超 2000×2000km 封顶
- sphere: 体积超 2000×2000×2000km³ 封顶
- splinetube: 曲线截断到 [-960km, +1024km]
- box: 半长向两侧展开，截断到 [-960km, +1024km]

**气体离散化**：
- 64km³ 方块网格：X/Z 各 9 格（±256km），Y 3 格（±64km），总计 243 格
- radius 按 32km 向上取整
- 高度小于 64km 按 64km 计算

### 3.3 Falloff
```
falloff = lateral_factor × radial_factor
```
lateral: 横向一元积分平均值；radial: 径向加权平均值。box 改用轴向一元积分 + 径向二元积分。

### 3.4 Rating（仅 sector.resources）
基于 respawn 的 5 级评分：<100 / <300 / <1000 / <3000 / ≥3000 → 1/2/3/4/5

## 4. 9.0+ resourceareas 模型

### 4.1 数据来源
| 来源 | 输出 |
|------|------|
| regionyields_final.xml (definition 节点) | regionyield_definitions.json |
| mapdefaults_final.xml (resourceareas 引用) | resourceareas.json |

### 4.2 definition 提取
从 definition 节点提取：id / ware / tag / yield / respawnDelay / rating / radius / objectyieldfactor / gatherspeedfactor。派生：size（从 id 提取）、sustainableYieldPerHour（yield / respawnDelay × 60）

### 4.3 resourceareas 结构

**8.0 版本**（引用关系）：
```json
{"ref": "region_ore_medium_01", "amount": 3, "resources": [{"ware": "ore", "yield": ..., "respawn": ..., "delay": ..., "gatherfactor": ..., "rating": ...}]}
```

**9.0+ 版本**（完整数据）：
```json
{"ref": "sphere_medium_hydrogen_medium", "amount": 7, "resources": [{"ware": "hydrogen", "yield": 150000, "respawn": 150000, "delay": 60, "gatherfactor": 1.0, "rating": 10.0}]}
```

## 5. 数据格式统一（resourcearea-map-accum）

- 9.0 扁平化结构改为 nested `resources` 数组，与 8.0 对齐
- `factor` → `gatherfactor`
- `rating` 从 area 级移入 resources 数组
- `yield × amount` 和 `respawn × amount` 加权累加
- sector.resources 统一按该 sector 所有 area 的 resources 按 ware 聚合

## 6. processor 模块化架构（两步分离）

### 6.1 架构概览
```
Step 1: x4_map_processor（地图生成）
  ├─ 解析 XML → 生成基础地图数据
  └─ 生成资源基础数据（regions.json, resourceareas.json 无 yield）

Step 2: x4_resource_processor（资源计算）
  ├─ 8.0 两阶段：估算（estimator）→ 逐格（per_block）
  └─ 9.0+ 直接组装（modern_processor）
```

### 6.2 目录结构
```
scripts/processor/
├── step1_map/          # Step 1: 地图生成
│   ├── service.py      # 统一入口
│   ├── generator.py    # 地图数据生成
│   └── calculator.py   # 体积/falloff 计算
├── step2_resource/     # Step 2: 资源计算
│   ├── service.py      # 统一入口
│   ├── model_detector.py
│   ├── estimator/      # 一阶段估算
│   │   ├── solid_estimator.py
│   │   └── gas_estimator.py
│   ├── per_block/      # 二阶段逐格
│   │   ├── solid.py
│   │   └── gas.py
│   ├── modern_processor.py  # 9.0+
│   └── shared.py       # 共用函数
└── shared/             # 全局共享
    ├── sector/
    └── utils/
```

### 6.3 两阶段算法
- **一阶段（估算）**：基于有效体积/方块数 × falloff × resourcedensity 估算理论储量
- **二阶段（逐格）**：使用 15×15×3 的 64k area 网格逐格计算精确储量，参考 `solid_sum_weights_replay_v2.py` / `gas_sum_weights_replay.py`

### 6.4 字段严格区分
- `theoretical_reserve`/`theoretical_respawn`：仅估算，不用于最终产量
- `reserve`/`respawn`：仅来自逐格计算，无值则保持 0
- `aggregate_sector_resources_from_resourceareas()` 必须在逐格计算完成后调用
- `summarize_sector_resources()` 已废弃，由 `aggregate_sector_resources_from_resourceareas()` 替代

## 7. 模拟噪声模型（8.0）
- 使用统一柏林噪声概率模型（经验分布/CDF），而非逐 region 重采样
- 按 `P(min <= noise <= max)` 计算覆盖率
- 不按不同 seed 拆分查表
- 结果标注为模拟近似，不宣称精确复刻

## 8. 关键设计决策

| 决策 | 方案 | 理由 |
|------|------|------|
| 版本分流 | 脚本内基于主版本号判定 | 不暴露到配置，实现细节 |
| 旧版与新逻辑隔离 | 拆分独立函数路径 | 避免模型混淆，便于维护 |
| 格式统一 | 9.0 resources 数组与 8.0 对齐 | 前端统一消费 |
| regionyields.json 9.0+ | 空数组占位 | 兼容前端加载链路 |
| processor 架构 | 两步分离 | 地图生成与资源计算独立迭代 |
| 模板与实例分离 | regions.json 仅模板 | 减少冗余，数据规范化 |
| 8.0 两阶段 | 估算 + 逐格 | 性能与精度平衡 |
| 9.0+ 不生成 regionyields.json | 最终删除空数组 | 前端已更新不依赖 |
