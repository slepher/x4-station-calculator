# Refactory Map Processor Design

## Purpose

定义 `x4_data_map_processor.py` 分拆为模块化 `processor` 包的架构设计、导入关系和迁移策略。

---

## 架构概述

### 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Entry Point                          │
│                    processor.map (__init__.py)              │
│                  main(), run_for_config()                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Core Orchestrator                      │
│                processor.map.generator                      │
│                  generate_map_data()                        │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   Sector Layer   │ │  Resource Layer  │ │   Writer Layer   │
│ sector.parser    │ │ resource.*       │ │ map.writer       │
│ sector.template  │ │ - modern (9.0+)  │ │                  │
│ sector.resource  │ │ - legacy (8.0-)  │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Utility Layer                          │
│   utils.math_utils | utils.xml_utils | utils.data_utils    │
│                     utils.noise                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Infrastructure Layer                      │
│              config.py | i18n.py | versioning.py            │
└─────────────────────────────────────────────────────────────┘
```

---

## 模块导入关系

### 依赖方向规则

1. **单向依赖**：上层模块可导入下层模块，下层模块不得导入上层模块
2. **工具层无依赖**：`utils/*` 模块只能相互导入，不得导入业务层
3. **业务层隔离**：`resource/*`、`sector/*`、`map/*` 之间不直接相互导入，通过 `generator.py` 协调

### 详细导入矩阵

| 模块 | 可导入的模块 |
|------|-------------|
| `processor.map` | `processor.config`, `processor.utils.*`, `processor.resource.*`, `processor.sector.*`, `processor.map.*` |
| `processor.map.generator` | 所有 `utils/*`, `sector/*`, `resource/*`, `processor.config` |
| `processor.map.writer` | `processor.utils.*`, `processor.i18n` |
| `processor.resource.*` | `processor.utils.*`, `processor.config` |
| `processor.sector.*` | `processor.utils.*`, `processor.config` |
| `processor.utils.*` | 仅限其他 `processor.utils.*` 模块 |
| `processor.config` | `processor.i18n`, `processor.versioning` |

---

## 模块详细设计

### processor/__init__.py

```python
"""X4 Map Data Processor - Modular Package."""

from processor.i18n import get_i18n_registry
from processor.versioning import get_target_versions, load_version_config, merge_version_config
from processor.config import (
    apply_runtime_config,
    default_version_item,
    parse_args,
    resolve_runtime_paths,
    X4_UNPACKED_DATA_PATH,
    OUTPUT_VERSION_DIR,
)
from processor.map import run_for_config, main

__all__ = [
    "get_i18n_registry",
    "get_target_versions",
    "load_version_config",
    "merge_version_config",
    "apply_runtime_config",
    "default_version_item",
    "parse_args",
    "resolve_runtime_paths",
    "run_for_config",
    "main",
    "X4_UNPACKED_DATA_PATH",
    "OUTPUT_VERSION_DIR",
]
```

### processor/config.py

```python
"""运行时配置和路径管理."""

import os
from pathlib import Path
from typing import Dict, Optional

from processor.versioning import load_version_config, merge_version_config

# 全局路径变量
_config = load_version_config()

X4_UNPACKED_DATA_PATH = ""
OUTPUT_VERSION_DIR = ""
DEFAULT_MAP_DIR = ""
DEFAULT_OUTPUT = ""
DEFAULT_MAPDEFAULTS = ""
DEFAULT_GOD_XML = ""
DEFAULT_FACTIONS_XML = ""
DEFAULT_COLORS_XML = ""
DEFAULT_REGION_DEFINITIONS_XML = ""
DEFAULT_REGIONOBJECTGROUPS_XML = ""
DEFAULT_REGIONYIELDS_XML = ""
DEFAULT_FACTIONS_OUTPUT = ""
DEFAULT_REGIONS_OUTPUT = ""
DEFAULT_REGIONYIELDS_OUTPUT = ""
DEFAULT_REGIONYIELD_DEFINITIONS_OUTPUT = ""
DEFAULT_RESOURCEAREAS_OUTPUT = ""


def apply_runtime_config(effective_config: Dict[str, object]) -> None:
    """应用运行时配置到全局变量."""
    global X4_UNPACKED_DATA_PATH, OUTPUT_VERSION_DIR, DEFAULT_MAP_DIR
    # ... (复制原实现)


def default_version_item(config: Dict[str, object]) -> Dict[str, object]:
    """获取默认版本配置项."""
    # ... (复制原实现)


def parse_args() -> argparse.Namespace:
    """解析命令行参数."""
    # ... (复制原实现)


def resolve_runtime_paths(args: argparse.Namespace) -> dict:
    """解析运行时路径."""
    # ... (复制原实现)
```

### processor/utils/__init__.py

```python
"""工具函数子包."""

from processor.utils.math_utils import *
from processor.utils.xml_utils import *
from processor.utils.data_utils import *
from processor.utils.noise import *

__all__ = [
    # math_utils
    "as_float", "as_number", "round_significant", "round_to_int",
    "pos_from", "pos3d_from", "vec_add", "vec_add_3d",
    "cluster_world_to_axial", "axial_to_pixel_flat",
    "distance_3d", "unit_vec", "rgb_to_hex",
    # xml_utils
    "parse_xml", "parse_xml_group", "parse_xml_attrs",
    "parse_step_curve", "piecewise_average",
    # data_utils
    "split_tags", "parse_select_tags", "coerce_attr_value",
    "classify_density_tier", "normalize_noise_bound",
    # noise
    "PerlinNoise3D", "build_noise_cdf", "noise_probability",
]
```

### processor/resource/__init__.py

```python
"""资源处理模块."""

from processor.resource.model_detector import detect_map_resource_model
from processor.resource.modern_processor import (
    migrate_resourcearea_definitions,
    migrate_sector_resourceareas,
    build_sector_resource_summaries_from_resourceareas,
    build_resourceareas_json_payload,
)
from processor.resource.legacy_processor import (
    migrate_regionyields,
    summarize_region_resources,
    summarize_region_resources_simplified,
)

__all__ = [
    "detect_map_resource_model",
    "migrate_resourcearea_definitions",
    "migrate_sector_resourceareas",
    "build_sector_resource_summaries_from_resourceareas",
    "build_resourceareas_json_payload",
    "migrate_regionyields",
    "summarize_region_resources",
    "summarize_region_resources_simplified",
]
```

### processor/sector/__init__.py

```python
"""Sector 处理模块."""

from processor.sector.parser import (
    load_mapdefaults,
    resolve_sector_macro_from_region_connection,
    resolve_sector_macro_from_region_ref,
    zone_connection_path_to_zone_macro,
)
from processor.sector.template import (
    centered_local_positions,
    template_positions_ratio,
    best_slot_assignment,
    choose_sector_template,
    sector_radius_ratio,
)
from processor.sector.resource_summary import summarize_sector_resources

__all__ = [
    "load_mapdefaults",
    "resolve_sector_macro_from_region_connection",
    "resolve_sector_macro_from_region_ref",
    "zone_connection_path_to_zone_macro",
    "centered_local_positions",
    "template_positions_ratio",
    "best_slot_assignment",
    "choose_sector_template",
    "sector_radius_ratio",
    "summarize_sector_resources",
]
```

### processor/map/__init__.py

```python
"""Map 主处理模块 - 入口点."""

import argparse
from pathlib import Path
from typing import Dict

from processor.config import apply_runtime_config, resolve_runtime_paths
from processor.versioning import load_version_config, default_version_item
from processor.i18n import get_i18n_registry
from processor.resource.model_detector import detect_map_resource_model
from processor.resource.modern_processor import (
    migrate_resourcearea_definitions,
    migrate_sector_resourceareas,
)
from processor.resource.legacy_processor import migrate_regionyields
from processor.map.generator import generate_map_data
from processor.map.writer import write_map_output, migrate_factions


def run_for_config(args: argparse.Namespace, effective_config: Dict[str, object]) -> None:
    """运行指定配置的处理流程."""
    # ... (复制原实现，调用新模块)


def main() -> None:
    """CLI 入口点."""
    # ... (复制原实现)


if __name__ == "__main__":
    main()
```

---

## 迁移策略

### 阶段 1：基础结构搭建 (Day 1)

**目标**：创建目录结构和基础模块

1. 创建目录结构
   ```bash
   mkdir -p scripts/processor/{utils,resource,sector,map}
   touch scripts/processor/{utils,resource,sector,map}/__init__.py
   ```

2. 迁移工具函数
   - `utils/math_utils.py` - 14 个函数
   - `utils/xml_utils.py` - 5 个函数
   - `utils/data_utils.py` - 8 个函数
   - `utils/noise.py` - 1 个类 + 2 个函数

3. 迁移配置模块
   - `config.py` - 全局变量 + 4 个函数

**验证**：`python -c "from processor.utils import *"` 无错误

---

### 阶段 2：资源模块迁移 (Day 2)

**目标**：完成资源处理模块分拆

1. `resource/model_detector.py` - 1 个函数
2. `resource/modern_processor.py` - 5 个函数 (9.0+)
3. `resource/legacy_processor.py` - 12 个函数 (8.0-)

**验证**：对比新旧模块输出
```bash
python scripts/x4_data_map_processor.py --version 8.0 --output /tmp/old_regions.json
python scripts/processor/map --version 8.0 --output /tmp/new_regions.json
diff /tmp/old_regions.json /tmp/new_regions.json
```

---

### 阶段 3：Sector 模块迁移 (Day 3)

**目标**：完成 Sector 处理模块分拆

1. `sector/parser.py` - 4 个函数
2. `sector/template.py` - 5 个函数
3. `sector/resource_summary.py` - 1 个函数

**验证**：单元测试验证模板计算正确性

---

### 阶段 4：Map 主模块迁移 (Day 4)

**目标**：完成核心处理流程分拆

1. `map/writer.py` - 输出写入相关函数
2. `map/generator.py` - `generate_map_data` 核心函数
3. `map/__init__.py` - 入口点

**验证**：完整流程测试

---

### 阶段 5：整合验证 (Day 5)

**目标**：确保新旧输出完全一致

1. 运行原处理器，保存输出基准
2. 运行新处理器，对比输出
3. 修复任何差异

---

## 关键设计决策

### 决策 1：保留原文件

**选择**：保留 `x4_data_map_processor.py` 不删除

**理由**：
- 提供对比基准
- 便于回滚
- Git 历史完整

**代价**：代码重复，但为临时状态

---

### 决策 2：复制而非重构

**选择**：函数实现原样复制，不修改逻辑

**理由**：
- 保证输出一致性
- 降低分拆风险
- 便于验证

**后续**：可在分拆完成后单独进行代码优化

---

### 决策 3：分层架构

**选择**：工具层 → 业务层 → 入口层

**理由**：
- 清晰的依赖方向
- 便于测试
- 符合单一职责

---

### 决策 4：显式导出

**选择**：每个 `__init__.py` 使用 `__all__` 明确导出列表

**理由**：
- 避免 `import *` 污染命名空间
- 清晰的公共 API
- 便于 IDE 自动完成

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 导入循环 | 高 | 严格遵守分层依赖规则，工具层不导入业务层 |
| 输出不一致 | 高 | 每阶段进行 diff 验证 |
| 路径解析错误 | 中 | 保留原路径逻辑，仅调整 import |
| Git 历史丢失 | 低 | 使用 `git mv` 保留历史 |

---

## 验收标准

1. [ ] 新模块可执行：`python scripts/processor/map --version 8.0` 成功
2. [ ] 输出一致性：新旧处理器输出 diff 为空
3. [ ] 无导入错误：所有模块可正常导入
4. [ ] 原文件保留：`x4_data_map_processor.py` 未被修改
