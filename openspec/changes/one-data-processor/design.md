# 统一数据处理设计

## 现状与问题

scripts/x4_processor.ts 将 data/map/resources 映射到不同 runner。data-ts/index.ts 调用地图但不调用资源；loader.ts 同时承担共享解析、构建和全量 save。地图阶段会写出 factions 与资源中间文件，资源阶段再次写 resourceareas.json。单项能力需要改动计算及写入边界，不能仅在 CLI 增加名称。

## 执行结构

保留一个 CLI、一个版本上下文和固定阶段调度。目标解析先归一化旧名称，再验证选择；按目标得到所需阶段集合和允许写出的产物集合。计算依赖去重、按固定顺序执行，各版本新建 loader 和语言 registry。阶段结果由本轮上下文保存，阶段不得为了依赖读取旧输出。

不增加通用 DAG、插件或策略框架。复用现有 XML、语言、地图和资源算法；只按真实依赖拆开混合职责的方法。入口返回统一的目标、版本、写出路径及阶段统计，替代按旧任务名称猜测 files/outputs/output_files。

## 目标与产物归属

CLI 使用以下公开目标；all 是其完整集合。支持逗号分隔组合；data/map/resources 分别作为 all/maps/map-resources 的名称别名。

| 目标 | 数据产物 |
| --- | --- |
| wares | wares.json |
| consumption | consumption.json |
| modules | modules.json、module_groups.json |
| ships | ships.json、ship_slots.json、default_maxes.json、ship_types.json、ship_races.json |
| equipments | equipments.json、equipment_types.json |
| slot-tags | slot_tags.json（统计依赖船和装备） |
| dlcs | dlcs.json |
| missiles | missiles.json |
| bullets | bullets.json |
| drones | drones.json |
| consumables | consumables.json |
| resource-info | res.json（基础资源名称及颜色） |
| factions | factions.json |
| terraforming | terraforming.json |
| research | research.json |
| blueprints | blueprints.json |
| maps | maps.json |
| map-resources | map_resources.json、resourceareas.json；8.0 的 regions.json、regionyields.json；9.0+ 的 regionyield_definitions.json；适用的版本缓存 |
| languages | locales/*.json、languages.json |

实体目标在保存前完成名称注入，并合并本轮语言条目；languages.json 是语言保存的关联清单。独立 languages 收集全部目标名称，但保存范围仅为语言。全量保存重建语言集合；局部保存按 locale 合并条目、确定性排序并从配置和实际存在的语言包形成清单，不删除未选类别条目。不在此次重构追踪翻译条目的类别归属或清理局部更新遗留的旧 key。

单独选择 slot-tags 会计算船与装备统计，但不保存船和装备 JSON；相同原则适用于其他目标的隐式依赖。目标产物表不是解析阶段表，禁止将一个大方法的所有输出都当作用户选择。

## 计算依赖和顺序

1. 初始化版本、输入路径、语言 registry。
2. 准备按需使用的 ware/配方/消费、颜色、DLC 与宏索引等基础输入。
3. 构建所选目标所需的模块、船、装备及其他实体；拆开目前耦合的船与装备构建，必要解析可共享。
4. 准备派系，供派系目标和地图计算使用；派系依赖不隐式写 factions.json。
5. 地图解析得到 maps、资源定义及区域链接。本轮数据传给地图资源计算，地图构建不提前持久化 resourceareas.json。
6. 执行需要的 terraforming/research/blueprints 等扩展；沿用原流程有效的名称与引用行为，不顺带修正旧算法。
7. 汇总所需名称、类型和 DLC 派生，刷新语言并注入已有规则下的英文名称。
8. 资源阶段按模型计算最终副文件；保存显式目标及明确关联产物。

以上是固定依赖顺序，不要求未选阶段执行。实现时从 loader 的实际读写字段确认每个目标的前置集合，定向 Unit 证明不会以缺失状态生成空产物。同一阶段最多执行一次。

## 地图与资源边界

拆出地图的构建结果与保存，现有地图算法保持不变。资源计算接收明确的 maps/definitions/区域数据，文件输入只作为显式覆盖的读取边界；不要引入临时文件桥接或先写后读的第二条流水线。

自动模式从本轮原始输入计算依赖，不检查旧 maps.json 是否存在来决定输入。显式 maps-json/regions-json 等选项则选择明确的外部输入，沿用参数对应规则；不与自动输入组成 fallback 链。整体执行支持显式覆盖，默认场景必须使用本轮地图。只有 maps 或 map-resources 实际归属的产物允许写出，整体模式的资源副文件写入一次。

地图资源整体输出对照基准是迁移前 TS data 后接 resources 的最终目录，不能将旧地图阶段的 resourceareas 中间结构误作为全量预期。

## 参数与版本

延续配置默认版本/flavor、路径覆盖及 all-versions 的 folder_name 输出规则。参数验证基于归一化目标及实际阶段，避免依赖旧 task 名称。sector 只允许单目标 map-resources；all 和多目标传入报错。资源选项在 all 中有效，但仍按当前版本模型验证；全版本中某模型不支持的显式选项报错，不静默忽略。

未知、空、重复目标（含别名归一化后重复）及 all 组合在计算前拒绝。缺少目标继续报错，帮助给出 all、单项、多项及全版本示例。旧 data 名称现在包含资源计算，明确记录行为变化。

## 异常与验证

保留原有输入验证、数值行为、缓存恢复规则、星区增量保存与模型差异。失败日志标明版本和阶段；停止后续执行。此前已经写出的文件不自动回滚，避免增加跨文件事务。

Unit 覆盖选择解析、固定依赖去重、独立目标读写范围、共享语言、地图资源责任、版本与参数分支、失败停止。用完整原始输入对两版本进行隔离输出精确比较；单项目标与同条件 all 对应文件比较。资源缓存、存档条件必须一致，未选文件用内容比较验证。无需 UI E2E；实现结束执行 npm run build，不修改 Rust 时禁止 build-rust。
