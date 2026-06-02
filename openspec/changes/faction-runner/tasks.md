# tasks.md — faction-runner

## 实施任务

### 1. 共享模块：config.py

- [x] 创建 `scripts/x4-game/shared/__init__.py`
- [x] 创建 `scripts/x4-game/shared/config.py`
  - 从各 run.py 提取 `_load_config()`, `_get_target_versions()`, `_merge_config()`
  - 统一函数签名：接受 Config 类和 args namespace

### 2. 共享模块：i18n.py

- [x] 创建 `scripts/x4-game/shared/i18n.py`
  - `inject_english_names(data, en_map)` — 通用递归遍历注入
  - `inject_locales(locale_dir, new_name_ids, raw_path)` — locale 文件注入
  - 使用 `scripts/processor/i18n.py::I18nRegistry` 解析 raw XML

### 3. 共享模块：runner.py

- [x] 创建 `scripts/x4-game/shared/runner.py`
  - `BaseRunner` 抽象类
  - 统一 CLI argparse
  - 统一版本循环 + output_dir
  - 统一 inject_english_names + inject_locales 调用
  - 子类实现 `build_data(raw_path, i18n_collector, **extra) → dict`

### 4. 改造 blueprints/run.py

- [x] 创建 `BlueprintsRunner(BaseRunner)`
- [x] 实现 `build_data()` 调用 `build_blueprints_data()`
- [x] 保留 `blueprints.json` + `classes` + `types` 特殊注入逻辑（多 section 注入英文名）
- [x] 删除旧 `_load_config`, `_get_target_versions`, `_merge_config`, `_inject_english_names`, `main`

### 5. 改造 research/run.py

- [x] 创建 `ResearchRunner(BaseRunner)`
- [x] 实现 `build_data()` 调用 `build_research_data()`
- [x] 实现 `get_extra_args()` 返回 `ware_dlc_tags`
- [x] 保留 `{nameId→name, descriptionId→description}` 双字段注入逻辑
- [x] 删除重复函数

### 6. 改造 terraforming/run.py

- [x] 创建 `TerraformingRunner(BaseRunner)`
- [x] 实现 `build_data()` 调用 `build_terraforming_data()`
- [x] 保留 wares 数据加载 `_load_ship_ware_data()`
- [x] 保留多 section (stats, projectGroups, projects, deliveryShips, ranges) 注入

### 7. 新建 factions 模块

- [x] 创建 `scripts/x4-game/factions/__init__.py`
- [x] 创建 `scripts/x4-game/factions/converter.py`
  - 从 `processor/step1_map/converter.py` 迁移 `migrate_factions()`
  - 增强：解析 `<licences>` 块，提取 `{type, nameId}` 对
  - i18n_collector 收集 licence nameId
- [x] 创建 `scripts/x4-game/factions/build.py`
  - `build_factions_data(raw_path, i18n_collector)` → `{factions: [...], licences: [...]}`
  - `process_factions(loader)` — data_processor 集成接口
- [x] 创建 `scripts/x4-game/factions/run.py`
  - `FactionsRunner(BaseRunner)`, name="Factions"

### 8. 清理 processor 中的 migrate_factions

- [x] `processor/step1_map/converter.py` — 删除 `migrate_factions()` 函数
- [x] `processor/map/converter.py` — 删除 `migrate_factions()` 函数
- [x] `processor/step1_map/service.py` — `from scripts.x4_game.factions.converter import migrate_factions`
- [x] `processor/map/service.py` — `from scripts.x4_game.factions.converter import migrate_factions`

### 9. 前端类型适配

- [x] `src/types/x4.ts` 中 `X4Faction` 增加 `licences?: X4FactionLicence[]`
- [x] `useBlueprintRecipePresenter` 增加 `factionById` computed，用于 licence 名称解析
- [x] 蓝图配方页面 licence 展示改为通过 faction 查找 nameId 再做 i18n

### 10. 清理临时脚本

- [x] 删除 `analysis/tmp_scripts/generate_licences.py`
- [x] 删除 `analysis/tmp_scripts/generate_licences_9.py`
- [x] 删除 `analysis/tmp_scripts/check_licence_variants.py`

### 11. 构建验证

- [x] 执行 `npm run build` 确认编译通过
- [x] 修复构建中的 TypeScript 错误，迭代直到通过
