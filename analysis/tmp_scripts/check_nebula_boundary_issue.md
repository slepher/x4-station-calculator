# regions.json 缺失 boundary 问题背景

## 问题描述
生成的 `regions.json` 文件中，nebula region 没有包含 `boundary` 字段，导致后续无法正确计算气体资源。

## 背景

### 数据流
1. **maps.json** - 原始游戏地图数据，包含 nebula 的 position 和 boundary
2. **regions.json** - 提取的 region 模板数据（应包含 boundary）
3. **resourceareas.json** - 实例计算结果（使用 boundary 进行计算）

### 当前状态
- `maps.json` 中的 nebula 数据包含完整的 `boundary` 字段：
  ```json
  {
    "class": "cylinder",
    "size": {"r": 300000, "linear": 30000}
  }
  ```

- 但生成的 `regions.json` 中 nebula region 缺失 `boundary` 字段

### 影响
没有 `boundary` 字段，气体资源计算无法进行：
- 无法判断 cylinder 的半径 (r) 和高度 (linear)
- 无法计算命中的方块数量
- resourceareas.json 的 blocks/total_blocks 字段无法正确生成

## 需要检查的代码位置

### scripts/x4_data_map_processor.py
1. **regions.json 生成逻辑** - 查找 `build_regions_json()` 或类似函数
2. **nebula region 处理** - 检查 nebula 数据提取时是否遗漏了 boundary
3. **region 字段映射** - 确认 boundary 是否被故意过滤或无意中丢失

### 可能的原因
1. boundary 字段在提取时被错误地过滤掉
2. nebula 数据转换时没有正确复制 boundary
3. 代码中存在针对 nebula 的特殊处理逻辑，遗漏了 boundary

## 验证方法
```bash
# 检查生成的 regions.json
grep -A5 "boundary" src/assets/x4_game_data/8.0-Diplomacy/data/regions.json | head -20

# 检查 maps.json 中的 nebula boundary
python3 analysis/tmp_scripts/check_nebula_boundary_data.py
```

## 预期修复
确保 `regions.json` 中的每个 nebula region 都包含完整的 `boundary` 字段：
```json
{
  "id": "nebula_xxx",
  "type": "nebula",
  "position": {"x": 0, "y": -20000, "z": 0},
  "boundary": {
    "class": "cylinder",
    "size": {"r": 300000, "linear": 30000}
  },
  ...
}
```
