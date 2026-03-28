## 0. Step 1 模块迁移

### 0.1 目录结构创建

- [x] 0.1.1 创建 `scripts/processor/step1_map/` 目录
- [x] 0.1.2 创建 `scripts/processor/step1_map/__init__.py`
- [x] 0.1.3 创建 `scripts/processor/step1_map/service.py` 统一入口
- [x] 0.1.4 创建 `scripts/processor/step1_map/generator.py` 地图数据生成
- [x] 0.1.5 创建 `scripts/processor/step1_map/converter.py` 转换逻辑
- [x] 0.1.6 创建 `scripts/processor/step1_map/calculator.py` 基础计算
- [x] 0.1.7 创建 `scripts/processor/step1_map/constants.py` 常量定义
- [x] 0.1.8 创建 `scripts/processor/shared/` 目录
- [x] 0.1.9 创建 `scripts/processor/shared/__init__.py`
- [x] 0.1.10 创建 `scripts/processor/shared/output_manager.py`
- [x] 0.1.11 创建 `scripts/processor/shared/sector/` 目录
- [x] 0.1.12 创建 `scripts/processor/shared/utils/` 目录

### 0.2 代码迁移（从现有 processor/）

**策略**：先迁移，再修改 step1_map/

- [x] 0.2.1 复制 `processor/map/*.py` → `step1_map/`
- [x] 0.2.2 修改 `step1_map/service.py` 为独立实现（移除委托，修改导入路径）
- [x] 0.2.3 修改 `step1_map/generator.py` 适应新输出需求
  - 添加 sector.regions 输出（8.0 和 9.0+）
  - 停止 sector.resources 聚合
  - 停止 resourceareas.json 输出
- [x] 0.2.4 删除 `scripts/processor/x4_map_processor.py`
- [x] 0.2.5 移动 `scripts/processor/x4_resource_processor.py` → `scripts/x4_resource_processor.py`
- [x] 0.2.6 迁移 `processor/sector/` → `shared/sector/`
- [x] 0.2.7 迁移 `processor/utils/` → `shared/utils/`
- [x] 0.2.8 迁移 `processor/output_manager.py` → `shared/output_manager.py`
- [x] 0.2.9 保留 `processor/config.py`, `path_utils.py`, `versioning.py`, `dlc_tag.py`, `i18n.py`

### 0.3 Step 1 输出调整

**8.0 版本**：
- [x] 0.3.1 输出 `regionyields.json`（资源颜色和 yield 定义）
- [x] 0.3.2 输出 `regions.json`（region 模板定义，含 boundary, falloff, volume_km3）
- [x] 0.3.3 输出 `maps.json` 中 sector.regions（含 ref, position, rotation, boundary, volume_km3）
- [x] 0.3.4 **停止输出** `resourceareas.json`（由 Step 2 生成）
- [x] 0.3.5 **停止输出** sector.resources（由 Step 2 回填）

**9.0+ 版本**：
- [x] 0.3.6 输出 `regionyield_definitions.json`（definition 定义）
- [x] 0.3.7 输出 `maps.json` 中 sector.regions（含 ref, amount）
- [x] 0.3.8 **停止输出** `resourceareas.json`
- [x] 0.3.9 **停止输出** sector.resources

### 0.4 Step 1 入口脚本

- [x] 0.4.1 更新 `scripts/x4_map_processor.py` 调用 step1_map
- [x] 0.4.2 实现版本检测逻辑（调用 model_detector）
- [x] 0.4.3 实现 8.0/9.0+ 版本分叉

---

## 1. Step 2 模块结构创建

- [x] 1.1 创建 `scripts/processor/step2_resource/` 目录结构
- [x] 1.2 创建 `scripts/processor/step2_resource/__init__.py`
- [x] 1.3 创建 `scripts/processor/step2_resource/service.py` 统一入口
- [x] 1.4 创建 `scripts/processor/step2_resource/model_detector.py` 版本检测（从现有代码迁移）
- [x] 1.5 创建 `scripts/processor/step2_resource/estimator/` 子目录
- [x] 1.6 创建 `scripts/processor/step2_resource/per_block/` 子目录
- [x] 1.7 创建 `scripts/processor/step2_resource/modern_processor.py` (9.0+ 处理)

## 2. 固体估算算法实现

- [x] 2.1 创建 `scripts/processor/step2_resource/estimator/__init__.py`
- [x] 2.2 创建 `scripts/processor/step2_resource/estimator/solid_estimator.py`
- [x] 2.3 实现 `calculate_solid_volume_km3()` - 计算封顶后体积
  - cylinder: 底面积封顶 min(π×r², 1024²)，高度封顶 min(2×linear, 2048)
  - sphere: 体积封顶 min((4/3)×π×r³, 1024³)
  - splinetube: 曲线截断到 [-1024, +1024]，计算有效长度
  - box: 盒体截断到 [-1024, +1024]
- [x] 2.4 实现 `estimate_solid_yield()` - 计算理论储量
  - `theoretical_reserve = solid_volume_km3 × falloff × resourcedensity`
  - `theoretical_respawn = theoretical_reserve × 60 / replenishtime`
- [x] 2.5 参考 `solid_sum_weights_replay_v2.py` 实现 falloff 积分（per_block/solid.py）

## 3. 气体估算算法实现

- [x] 3.1 创建 `scripts/processor/step2_resource/estimator/gas_estimator.py`
- [x] 3.2 实现 `calculate_gas_volume_km3()` - 离散化体积计算
  - cylinder: 按 64km 分层，统计命中层数
  - sphere: 半径按 32km 向上取整
  - splinetube: 截面离散为 64km × 64km 方阵
  - box: 枚举 64km 网格统计命中
- [x] 3.3 实现 `estimate_gas_yield()` - 计算理论储量（含 `/64³` 因子）
  - `theoretical_reserve = gas_volume_km3 × falloff × resourcedensity / 64³`
  - `theoretical_respawn = theoretical_reserve × 60 / replenishtime`
- [x] 3.4 参考 `gas_sum_weights_replay.py` 实现分层算法（per_block/gas.py）

## 4. 固体逐格算法实现

- [x] 4.1 创建 `scripts/processor/step2_resource/per_block/__init__.py`
- [x] 4.2 创建 `scripts/processor/step2_resource/per_block/common.py` (共用模块)
- [x] 4.3 创建 `scripts/processor/step2_resource/per_block/solid.py` (固体模块)
- [x] 4.4 实现核心计算函数（从 `solid_sum_weights_replay_v2.py` 提取）
  - `compute_cylinder_axial_interval()`: 圆柱轴向区间
  - `compute_cylinder_radial_interval()`: 圆柱径向区间
  - `compute_cylinder_falloff_weight()`: 圆柱 falloff 权重
  - `compute_splinetube_falloff_weight()`: 样条管 falloff 权重
  - `enumerate_candidate_area_centers()`: 枚举候选方块中心
- [x] 4.5 实现 noise 处理函数（从 replay 脚本提取）
  - `compute_noise_cdf()`: noise CDF 计算
  - `compute_local_noise_fast_path()`: 快速路径 noise 计算
  - `compute_multiplier_a/b()`: 乘数计算
- [x] 4.6 实现 falloff 插值函数（从 replay 脚本提取）
  - `eval_profile_avg()`: profile 平均值计算
  - 使用梯形积分，自动在 profile 点处细分
- [x] 4.7 实现主入口函数 `replay_region_solid_sum_weights_and_areas()`

## 5. 气体逐格算法实现

- [x] 5.1 创建 `scripts/processor/step2_resource/per_block/gas.py`
- [x] 5.2 实现核心计算函数（从 `gas_sum_weights_replay.py` 提取）
  - `compute_cylinder_axial_interval()`: 气体圆柱轴向区间
  - `compute_cylinder_radial_interval()`: 气体圆柱径向区间
  - `compute_cylinder_profile_weight_for_query()`: 气体圆柱 profile 权重
  - `compute_sphere_radial_interval()`: 球体径向区间
  - `compute_box_interval()`: 盒体区间
- [x] 5.3 实现候选方块枚举函数
  - `enumerate_candidate_area_centers_for_cylinder()`
  - `enumerate_candidate_area_centers_for_sphere()`
  - `enumerate_candidate_area_centers_for_box()`
  - `enumerate_candidate_area_centers_for_splinetube()`
- [x] 5.4 实现主入口函数 `replay_gas_area_values_for_field()`

## 6. 共用函数模块

- [x] 6.1 创建 `scripts/processor/step2_resource/shared.py`
- [x] 6.2 实现 `calculate_falloff_factors()` - falloff 因子计算
  - `lateral_factor`: 横向一元积分平均值
  - `radial_factor`: 径向加权平均值
- [x] 6.3 实现 `calculate_falloff_at_point()` - 某点 falloff 值
- [x] 6.4 实现 `aggregate_sector_resources_from_resourceareas()` - sector 资源聚合
  - `reserve = Σ(resourcearea.reserve × amount)`
  - `respawn = Σ(resourcearea.respawn × amount)`
  - `theoretical_reserve/respawn` 仅 8.0
- [x] 6.5 实现 `calculate_rating()` - 基于 respawn 的 rating 计算（1-5 级）
- [x] 6.6 实现坐标变换函数（position/rotation 到局部坐标）

## 7. 9.0+ 版本处理

- [x] 7.1 实现 `build_resourceareas_json_payload()` - 直接组装 resourceareas.json
- [x] 7.2 从 definition 读取 yield/respawn/delay/gatherfactor/rating
- [x] 7.3 聚合 sector.resources

## 8. 入口脚本与参数

- [x] 8.1 创建 `scripts/x4_resource_processor.py`
- [x] 8.2 实现 `--all-sectors` 参数：处理所有星区
- [x] 8.3 实现 `--sector <sector_id>` 参数：单星区增量更新
  - 仅更新 maps.json 指定 sector 的 resources
  - 仅更新 resourceareas.json 指定 sector 的 areas
  - 仅更新 resourcearea_blocks.json 指定 sector 的明细
- [ ] 8.4 单 sector 模式自动验算（读取 resourcearea_blocks_game.json）

## 9. 输出文件管理

> **Step 2 输出策略**：
> - `resourcearea_blocks.json` → 固定输出到 `analysis/resources/`（用于验收比对）
> - 其他文件（`resourceareas.json` 等）→ 输出到输入 json 文件所在目录（自动推断，无需参数）
>
> 例如：输入 `src/assets/x4_game_data/8.0-Diplomacy/data/maps.json`
> → 输出 `src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json`

- [x] 9.1 `resourcearea_blocks.json` 输出到 `analysis/resources/`（固定路径）
- [x] 9.2 其他文件输出到输入 json 所在目录（自动推断）
- [ ] 9.3 实现增量写入（仅更新指定 sector 数据）

## 10. 验收脚本修改

- [x] 10.1 修改 `scripts/x4-game/solid_sum_weights_replay_v2.py`
  - 添加 `--all-sectors` 参数
  - 添加 `--output-dir` 参数
  - 添加 `--cut-mode` 参数（`full` / `15x15x3`）
  - 输出 `resourcearea_blocks_game.json`
- [x] 10.2 修改 `scripts/x4-game/gas_sum_weights_replay.py`
  - 同上参数
- [x] 10.3 实现网格范围模式映射
  - `full`: X/Z [-960, +1024], Y [-960, +1024]
  - `15x15x3`: X/Z [-480, +480], Y [-96, +96]

## 11. 验证脚本创建

- [x] 11.1 创建 `scripts/processor/verify_resource_blocks.py`
- [x] 11.2 实现 `resourcearea_blocks_game.json` 与 `resourcearea_blocks.json` 比对
- [x] 11.3 输出差异报告到 `analysis/resources/verify_report.json`
  - `summary`: 通过/失败 sector 数量
  - `failed_details`: 每个 sector 的差异详情
- [x] 11.4 验收标准
  - 方块数量完全一致
  - 坐标完全一致
  - reserve 相对误差 < 0.01%

## 12. 验收流程执行

> **已知限制**：
> - per_block 计算对 splinetube 边界类型性能较差（单个资源可能需要 100+ 秒）
> - 原因：splinetube 需要对每个 tile 计算到样条曲线的距离，复杂度为 O(tiles × spline_samples)
> - 当前使用估算模式（estimator）作为默认，逐格计算作为可选功能

- [x] 12.0 创建 `scripts/processor/step2_resource/per_block_bridge.py` 桥接模块
  - 将 JSON 数据转换为 per_block 模块需要的状态对象
  - ~~解析 XML 文件获取 field definitions~~ → 已改为从 regions.json 读取
- [x] 12.0.1 创建 `scripts/processor/step1_map/update_regions_fields.py`
  - 从 region_definitions XML 提取 field 定义到 regions.json
  - 添加 density 和 fields 字段到每个 region
- [x] 12.0.2 更新 per_block_bridge.py 读取 regions.json
  - 从 regions.json 读取 density 和 fields
  - 只保留 regionobjectgroups XML 用于 yield 值
- [x] 12.0.3 优化 service.py 处理粒度
  - 按 (sector, field) 去重，避免重复计算
  - 每个 field 只计算一次，结果复用于同 ware 的多个资源
- [x] 12.0.4 添加 ware 字段到 per_block 输出
  - solid.py 的 field_rows 增加 `ware` 字段
  - 便于 service 层按 ware 过滤结果
- [ ] 12.1 整体验收：运行所有星区
  > **注意**：验收需要游戏脚本以完整网格模式运行
  > ```bash
  > # 游戏脚本使用 --cut-mode full（完整网格）
  > python scripts/x4-game/solid_sum_weights_replay_v2.py --all-sectors --cut-mode full --output-dir analysis/resources/
  > python scripts/x4-game/gas_sum_weights_replay.py --all-sectors --cut-mode full --output-dir analysis/resources/
  >
  > # 处理器运行两阶段（估算+逐格）
  > python scripts/x4_resource_processor.py --all-sectors \
  >   --maps-json src/assets/x4_game_data/8.0-Diplomacy/data/maps.json \
  >   --regions-json src/assets/x4_game_data/8.0-Diplomacy/data/regions.json
  >
  > # 验证比对
  > python scripts/processor/verify_resource_blocks.py
  > ```
  ```bash
  python scripts/x4-game/solid_sum_weights_replay_v2.py --all-sectors --cut-mode 15x15x3 --output-dir analysis/resources/
  python scripts/x4-game/gas_sum_weights_replay.py --all-sectors --cut-mode 15x15x3 --output-dir analysis/resources/
  python scripts/x4_resource_processor.py --all-sectors --maps-json src/assets/x4_game_data/8.0-Diplomacy/data/maps.json
  python scripts/processor/verify_resource_blocks.py
  ```
- [ ] 12.2 定位差异：分析 `verify_report.json`
- [ ] 12.3 调整算法：针对差异原因修改对应模块
- [ ] 12.4 单 sector 验收：循环直到全部通过
  ```bash
  python scripts/x4_resource_processor.py --sector <sector_id> --maps-json src/assets/x4_game_data/8.0-Diplomacy/data/maps.json
  ```

## 13. 文档更新

- [x] 13.1 更新 proposal.md 反映代码实现范围
- [x] 13.2 更新 specs 补充实现细节要求（已在 design.md 中更新）

## 14. 清理旧代码

> **注意**：验收全部通过后再执行此步骤

- [ ] 14.1 删除 `processor/map/` 目录（已迁移到 step1_map/）
- [ ] 14.2 删除 `processor/sector/` 目录（已迁移到 shared/sector/）
- [ ] 14.3 删除 `processor/utils/` 目录（已迁移到 shared/utils/）
- [ ] 14.4 删除 `processor/output_manager.py`（已迁移到 shared/）
- [ ] 14.5 删除 `processor/resource/` 目录（由 step2_resource/ 替代）
- [ ] 14.6 验证删除后所有功能正常