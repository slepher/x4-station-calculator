# tasks.md — research-data

## 实施任务

### 1. 创建模块目录

- 创建 `scripts/x4-game/research/__init__.py`
- 创建 `scripts/x4-game/research/build.py`
- 创建 `scripts/x4-game/research/run.py`

### 2. 实现 parse_wares + nameId 解析 (build.py)

- 第一遍: 构建 `ware_nameid_map`（所有 ware id → nameId）
- 第二遍: 解析 wares/final.xml，筛选 `transport="research"` 的 `<ware>`
- 提取: id, nameId, descriptionId, tags, research time, primary cost, dependencies
- build_research_data() 接收 raw_path, ware_dlc_tags, i18n_collector

### 3. 实现分类逻辑

- DEFAULT_SET 硬编码 30 个 ID
- `_classify(ware_id, tags)`:
  - ware_id in DEFAULT_SET → `"default"`
  - `"hidden"` without `"missiononly"` → `"abandoned"`
  - `"missiononly"` → `"mission_progress"`
  - else → `"conditional"`

### 4. 实现 unlock 条件映射

- UNLOCK_MAP 硬编码 15 个 conditional 项的 key 和 raw params
- SECTOR_NAMEIDS 硬编码 7 个 sector macro → nameId 映射
- 解析时: 遍历 raw_params → 将 shipWareId/itemWareId 查找 `ware_nameid_map` → 添加 `shipNameId/itemNameId`
- 将 sectorMacro 查找 SECTOR_NAMEIDS → 添加 `sectorNameId`
- npcNameId 直接使用
- 所有 nameId 加入 `i18n_collector`

### 5. 实现 process_research(loader) 入口

- 接收 loader 实例
- 调用 build_research_data()
- 挂载 `loader.research_data`（含 items 数组）

### 6. 集成到 x4_data_processor.py

- 添加 `_get_process_research()` 动态导入
- `run_for_config()` 中 terraforming 之后调用
- `save()` 中写入 `research.json`
- `inject_english_names()` 中处理 research nameId/descriptionId

### 7. 构建验证

- 执行 `npm run build` 确认编译通过
- 确认 `research.json` 输出 57 个条目，含 nameId/descriptionId 和 unlock nameId

### 8. Standalone (run.py)

- 仿照 terraforming/run.py 实现独立运行入口
- 支持 `--version`, `--beta`, `--stable` 参数
- 注入英文名并输出 research.json
