# X4 数据处理

在项目根目录运行统一 TypeScript 入口：

```bash
npm run process -- --help
npm run process -- data --version 8.0 --stable
npm run process -- map --version 9.0 --stable
npm run process -- resources --version 9.0 --stable
```

`data` 生成基础数据和地图，包含派系、改造星球、研究、蓝图和语言包；`map` 独立生成地图及资源定义；`resources` 独立计算资源副文件，不修改 `maps.json`。先生成地图和定义，再运行资源任务。

版本与默认目录读取 `x4-station-calculator.config.json`。省略版本时使用配置中的当前版本/flavor，资源任务也遵守这一规则，不再固定默认 8.0。某版本存在多个候选时指定 `--beta` 或 `--stable`。`--all-versions` 按配置顺序串行运行全部版本，失败停止。

## 隔离生成和路径覆盖

```bash
npm run process -- data --all-versions --output-dir /tmp/x4-generated
npm run process -- map --version 8.0 --output-dir /tmp/x4-map-8
npm run process -- resources --version 8.0 \
  --maps-json /tmp/x4-map-8/data/maps.json \
  --regions-json /tmp/x4-map-8/data/regions.json \
  --blocks-cache /tmp/x4-map-8/cache/resourcearea_blocks.json
```

`--output-dir` 是版本输出根目录，保留 `data/` 和 `locales/`；与 `--all-versions` 同用时为每个版本追加 `folder_name`。单文件覆盖优先于根目录。资源任务省略输出根目录时写入 `--maps-json` 所在目录。

地图任务支持地图/XML 输入与已有单文件输出覆盖；通过 `npm run process -- map --help` 查看。未知选项、缺少参数值、互斥选项、无效版本和必需输入错误均返回非零退出码。

## 资源缓存与存档

8.0 `regions` 模型支持 `--sector <sector_id>` 单星区更新、`--force-recalc-per-block` 强制逐格重算、`--blocks-cache <path>` 缓存覆盖和 `--save-sample-dir <directory>` 存档样例。

默认逐格缓存位于 `analysis/resources/<folder_name>/resourcearea_blocks.json`。旧 `analysis/resources/resourcearea_blocks.json` 保留但不自动复用，版本缓存缺失时重算。常规运行遇到损坏缓存会报错；显式强制重算可恢复。增量更新保留其他星区的资源产物和缓存。

默认存档目录 `save_sample_data` 存在时使用存档储量与刷新数据，缺失时按无存档计算；显式目录不存在则报错。需要无存档对照时，可指定一个存在的空目录。

9.0+ `resourceareas` 模型支持单星区更新，但不支持逐格缓存、强制逐格重算和存档覆盖参数；显式传入会报错。

## 对照检查

使用相同原始输入及存档/缓存状态，分别生成 Python 和 TS 的隔离产物，再执行：

```bash
node --import tsx scripts/processor/compare.ts /tmp/python-output /tmp/ts-output
```

检查文件集合、字段和值类型、数组顺序和数值，忽略 JSON 排版及对象 key 顺序。发现差异时输出 JSON path 并返回非零退出码，不使用全局浮点容差。

迁移验收前保留旧 Python 入口作为对照。用户验证通过后再清理被替代的 Python 实现；范围外脚本仍使用的代码继续保留。
