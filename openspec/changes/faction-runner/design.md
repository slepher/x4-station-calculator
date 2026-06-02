# design.md — faction-runner

## 架构

### 共享模块

```
scripts/x4-game/shared/
├── __init__.py
├── config.py      # 配置加载 + 版本解析
├── i18n.py        # 英文名注入 + locale 注入
└── runner.py      # BaseRunner 抽象类
```

### 新 factions 模块

```
scripts/x4-game/factions/
├── __init__.py
├── build.py       # build_factions_data() + process_factions()
├── run.py         # FactionsRunner (继承 BaseRunner)
└── converter.py   # migrate_factions() — 从 processor/converter.py 迁移
```

### 改造后的 run.py

```
blueprints/run.py   →  BlueprintsRunner(BaseRunner)   ~15 行
research/run.py     →  ResearchRunner(BaseRunner)     ~15 行
terraforming/run.py →  TerraformingRunner(BaseRunner) ~15 行
factions/run.py     →  FactionsRunner(BaseRunner)     ~15 行
```

## 关键决策

### 1. BaseRunner 抽象设计

```python
class BaseRunner:
    name: str                          # 子类覆盖
    output_dir_key: str | None = None  # 子类覆盖，用于 config 中查找输出路径

    def build_data(
        self, raw_path: str, i18n_collector: set, **extra
    ) -> dict[str, Any]:
        """子类实现。返回 {文件名: 数据} 字典。"""
        raise NotImplementedError

    def get_extra_args(self, effective: dict) -> dict:
        """子类可覆盖，返回 build_data 需要的额外参数。"""
        return {}

    def run(self):
        # 统一 CLI、版本循环、i18n 注入、文件写入
        ...
```

- `i18n_collector` 在 `build_data` 调用中由子类填充
- BaseRunner 负责在 `build_data` 之后调用 `inject_english_names` 和 `inject_locales`
- 返回 dict 的 key 为文件名（如 `"blueprints.json"`），value 为数据对象

### 2. inject_english_names 通用化

三份 run.py 各有不同的注入逻辑（key 名、遍历方式不同）。通用方案：

```python
def inject_english_names(
    data: Any,
    en_map: dict,
    specs: list[tuple[str, str]]   # [(nameId_key, name_key), ...]
) -> int:
```

- `specs` 默认为 `[("nameId", "name")]`
- 递归遍历 data（list/dict/object），对每个条目按 specs 替换
- 返回成功注入数量

但为简化，直接递归遍历 dict，匹配 `nameId`/`descriptionId` 等后缀：

```python
def inject_english_names(data: Any, en_map: dict) -> int:
    """递归遍历，对每个 dict 中 nameId→name, descriptionId→description 等字段注入英文。"""
```

### 3. inject_locales 实现

复用现有 `scripts/processor/i18n.py::I18nRegistry`：

```python
def inject_locales(locale_dir: str, new_name_ids: set[str], raw_path: str) -> dict[str, int]:
    registry = I18nRegistry(...)
    registry.collect_many(new_name_ids)
    counts = {}
    for lang in SUPPORTED_LANGUAGES:
        new_entries = registry.export_collected(lang)
        if new_entries:
            locale_path = os.path.join(locale_dir, f"{lang}.json")
            existing = json.load(open(locale_path)) if exists else {}
            # 不覆盖已有 key
            to_add = {k: v for k, v in new_entries.items() if k not in existing}
            merged = {**existing, **to_add}
            json.dump(sorted(merged), ...)
            counts[lang] = len(to_add)
    return counts
```

`SUPPORTED_LANGUAGES` 从 `processor/config.py` 或 `X4_LANG_CONFIG` 获取。

### 4. factions/converter.py 的迁移

从 `processor/step1_map/converter.py::migrate_factions()` 完整迁移逻辑，并增强：

```python
def migrate_factions(
    factions_xml_path: Path,
    colors_xml_path: Path,
    i18n_collector: set | None = None,
) -> tuple[list[dict], dict[str, dict]]:
    # 原有逻辑: 提取 faction 元数据
    # 新增: 提取 <licences> 块
    for licence_elem in licences_block.findall("licence"):
        ltype = licence_elem.get("type", "")
        name_id = licence_elem.get("name", "")
        licence_entry = {"type": ltype, "nameId": name_id, "name": ""}
        if i18n_collector is not None and name_id:
            i18n_collector.add(name_id)
        faction_licences.append(licence_entry)
```

数据类型：

```python
@dataclass
class FactionsData:
    factions: list
    licences: list  # 兼容旧版结构，保留全局 licence 列表用于快速查找
```

### 5. 对 processor 的影响

两处 `migrate_factions()` 副本移除：
- `processor/step1_map/converter.py` — 删除 `migrate_factions()`，`service.py` 改为 `from x4_game.factions.converter import migrate_factions`
- `processor/map/converter.py` — 同上

`factions.json` 路径不变，仍输出到 `src/assets/x4_game_data/<version>/data/factions.json`。

### 6. 前端类型变更

`src/types/x4.ts` 中 `X4Faction` 增加：

```typescript
export interface X4FactionLicence {
  type: string
  name: string
  nameId: string
}

export interface X4Faction {
  // ...existing
  licences?: X4FactionLicence[]
}
```

`BlueprintRecipeWorkbench.vue` 的 licence 查找逻辑：

```
blueprint.factions[0] → faction 对象 → faction.licences
  → 匹配 licence type → nameId → i18n 翻译
  无匹配 → 回退显示原始 licence ID
```

### 7. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `scripts/x4-game/shared/__init__.py` | **新建** | 空文件 |
| `scripts/x4-game/shared/config.py` | **新建** | 配置工具 |
| `scripts/x4-game/shared/i18n.py` | **新建** | i18n 注入 |
| `scripts/x4-game/shared/runner.py` | **新建** | BaseRunner |
| `scripts/x4-game/factions/__init__.py` | **新建** | 空文件 |
| `scripts/x4-game/factions/build.py` | **新建** | build_factions_data + process_factions |
| `scripts/x4-game/factions/run.py` | **新建** | FactionsRunner |
| `scripts/x4-game/factions/converter.py` | **新建** | migrate_factions (从 processor 迁移) |
| `scripts/x4-game/blueprints/run.py` | 修改 | 简化为继承 BaseRunner |
| `scripts/x4-game/research/run.py` | 修改 | 简化为继承 BaseRunner |
| `scripts/x4-game/terraforming/run.py` | 修改 | 简化为继承 BaseRunner |
| `scripts/processor/step1_map/converter.py` | 修改 | 删除 migrate_factions |
| `scripts/processor/map/converter.py` | 修改 | 删除 migrate_factions |
| `scripts/processor/step1_map/service.py` | 修改 | import 新路径 |
| `scripts/processor/map/service.py` | 修改 | import 新路径 |
| `src/types/x4.ts` | 修改 | X4Faction 增加 licences |
| `analysis/tmp_scripts/generate_licences.py` | 删除 | 被正式模块替代 |
| `analysis/tmp_scripts/generate_licences_9.py` | 删除 | 被正式模块替代 |
| `analysis/tmp_scripts/check_licence_variants.py` | 删除 | 一次性分析脚本 |
