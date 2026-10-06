# migrate 实施证据

## 工作区与初始检查

- 实施 worktree：`worktrees/migrate`，分支 `migrate-processor-ts`，基于 `ae6b5523`；不提交、不合并。
- 复用主工作区 node_modules 的符号链接；x4raw_assets 与 save_sample_data 使用 worktree 已有的版本管理副本，原始输入只读使用。正式 JSON 和原逐格缓存不作为写入目标。
- 初始定向检查：`npm run test:unit -- tests/unit/ship/ship-build-material.spec.ts`，exit 0，10 tests passed。
- 原先尝试的 `tests/unit/ship-build-time/ship-build-time.spec.ts` 路径不存在，未执行测试；随后按真实路径完成上述初始检查。

## 实际依赖与入口

| 入口 | 有效运行依赖 |
|---|---|
| x4_data_processor | versioning/path_utils/i18n/dlc_tag、step1_map；x4-game factions、terraforming(parse_library/parse_md)、research、blueprints |
| x4_map_processor | step1_map service/generator/calculator/converter/update_regions_fields；还调用 map 常量/转换/计算、sector parser/template/resource_summary、resource legacy/modern、utils/shared output |
| x4_resource_processor | step2_resource service/model_detector/modern/shared/save_replay/estimator/per_block_bridge/per_block solid/gas/common、shared 数学与输出 |
| x4_data_map_processor | 仓库 scripts/tests 中未发现外部运行调用；历史重复 CLI 与文档引用在切换时核对，不复制整份旧实现 |

不能按目录名字删掉 map/resource 历史模块：step1_map 当前仍引用其中部分函数。独立 x4-game run/replay、资产蒸馏及 worktree-server 不属于本次执行闭包。Python TYPE_CHECKING 的 loader 引用不等同于运行时依赖。

基础流水线按原 run_for_config 顺序迁移；已知业务修正包括 bogas → agricultural、排除 nividiumgems、energycells 指定颜色、既有装备/飞船标签与槽位处理。完整规则以源函数及同输入基线为准。

## 可用输入和隔离基线

两版本原始目录 `x4raw_assets/8.0-Diplomacy`、`x4raw_assets/9.0-Empire` 均存在，包含 libraries/maps/t/md。`save_sample_data` 有逐星区 JSON，原逐格缓存约 5.9 MiB。原缓存不自动用于任意版本 TS 运行。

基线脚本：`analysis/tmp_scripts/migrate_baseline.py`（临时脚本目录按仓库规则忽略）。从 worktree 执行：

```bash
python3 analysis/tmp_scripts/migrate_baseline.py map --version 8.0
python3 analysis/tmp_scripts/migrate_baseline.py map --version 9.0
python3 analysis/tmp_scripts/migrate_baseline.py data --version 8.0
python3 analysis/tmp_scripts/migrate_baseline.py data --version 9.0
python3 analysis/tmp_scripts/migrate_baseline.py resources --version 8.0
python3 analysis/tmp_scripts/migrate_baseline.py resources --version 9.0
```

Python 基础数据写 `/tmp/x4-migrate/python/<version>/data-output/<folder_name>`，地图写 `/tmp/x4-migrate/python/<version>/map`。资源先复制隔离地图输出，然后写 `/tmp/x4-migrate/python/<version>/resources/<scenario>`，该进程内将资源模块缓存目录指向对应的 `cache/`。脚本断言 maps 字节不变，不修改 Python 源文件或正式产物。

| 已完成基线 | 秒 | 峰值 RSS KiB |
|---|---:|---:|
| 8.0 data | 8.549 | 252424 |
| 9.0 data | 3.822 | 255752 |
| 8.0 map | 5.196 | 73816 |
| 9.0 map | 0.353 | 67852 |
| 9.0 resources cold | 0.257 | 31540 |

8.0 resources 冷缓存及后续矩阵已完成。运行详情记录在 `/tmp/x4-migrate/python/<version>/*-run.json`，日志在 `/tmp/x4-migrate/`。

| 8.0 资源基线场景 | 秒 | 峰值 RSS KiB |
|---|---:|---:|
| cold | 440.454 | 55012 |
| warm | 0.571 | 78704 |
| missing | 74.434 | 122184 |
| single | 0.567 | 78816 |
| save | 1.547 | 107948 |
| forced（与其他检查并行） | 664.025 | 70600 |

## 产物清单

基础数据共有 `blueprints, bullets, consumables, consumption, default_maxes, dlcs, drones, equipment_types, equipments, factions, languages, maps, missiles, module_groups, modules, res, research, ship_races, ship_slots, ship_types, ships, slot_tags, terraforming, wares` 的 data JSON 及 12 种 locales JSON。8.0 额外为 `regions, regionyields, resourceareas`；9.0 额外为 `regionyield_definitions`。

独立 map：8.0 输出 maps/factions/regions/regionyields/resourceareas；9.0 输出 maps/factions/regionyield_definitions。resources 的模型产物与缓存详见后续矩阵证据。

## 已执行共享 Unit

`npm run test:unit -- tests/unit/processor/shared.spec.ts tests/unit/processor/cli.spec.ts`：exit 0，9 tests passed。覆盖参数冲突、版本选择、串行失败退出和状态隔离、路径优先级、模型参数约束、XML 节点/字符串属性/非法文档、语言混合文本/递归/缺失/版本隔离、精确 half-even 舍入、JSON 差异类型及序列化失败保留旧文件。

对照命令：`node --import tsx scripts/processor/compare.ts <python-output> <ts-output>`。精确比较，不设全局浮点容差。tsx CLI 在沙盒创建 IPC socket 失败（EPERM），使用同一现有 tsx 包的 Node loader 执行，已同步 npm 命令。

## 地图及扩展结果

- `map.spec.ts` + `map-parity.spec.ts`：14 tests passed，exit 0；覆盖共享 registry、重复覆盖后的最终名称映射收集、路径覆盖、两模型定义和数学规则。
- `extensions.spec.ts`：5 tests passed，exit 0；四个领域严格匹配两版本 Python 输出，合成输入覆盖 licences、蓝图分类和改造星球关键规则。
- npm 全版本 map 生成：`npm run process -- map --all-versions --output-dir /tmp/x4-migrate/cli-map`，exit 0。两目录对照均 differenceCount 0，保留配置顺序与版本隔离。
- 最终名称收集修正后的 CLI map 重跑至 `/tmp/x4-migrate/cli-map-final`，exit 0，两个最终对照报告均 differenceCount 0。8.0 为 7.060 秒/340972 KiB，随后 9.0 为 0.809 秒/累计峰值 428888 KiB。

## 资源结果

`analysis/tmp_scripts/migrate_resource_acceptance.ts` 汇总 `/tmp/x4-migrate/resource-acceptance.json`：11 个检查全部 differenceCount 0，包括 8.0 cold/warm/missing/forced/save、两模型单星区目标对照与非目标保留，以及 8.0 独立输出目录下的两资源文件和缓存。

单星区检查不复制 B001 数据丢失：目标 JSON 精确对照 Python single，其他星区精确对照 TS 执行前完整副本。资源 Unit 同时断言 maps 字节不变、计算失败保留旧文件、损坏缓存的恢复和跨版本缓存隔离。

- 数值/资源定向回归：`npm run test:unit -- tests/unit/processor/per-block.spec.ts tests/unit/processor/resources.spec.ts`，exit 0，35 tests passed。
- 最终资源对照回归：`npm run test:unit -- tests/unit/processor/resources-parity.spec.ts`，exit 0，8 tests passed；包括两模型完整产物、热缓存与适用增量场景。
- 数值复核与回归保持 float32 运算位置、有限溢出错误、原截断规则、2001 点 spline、退化 box 及非法输入错误。正常有限输入产物精确相同。

两版本 npm resources 均已执行，输入为隔离地图，输出在 `/tmp/x4-migrate/cli-resources/<version>`，8.0 缓存显式写临时目录且使用空存档目录，exit 0。

| TS CLI 任务 | 秒 | 进程峰值 RSS KiB |
|---|---:|---:|
| 8.0 resources cold | 21.225 | 311592 |
| 9.0 resources cold | 0.088 | 123512 |

以上为当前机器实际运行值；部分 Python/TS 检查并行，不能当作严格性能基准。命令完成摘要包含耗时及进程峰值 RSS；多版本同进程时 RSS 为累计高水位。

## 构建与剩余门槛

最终 `npm run build` exit 0，Vite 构建耗时 17.07 秒，有既有 bundle size 提示，未为此改动前端分包。`npm exec tsc -- --noEmit -p tsconfig.node.json` exit 0，日志 `/tmp/x4-migrate/typecheck-final.log`。不重建 Rust，不运行 E2E 或完整项目 Unit。

## 基础数据与统一 CLI 最终验收

`npm run test:unit -- tests/unit/processor/data.spec.ts`：exit 0，10 tests passed，包括同进程两版本完整生成、重复节点首匹配、原型同名键、DLC、构建/库存和语言刷新。完整生成报告 `/tmp/x4-migrate/ts-data/{8.0,9.0}-comparison.json` 均 differenceCount 0。

| 版本 | 文件 | 模块 | 商品 | 飞船 | 装备 | 差异 |
|---|---:|---:|---:|---:|---:|---:|
| 8.0 | 39 | 320 | 60 | 232 | 537 | 0 |
| 9.0 | 37 | 325 | 63 | 234 | 542 | 0 |

最终 npm data 全版本执行：`npm run process -- data --all-versions --output-dir /tmp/x4-migrate/cli-data`，exit 0。输出根目录为各 folder_name，按配置串行执行。两个完整目录再次与 Python 精确对照，报告 `/tmp/x4-migrate/cli-data-{8,9}-diff.json` 均为 0。

| TS CLI data 顺序执行 | 秒 | 进程累计峰值 RSS KiB |
|---|---:|---:|
| 8.0 | 17.723 | 765428 |
| 9.0 | 9.816 | 990256 |

当前 TS XML 解析全量 data 进程峰值约 967 MiB，比 Python 基线更高；已明确记录，未为此新增未经需求确认的并行或缓存优化。该值是多版本同进程高水位，不是每个版本独立内存占用。

最终 CLI 定向文件 `cli.spec.ts`：4 tests passed，exit 0。各域最终定向检查总计 81 个通过（shared 5、CLI 4、map 14、extensions 5、data 10、数值/resources 35、resources parity 8），不是完整项目 Unit 验证。

运行依赖检查：三个任务及 `scripts/processor/*-ts` 不引用 Python、child_process 或旧 `.py`。新 npm 入口原生调用三个 TS 函数；无新增依赖。全部生成验收使用临时目录，正式游戏产物和缓存未作为写入目标。

Python 入口、实现和调试证据保留，未提交、未合并。用户验证通过前不执行 tasks 6.5 的 Python 清理，最终全套验证使用 `/x4:verify migrate`。
