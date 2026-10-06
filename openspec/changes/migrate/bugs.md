# migrate 实施发现

## B001：旧资源单星区更新丢失其他星区摘要

- 状态：TS 已按迁移需求保留非目标星区，定向 Unit 与两版本真实增量对照通过；最终验证交由 `/x4:verify`。
- 范围：本次 resources 增量合并契约。
- 复现：在完整冷缓存输出副本上执行 Python `migrate_baseline.py resources --version 9.0 --scenario single --sector cluster_01_sector001_macro`；原 `service.py` 过滤 sector_ids 后直接写新的 `map_resources.json`，未合并原摘要。
- 影响：9.0 全量 152 个 sectors，单星区更新后只剩 1 个；8.0 全量 152 个，单星区后剩 109 个，非目标资源摘要被重置为空。8.0 因已有 areas 仍保留部分星区壳，并非仅剩目标星区。9.0 原 resourceareas 输出同样未合并其他星区。
- TS 处理：增量任务读取原资源副文件，保留非目标 sectors；模型明细及逐格缓存也保留非目标数据。基线对照对目标星区精确比较，额外保留数据作为需求要求的行为修正单独验证，不复制破坏性输出。
- 回归：`tests/unit/processor/resources.spec.ts` 中 targeted forced 与 modern targeted 用例；实际完整数据增量矩阵证据写入 implementation-evidence.md。
- 不修改旧 Python 基线，也不在用户确认前删除旧实现或提交。

## B002：迁移中额外收集地图名称破坏语言产物兼容

- 状态：已修正，地图覆盖回归与两版本完整 data 对照通过；最终验证交由 `/x4:verify`。
- 复现：首次合并运行九个 processor Unit 文件，data 完整对照失败，其他八文件通过。TS 将生成地图注入 terraforming 的地图名称查找，多收集 `{20003,7840001}` 等键；旧 Python 的实际路径查找返回空映射。
- 根因有两处：mapdefaults 扫描时 collect 了之后被重复 dataset 覆盖的中间名称；以及将潜在地图名称查找能力当成现有有效行为。前者在未注入 maps_data 时也额外增加 12 种语言的同一键，后者额外改写 terraforming objective。原 Python 收集最终名称映射的全部值，不仅是实际生成的实体；只删除全部扫描收集也会漏掉合法键。
- 处理：map 扫描结束后收集最终名称映射值，保留覆盖顺序；data 主流水线保持原实际查找结果，不新增命名修复、配置开关或全局路径 fallback。扩展模块显式地图输入的 API 与其合成用例可保留。
- 回归：`tests/unit/processor/data.spec.ts` 中两版本完整同输入对照；修正后只重跑受影响 data 文件及必要集成检查。

## B003：隔离资源输出错误地承担输入角色

- 状态：实现已修正，独立目录 Unit 与 CLI 资源文件/缓存精确对照通过；最终验证交由 `/x4:verify`。
- 复现条件：8.0 纯地图与 resourceareas 在输入目录，使用 `--output-dir` 指向空的其他目录。
- 根因：初版 TS 仅从输出目录读取 resourceareas，无法恢复地图阶段提供的 region 引用，可能产生空资源结果。
- 处理：资源计算输入读取 maps-json 同目录的 resourceareas，增量保留数据读取输出目录原产物；明确区分输入与保存职责。
- 回归：resources.spec.ts 的独立输入/输出目录用例；CLI 输出 `/tmp/x4-migrate/separate-resource-output` 与冷缓存基线对照。

## B004：XML 单节点语义与字典键语义偏差

- 状态：已修正，重复节点及原型同名键 Unit 和完整 data 对照通过；最终验证交由 `/x4:verify`。
- 复现：connection 下两个 macro 时 Python `.find()` 使用第一个，TS 属性读取收到数组丢失 cargo；无人机两个 engine 时首个 repairdrone 分类偏差。DLC 新增 ware id `constructor` 被普通对象原型键误认为已存在，类型覆盖查找同样可能读取原型函数。
- 处理：在 `.find()` 等价读取处保留首节点语义；使用 own-key 判定或无原型领域字典，保持 Python 字典首引入规则。
- 回归：data.spec.ts 增加重复节点和原型同名键的合成输入；完成后重跑完整两版本对照。

## B005：数值错误及退化边界行为偏差

- 状态：已修正，数值/资源 35 项定向 Unit 与最终资源对照回归通过；最终验证交由 `/x4:verify`。
- 复现：非法 yield 字符串变成 NaN 并可能序列化为 null；finite 值 float32 溢出及非有限正数转整数没有按 Python 报错；退化 box 初版 TS 抛错，而原算法可输出零值 tile。
- 处理：在共享输入数值转换与原有 float32/截断边界保持错误语义，保留退化 box 既有 profile/输出规则。
- 回归：per-block.spec.ts 数值边界及退化 box 用例，随后两模型完整产物对照；正常有限输入的 float32 位置、运算顺序和 2001 点采样已由只读复核确认。
