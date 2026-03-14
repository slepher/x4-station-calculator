# Request: Game Version Switch

## Summary

实现游戏版本切换功能，支持多版本数据隔离和动态加载。

## Background

当前项目硬编码使用 `8.0-Diplomacy` 版本数据，无法支持：
- 新版本（如 9.0 Empire beta）的切换
- 不同版本的数据隔离（localStorage keys 固定）
- 用户自定义选择游戏版本

## Goals

1. **版本配置管理** - 通过 `versions.json` 管理多版本配置
2. **数据隔离** - 不同版本使用不同的 localStorage keys
3. **动态加载** - 根据版本动态加载对应游戏数据
4. **用户设置** - 提供 UI 让用户选择游戏版本

## Requirements

### 1. versions.json 结构

位置: `src/assets/versions.json`

```json
{
  "current_version": "8.0",
  "beta": false,
  "versions": [
    {
      "version": "8.0",
      "beta": false,
      "codename": "Diplomacy",
      "folder_name": "8.0-Diplomacy",
      "storage_keys": {
        "empire": "x4_empire_data",
        "logic_flow": "x4_logic_flow_plans",
        "ship_blueprints": "x4_ship_blueprints"
      }
    },
    {
      "version": "9.0",
      "beta": true,
      "codename": "Empire",
      "folder_name": "9.0-Empire-beta",
      "storage_keys": {
        "empire": "x4_empire_data_v9_beta",
        "logic_flow": "x4_logic_flow_plans_v9_beta",
        "ship_blueprints": "x4_ship_blueprints_v9_beta"
      }
    }
  ]
}
```

### 2. Storage Key 命名规则

- **8.0 stable**: 无后缀（保持兼容）
- **其他 stable**: `_v{major_version}` 后缀
- **Beta 版本**: `_v{major_version}_beta` 后缀

### 3. 版本确定逻辑

```
读取 localStorage['x4_game_version']
    ↓
存在? → 使用其中的 {version, beta}
    ↓
不存在? → 使用 versions.json 中的 {current_version, beta}
```

### 4. x4_game_version 结构

```json
{
  "version": "9.0",
  "beta": true
}
```

### 5. 动态数据加载

- `useGameData.ts` 移除静态 import
- 根据版本 `folder_name` 动态加载游戏数据
- Store 初始化时读取版本配置

### 6. UI 需求

**Toolbar 设置按钮**
- 位置：语言栏右边
- 图标：齿轮图标
- 红点提示：`x4_game_version` 不存在时显示

**设置弹窗**
- 下拉框：`{version}-{codename}` 格式，beta 显示 `(beta)`
- 保存按钮：写入 `x4_game_version`

## Non-Goals

- 自动检测可用版本目录
- 版本数据迁移
- 多语言版本名称

## Success Criteria

1. 用户可通过设置按钮切换游戏版本
2. 不同版本的数据存储在独立的 localStorage keys
3. 切换版本后重新加载数据无需刷新页面
4. 8.0 stable 用户无感知（保持现有 storage keys）