# Faction-Runner Specification

## Purpose

为 X4 数据流水线提供共享模块、i18n locale 注入功能和独立 factions 数据生成模块。

## ADDED Requirements

### Requirement: Shared Runner Module

`scripts/x4-game/shared/runner.py` SHALL 提供 `BaseRunner` 抽象类，统一独立脚本的 CLI 解析、版本迭代和输出流程。

#### Scenario: unified CLI

- **前提** 子类继承 BaseRunner 并实现 `build_data()`
- **当** 执行 `python run.py --version 9.0 --beta`
- **那么** CLI SHALL 接受 `--version`, `--beta`, `--stable`, `--all-versions` 参数
- **并且** SHALL 按版本配置循环处理

#### Scenario: subclass implements build_data

- **前提** 子类定义 `name` 属性和 `build_data()` 方法
- **当** BaseRunner.run() 执行
- **那么** SHALL 对每个匹配版本调用 `build_data(raw_path, i18n_collector, **extra)`
- **并且** SHALL 自动创建 output_dir 并写入返回的 JSON 文件
- **并且** SHALL 自动调用 `inject_english_names` 注入英文名
- **并且** SHALL 自动调用 `inject_locales` 注入翻译到 locale 文件

### Requirement: Shared Config Module

`scripts/x4-game/shared/config.py` SHALL 提供配置加载和版本解析的复用工具。

#### Scenario: load config

- **前提** 项目根目录存在 `x4-station-calculator.config.json`
- **当** 调用 `load_config()`
- **那么** SHALL 返回解析后的配置字典

#### Scenario: resolve target versions

- **前提** 配置包含多个版本条目
- **当** 调用 `get_target_versions(config, args)` 传入 `--version 8.0 --stable`
- **那么** SHALL 返回版本 8.0 且 beta=false 的配置条目

### Requirement: Locale Injection

`scripts/x4-game/shared/i18n.py::inject_locales()` SHALL 将收集到的 i18n nameId 注入到已有的 locale JSON 文件中。

#### Scenario: inject new nameIds

- **前提** `locale_dir` 中存在 `en.json`, `zh-CN.json` 等文件
- **前提** `new_name_ids` 包含 `{20203,801}` 等 nameId
- **前提** `raw_path/t/0001-L044.xml` 包含对应的翻译
- **当** 调用 `inject_locales(locale_dir, new_name_ids, raw_path)`
- **那么** 各语言 locale JSON SHALL 新增对应的翻译条目
- **并且** 已有条目 SHALL NOT 被覆盖
- **并且** 文件 SHALL 按键名排序写回

#### Scenario: no new entries needed

- **前提** `new_name_ids` 中的所有 nameId 已存在于 locale 文件中
- **当** 调用 `inject_locales()`
- **那么** locale 文件 SHALL NOT 被修改

### Requirement: Factions Data Module

`scripts/x4-game/factions/` SHALL 从 `factions/final.xml` 提取派系数据，包含每个派系的 licences。

#### Scenario: faction with licences

- **前提** `factions/final.xml` 中 alliance 派系有 `<licences>` 块
- **当** `build_factions_data()` 处理该文件
- **那么** alliance faction SHALL 包含 `licences` 数组
- **并且** 每个 licence 条目 SHALL 包含 `type` 和 `nameId`
- **并且** licence 的 nameId SHALL 纳入 `i18n_collector`

#### Scenario: faction without licences

- **前提** 某个 faction 没有 `<licences>` 子元素
- **当** `build_factions_data()` 处理该文件
- **那么** 该 faction 的 `licences` SHALL 为空数组 `[]`

#### Scenario: faction without name on licence

- **前提** 某个 `<licence>` 元素没有 `name` 属性（仅用于 NPC 间授权）
- **当** `build_factions_data()` 处理该元素
- **那么** 该 licence 条目 SHALL 有 `type` 但 `nameId` 为空字符串
- **并且** 空的 `nameId` SHALL NOT 纳入 `i18n_collector`

### Requirement: Blueprint Licence Display via Faction

蓝图配方页面 SHALL 通过蓝图所属派系查找对应的 licence 本地化名称。

#### Scenario: resolve licence name by faction

- **前提** 蓝图条目 `factions: ["alliance"]` 且 `licence: "capitalship"`
- **当** 蓝图配方页面渲染该蓝图
- **那么** licence 名称 SHALL 通过 alliance.licences 中匹配 type="capitalship" 的 nameId 获取 i18n 翻译

#### Scenario: fallback when faction not found

- **前提** 蓝图 `factions` 中的 faction 在 licence 数据中不存在
- **当** 蓝图配方页面渲染 licence
- **那么** SHALL 回退显示 licence 原始 ID（如 "capitalship"）
