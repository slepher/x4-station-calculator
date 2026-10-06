# X4 数据处理

在项目根目录运行同一 TypeScript 流水线，目标类别与版本范围分别选择：

```bash
npm run process -- --help
npm run process -- all
npm run process -- wares --version 8.0 --stable
npm run process -- ships,equipments --version 9.0
npm run process -- all --all-versions --output-dir /tmp/x4-generated
npm run process -- map-resources --version 8.0 --sector cluster_01_sector001_macro
```

`all` 完成配置当前版本的全部迁移，包括地图资源计算；`--all-versions` 按配置顺序为每个版本运行所选目标，失败停止。单项或逗号分隔多项自动从原始输入准备依赖，不要求先生成其他输出。依赖只计算一次，不扩大写入范围。

旧名称 `data`、`map`、`resources` 分别归一化为 `all`、`maps`、`map-resources`。**`data` 现在也计算地图资源**，无需再接一条 resources 命令。

未知、空、重复目标（包含别名重复）报错；`all` 不能与其他目标组合。省略版本时使用 `x4-station-calculator.config.json` 的当前版本/flavor；某版本有多个候选时指定 `--beta` 或 `--stable`。`--version` 与 `--all-versions` 互斥。

## 目标与产物

数据产物位于输出根目录的 `data/`：

| 目标 | 产物 |
| --- | --- |
| wares | wares.json |
| consumption | consumption.json |
| modules | modules.json、module_groups.json |
| ships | ships.json、ship_slots.json、default_maxes.json、ship_types.json、ship_races.json |
| equipments | equipments.json、equipment_types.json |
| slot-tags | slot_tags.json（内存中准备船与装备统计） |
| dlcs | dlcs.json |
| missiles | missiles.json |
| bullets | bullets.json |
| drones | drones.json |
| consumables | consumables.json |
| resource-info | res.json（基础资源名称与颜色） |
| factions | factions.json |
| terraforming | terraforming.json |
| research | research.json |
| blueprints | blueprints.json |
| maps | maps.json |
| map-resources | map_resources.json、resourceareas.json；8.0 的 regions.json、regionyields.json；9.0+ 的 regionyield_definitions.json；适用缓存 |
| languages | locales/*.json、data/languages.json |

实体目标保存名称及所需语言条目，关联更新 `languages.json`。局部更新合并语言条目，保留其他类别翻译并确定性排序；不清理旧 key。`all` 与独立 `languages` 重建完整语言集合；独立 `languages` 收集全部类别名称而不写实体文件。

`maps` 不写派系、地图资源或资源缓存。`map-resources` 不写 `maps.json` 或派系。`resourceareas.json` 的最终写入只归地图资源阶段。未选数据文件保持原内容。

## 隔离生成和输入覆盖

```bash
npm run process -- all --all-versions --output-dir /tmp/x4-generated
npm run process -- maps --version 8.0 --output-dir /tmp/x4-map-8
npm run process -- map-resources --version 8.0 \
  --maps-json /tmp/external/data/maps.json \
  --regions-json /tmp/external/data/regions.json \
  --output-dir /tmp/x4-resource-8 \
  --blocks-cache /tmp/x4-resource-8/cache/resourcearea_blocks.json
npm run process -- all --version 9.0 --mapdefaults-xml /tmp/override.xml
```

`--output-dir` 是版本输出根目录，保留 `data/` 和 `locales/`；全版本模式为每个版本追加 `folder_name`。默认输出根目录为配置的 `processed_assets_dir/<folder_name>`。单文件输出覆盖仅影响所属的已选目标。

自动资源输入使用本轮地图与定义，不根据旧输出是否存在选择输入。`--maps-json` 使用明确的外部地图；9.0+ 从该地图所在目录读取 `regionyield_definitions.json`，8.0 从该目录读取资源区域输入。`--regions-json` 覆盖 8.0 区域定义，未指定时从原始输入构建。仅选择 `map-resources` 且显式提供地图而未指定输出目录时，资源输出到地图所在目录。

地图阶段支持 `--map-dir`、`--mapdefaults-xml`、`--god-xml`、`--factions-xml`、`--colors-xml`、`--region-definitions-xml`、`--regionobjectgroups-xml`、`--regionyields-xml`；输出覆盖包括 `--output`、`--factions-output`、`--regions-output`、`--regionyields-output`。通过 `--help` 查看适用参数。显式输入缺失或无效直接报错，不回退到默认输入。

## 资源缓存与存档

`--sector <sector_id>` 只允许唯一目标 `map-resources`；`all` 或多目标传入会报错。资源专用参数只在执行地图资源时可用（包括 `all`），并在执行任何版本前检查模型适用性。

8.0 `regions` 模型支持 `--force-recalc-per-block` 强制逐格重算、`--blocks-cache <path>` 缓存覆盖和 `--save-sample-dir <directory>` 存档样例。

默认逐格缓存位于 `analysis/resources/<folder_name>/resourcearea_blocks.json`，不自动复用旧无版本缓存。缺失缓存重算；损坏缓存报错，显式强制重算可恢复。星区增量更新保留其他星区资源与缓存。

默认存档目录 `save_sample_data` 存在时使用存档储量与刷新数据，缺失时按无存档计算；显式目录不存在则报错。无存档对照可指定存在的空目录。

9.0+ `resourceareas` 模型支持单星区更新，不支持逐格缓存、强制逐格重算和存档覆盖；显式传入报错。全版本运行也不静默忽略模型不支持的参数。

运行日志标识版本和阶段，输出统一文件汇总；阶段失败返回非零退出码并停止后续阶段与版本。已写出的文件不自动回滚。

## 精确对照

以相同原始输入、存档和缓存条件下原 TS `data` 后接 `resources` 的最终目录为基准，比较新 `all`：

```bash
node --import tsx scripts/processor/compare.ts /tmp/original-final /tmp/new-all
PROCESSOR_BASELINE_ROOT=/tmp/original-final npm run test:unit -- tests/unit/processor/pipeline-parity.spec.ts
```

定向 parity 测试的基准根目录需包含配置各 `folder_name` 的最终输出，以及 `cache/8.json`（8.0 基准逐格缓存）。它检查每个版本的 `all`、全部单项和代表性多项，比较文件集合、字段、类型、数组顺序与精确数值；检查未选文件字节不变。JSON 排版和对象 key 顺序不参与比较，不使用浮点容差。

无外部基准时该定向 parity 文件跳过；始终可运行的最小输入覆盖位于 `pipeline.spec.ts`。本次实施证据见 OpenSpec change 的 `validation.md`。
