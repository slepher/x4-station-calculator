# request.md — faction-runner

## 目标

1. 将 `blueprints/run.py`、`research/run.py`、`terraforming/run.py` 三份 `run.py` 中重复的代码提取为共享模块 `scripts/x4-game/shared/`
2. 新增功能：独立脚本能将收集到的 i18n nameId 注入到已生成的 `locales/*.json` 文件中
3. 新增 `scripts/x4-game/factions/` 模块，从 `factions/final.xml` 提取派系数据（含 `<licences>`），类型 `factions.json`

## 已确认方案（审核重点）

### 1. 共享模块 `scripts/x4-game/shared/`

```
scripts/x4-game/shared/
├── __init__.py
├── config.py      # load_config(), get_target_versions(), merge_config()
├── i18n.py        # inject_english_names(), inject_locales()
└── runner.py      # BaseRunner 抽象类 → 统一 CLI + 版本循环
```

#### 1.1 `config.py`

- `load_config()` → 读取 `x4-station-calculator.config.json`
- `get_target_versions(config, args)` → 解析 CLI args，返回版本列表
- `merge_config(base, version_item)` → 合并 version 特定覆盖

#### 1.2 `i18n.py`

- `inject_english_names(items, en_map, spec)` → 通用注入，接受字段映射 spec（`["nameId→name", "descriptionId→description"]`）
- `inject_locales(locale_dir, new_name_ids, raw_path)` → 新功能，将 new_name_ids 的翻译注入到已有的 locale JSON 文件中

`inject_locales` 实现思路：
1. `i18n_collector` 在 `build_data()` 中收集新的 nameId（现有模式）
2. `inject_locales()` 使用项目已有的 `scripts/processor/i18n.py::I18nRegistry` 解析 `raw_path/t/0001-L{xx}.xml`，提取翻译
3. 读取 `locale_dir/{lang}.json`，合并不覆盖已有 key，排序写回

#### 1.3 `runner.py`

`BaseRunner` 抽象类提供：
- 统一 CLI 骨架（`--version`, `--beta`, `--stable`, `--all-versions`）
- 统一版本迭代循环
- 统一 output_dir 创建
- 统一 `inject_english_names` 调用
- 统一 `inject_locales` 调用

子类只需实现 `build_data(raw_path, i18n_collector) → dict[str, data]`。

### 2. `factions` 新模块

```
scripts/x4-game/factions/
├── __init__.py
├── build.py      # build_factions_data(raw_path, i18n_collector) → {factions, licences}
├── run.py        # ~15 行，继承 BaseRunner
└── converter.py  # migrate_factions() — 从 processor/converter.py 提取
```

#### 2.1 数据来源

`x4raw_assets/<version>/libraries/factions/final.xml`

#### 2.2 输出 `factions.json`

```json
{
  "factions": [
    {
      "id": "alliance",
      "name": "Alliance of the Word",
      "nameId": "{20203,801}",
      "tags": ["economic", "standard"],
      "color_name": "faction_alliance",
      "color": "#660066",
      "claimspace": false,
      "licences": [
        { "type": "generaluseequipment", "nameId": "{1001,61}", "name": "" },
        { "type": "capitalship", "nameId": "{20207,3111}", "name": "" }
      ]
    }
  ]
}
```

#### 2.3 处理逻辑

- `build_factions_data(raw_path, i18n_collector)` 调用 `migrate_factions()`
- `migrate_factions()` 从现有 `processor/step1_map/converter.py` 提取，额外解析 `<licences>` 块
- 每个 faction 的 `licences` 数组为其专属的 `{type, nameId}` 对，不去重
- licence 的 nameId 纳入 `i18n_collector`

#### 2.4 流水线顺序

`x4_data_processor` 中 factions 处理位于 map 之前：

```
process_blueprints → process_research → process_factions → ... → map processor
```

### 3. 现有代码改造

三份 `run.py` 简化为继承 `BaseRunner`：

```python
class TerraformingRunner(BaseRunner):
    name = "terraforming"
    output_dir_key = "terraforming"

    def build_data(self, raw_path, i18n_collector, **kwargs):
        ...
        return {"terraforming.json": data}

if __name__ == "__main__":
    TerraformingRunner().run()
```

### 4. 对 `processor/converter.py` 的影响

- `migrate_factions()` 从 `processor/step1_map/converter.py` 和 `processor/map/converter.py` 中移除
- 两处 `service.py` 改为 `from x4_game.factions.converter import migrate_factions`
- `factions.json` 由 `x4_data_processor.py` 统一生成

### 5. 对前端的影响

- `X4Faction` 类型增加 `licences?: X4Licence[]`
- `useBlueprintRecipePresenter` 中 licence 名称查找改为：根据 `bp.factions[0]` 查找对应 faction 的 `licences` 数组，匹配 licence type 获取 nameId

## 边界

### In Scope

- 创建 `scripts/x4-game/shared/`（config.py, i18n.py, runner.py）
- 创建 `scripts/x4-game/factions/`（build.py, run.py, converter.py, `__init__.py`）
- 三份 run.py 简化为继承 BaseRunner
- `inject_locales()` 功能：将独立脚本收集的 i18n 注入到 locales JSON
- `processor/converter.py` 两份 migrate_factions 移除，改为 import 新模块
- 前端类型 + presenter 适配 licence 展示（faction 专属 nameId）
- `importlib.import_module("scripts.x4-game.xxx")` 模式处理连字符目录名
- `factions.json` 平铺格式保持，每 faction 增加 `licences` 数组

### Out of Scope

- `x4_data_processor.py` 流程改造（另开 change）
- 测试代码

## 验收标准（DoD）

1. 三份 run.py 可独立运行并生成数据
2. `inject_locales()` 可将新 nameId 正确注入到各语言 locale JSON
3. `factions/run.py` 可独立运行生成 `factions.json`
4. `factions.json` 每个 faction 包含 `licences` 数组
5. 蓝图配方页面展示 licence 时使用本地化名称
6. `npm run build` 成功

## 未决项

无
