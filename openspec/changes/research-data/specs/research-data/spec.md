# Research Data Specification

## ADDED Requirements

### Requirement: Research JSON Generation Module

数据处理器 SHALL 在 `scripts/x4-game/research/` 目录下提供研究数据生成模块，仿照 `terraforming` 模块结构。

#### Scenario: parse wares.xml for research items

- **前提** wares/final.xml 存在且可解析
- **当** `process_research(loader)` 被调用
- **那么** 从 wares/final.xml 中提取所有 `transport="research"` 的 `<ware>` 元素
- **并且** 输出包含 57 个研究项

#### Scenario: extract research cost from primary block

- **前提** research ware 包含 `<research time="..."><primary>…</primary></research>` 子节点
- **当** 解析该 ware
- **那么** `cost` 字段包含 `{ware_id: amount}` 的资源消耗映射
- **并且** `researchTime` 字段包含 time 属性的值

#### Scenario: extract research dependency from nested research blocks

- **前提** research ware 包含 `<research><research><ware ware="research_xxx"/></research></research>` 嵌套块
- **当** 解析该 ware
- **那么** `dependencies` 字段包含被引用的 research ware ID 列表

#### Scenario: classify by tags

- **前提** research ware 已从 wares.xml 提取
- **当** 运行分类逻辑
- **那么** 按以下优先级输出 `category`:
  - 在 `DEFAULT_SET` 中 → `"default"`（最高优先级）
  - `hidden` 且不含 `missiononly` → `"abandoned"`
  - `missiononly`（含 hidden+missiononly）→ `"mission_progress"`
  - 其余 → `"conditional"`

#### Scenario: attach unlock metadata for conditional items

- **前提** category 为 `conditional`
- **当** 生成输出
- **那么** `unlock` 字段 SHALL 包含:
  - `key` (string) — unlock description i18n key
  - `params` (object, optional) — 支持以下动态参数:
    - `sectorMacro` — 由 maps.json 解析为 sector nameId
    - `shipWareId` — 由 ware_index 解析为 ship nameId
    - `itemWareId` — 由 ware_index 解析为 item nameId
    - `npcNameId` — 直接使用的 i18n key（如 `{30201,2}` Boso Ta）
    - `count` — 纯数字

#### Scenario: add npcNameId to i18n collector

- **前提** 存在 `npcNameId` 参数（Boso Ta `{30201,2}`）
- **当** 数据处理完成
- **那么** `{30201,2}` SHALL 被加入 `loader.needed_raw_names`

### Requirement: Pipeline Integration

`research.json` 生成 SHALL 集成到 `x4_data_processor.py` 的主数据处理流水线中。

#### Scenario: invoked in run_for_config

- **前提** `run_for_config()` 正在执行数据处理流水线
- **当** terraforming 处理完成后
- **那么** `process_research(loader)` 被调用

#### Scenario: saved with other data files

- **前提** `loader.research_data` 存在且非空
- **当** `save()` 被调用
- **那么** `research.json` 被写入 `data/` 目录

#### Scenario: English names injected

- **前提** i18n 英文数据已加载到 `en_map`
- **当** `inject_english_names()` 被调用
- **那么** `research_data.items[]` 中每个项的 `name` 字段被替换为英文译名

### Requirement: Research JSON Output Schema

`research.json` SHALL 包含一个 `items` 数组，每个元素 SHALL 符合以下结构。

#### Scenario: item structure

- **前提** 数据生成完成
- **当** 写入 research.json
- **那么** 每个 item 包含:
  - `id` (string) — research ware ID
  - `nameId` (string) — i18n raw key, 格式 `{page,id}`
  - `name` (string) — 英文显示名(注入后)
  - `dlcTag` (string) — DLC 标签
  - `tags` (string[]) — 原始 tags 拆分数组
  - `category` (string) — 分类 (default / abandoned / mission_progress / conditional)
  - `researchTime` (number) — 研究耗时(秒)
  - `cost` (object) — `{ware_id: amount}` 资源消耗
  - `dependencies` (string[]) — 前置研究项 ID 列表
  - `unlock` (object, optional) — 仅 conditional 项
    - `key` (string) — unlock description i18n key
    - `params` (object, optional) — 如 `{sectorMacro, shipWareId, count}`
