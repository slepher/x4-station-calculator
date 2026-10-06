# migrate 设计

## 当前链路与约束

`scripts/x4_data_processor.py` 的 `run_for_config()` 持有基础数据流水线，通过 `X4PrecisionLoader` 维护大量索引与产物。factions 在地图之前处理；地图与基础数据共享语言 registry；terraforming、research、blueprints 在语言载入后继续收集翻译，随后刷新语言产物、注入英文名称并导出。迁移必须保留这些依赖顺序，不能将其改为任意并行任务。

独立地图入口调用 `processor/step1_map/service.py`，该服务还依赖 `step2_resource` 中的模型检测与现代资源定义转换，以及 legacy regionyields 转换。因此目录中的 step1/step2 名称不等于实际依赖边界；优先提取和复用定义解析，资源重计算保持独立。

资源入口调用 `processor/step2_resource/service.py`。8.0 路径涉及 estimator、per_block_bridge、solid/gas/common、缓存合并及 save_replay；9.0+ 路径处理 resourceareas。当前资源 CLI 默认 8.0，逐格缓存固定写入 `analysis/resources/resourcearea_blocks.json`，而地图 CLI 的部分覆盖参数未传入服务。这些差异需要显式收敛，不能照搬为统一入口的隐式行为。

`scripts/processor/map`、`resource`、`shared` 和根级工具存在历史重叠，但其中部分仍被有效调用。实施先确认调用关系，按依赖闭包迁移，不能仅因目录名称看似旧就删除。`x4_data_map_processor.py` 同样需要核对实际调用方。

## 执行结构

入口 `scripts/x4_processor.ts`，npm script 为 `"process": "node --import tsx scripts/x4_processor.ts"`。使用现有 tsx loader，避免 tsx CLI 在当前沙盒创建 IPC socket 时出现 EPERM；运行语义和 npm 界面保持一致。现有 `tsconfig.node.json` 已包含 `scripts/**/*.ts`；不引入第二套运行配置或构建器。

```text
npm run process -- <task> [options]
  → 参数验证与版本选择
  → 单版本运行配置、路径及状态
  → data / map / resources 的直接函数调用
  → 阶段日志与输出摘要
```

TS 模块与现有 Python 暂时并存于 `scripts/processor/`，按实际职责组织 shared、data、map、resources；只创建迁移需要的文件，不增加 service/facade/adapter 多层转发或插件注册系统。直接复用适用的领域类型；原始 XML 及中间数据只声明实际使用的结构。该链路属于 Node 离线处理，不引入 Pinia/presenter/Vue。

CLI 使用现有 `getopts` 或 Node 标准参数能力，选择最小且能拒绝未知选项、缺值及冲突的实现。XML 使用已安装的 `fast-xml-parser`；保留字符串属性、重复元素数组和源顺序，仅在业务读取处显式转换数值，避免 ID、文本引用和前导零被自动转换。只抽取实际重复使用的 XML 读取函数，不模拟完整 ElementTree/XPath API。

## 参数与配置

| 范围 | 参数及规则 |
|---|---|
| 所有任务 | `--help`、`--version`/`--all-versions`、`--beta`/`--stable`；无版本按当前配置，候选歧义报错 |
| 验证及隔离输出 | `--output-dir` 指向任务产物根目录；data/map 下保留 `data/`、`locales/` 布局，resources 下写 `data/` 资源产物；未指定时使用配置版本目录 |
| 地图任务 | 迁移现有 XML/地图输入和输出覆盖参数，包括 `--map-dir`、各 `--*-xml`、`--output`、`--factions-output`、`--regions-output`、`--regionyields-output`；在调用服务前解析并实际传入 |
| 资源任务 | 保留 `--maps-json`、`--regions-json`、`--regionyields-xml`、`--mapdefaults-xml`、`--sector`、`--force-recalc-per-block`、`--save-sample-dir` |
| 逐格缓存 | `--blocks-cache` 显式覆盖缓存文件；默认使用 `analysis/resources/<folder_name>/resourcearea_blocks.json`，防止跨版本误用 |

单文件输出覆盖优先于 `--output-dir`；resources 未指定输出根目录时保持由 `maps-json` 所在目录决定资源输出的行为。路径选择用明确分支，不使用 fallback 链。帮助说明参数归属及模型适用范围；9.0+ 不适用的逐格重算/缓存/存档参数若被显式传入，应报错，不能假装执行了它们。

默认存档目录保持 `save_sample_data`：缺失时按现有无存档路径计算；显式指定不存在的目录则报错。默认路径行为和显式输入错误要区分。

旧的无版本逐格缓存不自动作为任意版本缓存读取。验证时将已知对应版本的基线缓存显式复制或指定到各自隔离路径；切换时旧文件保留，首次版本缓存缺失按原有冷缓存规则重算。这是版本隔离所需的路径变化，需在使用说明中列明。

配置每次启动加载一次；每个版本合并为独立对象并构造独立状态/registry，删除 import 时初始化全局配置的依赖。全版本串行执行，首个失败终止后续版本。日志至少标明任务、版本/flavor、阶段、输出；错误包含可定位上下文，CLI 边界统一转换退出码。

## 数据与地图流水线

基础数据保持现有顺序：商品/配方与索引 → 颜色与模块分组 → 资产扫描 → 飞船/装备及相关实体 → factions → map → 语言载入 → terraforming/research/blueprints → 类型与 DLC 分析 → 语言刷新与英文注入 → 元数据 → 保存。

独立 map 调用同一地图函数；基础数据传入共享 registry 与已处理 factions，独立地图按现有 English-only 行为构造 registry。两种调用方式各自对照现有入口，不强求独立 map 的 factions/语言产物与完整 data 完全相同。

`maps.json` 不包含 sector 的资源结果。地图阶段仍可以生成资源定义和引用类副产物，资源阶段读取它们并生成 `map_resources.json`；不能因文件职责分离而遗漏地图阶段提供的资源输入。

## 资源状态与数值

资源模型由现有规则确定，8.0 与 9.0+ 保持明确分支。8.0 先生成理论估计和 area 数据，再按冷缓存、热缓存、缺失星区、指定星区或强制重算选择计算范围，合并非目标缓存后汇总。存档对 reserve/respawn 的覆盖及 rating 计算保持现有先后顺序。

实际 Python 单星区基线会直接覆盖 map_resources，仅留下目标摘要；现代资源明细同样有覆盖问题，见 bugs.md B001。TS 按 request 的增量保留要求纠正此行为：目标数据精确对照 Python，非目标数据与执行前副本精确对照。全量对照仍要求全部一致，此处不引入容差或宽泛差异豁免。

数学迁移逐项确认 `round`、负数 `int` 截断、显式 float32 和噪声/样条采样。现有 common 中的 `struct` float32 行为优先使用 `Math.fround`，但必须保持原运算发生的位置。整数位运算根据原来的位宽与符号决定 JS 运算方式；只有超出安全整数范围的真实数据路径才引入 BigInt，不全局改变数值表示。保留现有不支持计算分支的明确错误。

缓存状态分支显式判定，不用连续 fallback 或吞异常来掩盖损坏。不存在的默认缓存视为冷缓存；无法解析的缓存报错，用户可显式强制重算恢复，但不能在常规路径悄悄丢弃缓存。增量写入前先完成读取、计算与合并，避免计算失败后覆盖原缓存或资源文件；需要替换单文件时采用同目录临时文件加 rename，不建设跨文件事务框架。

## 对照与验证

实施第一项记录实际原始输入、存档样例、缓存、入口调用方、完整产物清单及各领域已知修正。每次对照使用相同输入，在临时根目录下建立 python/ts 两套版本输出及缓存。Python 的固定路径在对照运行隔离副本或现有运行配置中重定向，正式资产和正式缓存均不得被写入。

JSON 对照比较文件集合，递归报告 JSON path、期望值与实际值；忽略 key 顺序和缩进，保留数组顺序、缺字段/null 和类型差异。整数零容差；浮点首先要求相等，再调查差异，不能直接默认 epsilon。若确有不可避免差异，提交字段级依据供用户确认后同步文档与断言。

Unit 放在 `tests/unit/processor/`，使用当前 Vitest，不增加测试框架。样例只覆盖实际风险：版本和 CLI、XML 形态、语言/DLC、领域规则、数值边界及资源缓存状态；每个行为随所属实现任务完成测试。全量重跑不是每个 Unit 的依赖，另以代表版本完整生成验收。记录耗时和峰值内存，只有实测问题才追加优化。

完成 TS 代码后执行 Node TS 类型检查、相关 Unit 及 `npm run build`，Rust 未改不得重建。该变更不新增浏览器功能，tasks 不安排 E2E；如后续用户要求浏览器回归，另走 x4-e2e-test。

## 实施与退出路径

依次完成契约与基线、共享能力、地图、基础数据、资源计算和统一入口切换。统一入口早期仅发布已完成的 TS 任务；未完成任务明确报错，不静默委托 Python。Python 始终可作为基线或迁移失败时的独立旧入口，过渡期不能标记为全部完成。

用户验证通过前保留 Python 实现、对照依据和调试证据；验证通过后核对所有引用再删除被替代实现，仅删除确实不再被其他脚本使用的依赖。最终清理后重新执行入口帮助、代表性 TS 生成及相关 Unit/构建，确认无 Python 运行依赖。原始输入缺失时记录明确阻塞项，不能宣布全量迁移验收完成。
