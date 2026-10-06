# Apply 验证记录

## 基准与隔离

- 日期：2026-10-07。
- 原始输入：仓库 `x4raw_assets/8.0-Diplomacy`、`x4raw_assets/9.0-Empire`，两流程读取同一输入。
- 修改前的 TS processor 副本：`/tmp/one-data-processor-original`。
- 修改前 `data --all-versions` 输出：`/tmp/one-data-processor-baseline/<folder_name>`，随后使用原 TS `resources` 分别计算两个版本的最终目录。
- 新 `all` 冷运行输出：`/tmp/one-data-processor-current/<folder_name>`。
- 8.0 原流程和新流程均从空的独立逐格缓存开始，分别位于上述根目录的 `cache/8.json`；存档均使用默认规则。9.0 不使用逐格缓存或存档覆盖。
- 原 data 日志：`/tmp/one-data-processor-baseline-data.log`；原资源日志：`/tmp/one-data-processor-baseline-resources-{8,9}.log`；新冷运行日志：`/tmp/one-data-processor-current-{8,9}.log`。
- 未覆盖仓库已生成游戏数据；没有 Rust 修改、Rust 构建、E2E、提交或归档。

## 精确比较

使用既有 `scripts/processor/compare.ts`，比较文件集合、JSON 字段、类型、精确数值及数组顺序；只忽略排版和对象 key 顺序。

| 对照 | 文件 | 差异 |
| --- | ---: | ---: |
| 8.0 新 all / 原 TS data 后接 resources | 40 | 0 |
| 9.0 新 all / 原 TS data 后接 resources | 39 | 0 |
| 8.0 两次冷运行逐格缓存 | 1 | 0 |

命令：

```bash
node --import tsx scripts/processor/compare.ts /tmp/one-data-processor-baseline/8.0-Diplomacy /tmp/one-data-processor-current/8.0-Diplomacy
node --import tsx scripts/processor/compare.ts /tmp/one-data-processor-baseline/9.0-Empire /tmp/one-data-processor-current/9.0-Empire
node --import tsx scripts/processor/compare.ts /tmp/one-data-processor-baseline/cache /tmp/one-data-processor-current/cache
PROCESSOR_BASELINE_ROOT=/tmp/one-data-processor-baseline npm run test:unit -- tests/unit/processor/pipeline-parity.spec.ts
```

真实输入 parity 定向 Unit：**2/2 通过**，285.66 秒。每个版本验证：

- 新 all 与原最终目录精确一致；8.0 使用基准缓存副本保持条件一致。
- 全部 19 个公开目标从独立输出目录执行，逐个比较所属产物。
- `ships,equipments`、`maps,map-resources`、`wares,research,blueprints` 三组多项目标与 all 对应产物精确一致。
- 每次执行前放置未选数据文件，检查执行后字节完全不变，并检查 data 目录不存在额外依赖文件。
- 独立 languages 的语言清单与全部语言文件精确一致。
- 每次输出汇总无重复路径。

## 定向 Unit

```bash
npm run test:unit -- tests/unit/processor/cli.spec.ts tests/unit/processor/data.spec.ts tests/unit/processor/extensions.spec.ts tests/unit/processor/map.spec.ts tests/unit/processor/resources.spec.ts tests/unit/processor/pipeline.spec.ts
```

结果：**6 文件通过，60 测试通过，1 条可选完整基准测试跳过**（该命令未设置外部基准环境变量；完整基准由上面的 parity 定向命令实际执行）。3.32 秒。

覆盖目标及别名校验、版本隔离、共享依赖一次执行、全部独立目标、关联产物、局部翻译与未知 locale 保留、目标顺序无关、英文名称与原引用行为、内存地图输入、显式外部输入及无效输入报错、资源唯一写入、两模型星区保留、热缓存和强制重算、损坏缓存恢复、存档规则、阶段/版本失败停止与非零 CLI 退出码。

最小输入曾暴露可选默认地图输入误判，相关 RED/GREEN 和修复记录见 `bugs.md`。外部地图默认副文件输出目录也已补齐定向回归。上述问题的最终工作流验证仍属于 `/x4:verify`。

## 构建与静态检查

- `npm run build`：通过；日志 `/tmp/one-data-processor-build.log`，最终 Vite 构建 11.27 秒。
- 拆开地图计算与保存后，`outputRoot` 只在保存函数使用，已从计算函数的解构中移除；修复此次引入的未使用变量编译错误后重新构建通过。
- 保留既有 Vite 大 chunk 提示，不扩大此次改动范围。
- `git diff --check`：通过。

此记录属于 `/x4:apply` 的定向 Unit、精确数据对照和构建证据，不替代 `/x4:verify` 的最终验证。
