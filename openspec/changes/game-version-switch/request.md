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

**Toolbar 版本切换按钮**
- 位置：导出按钮右边
- 风格：与导出按钮保持同一套 `btn-tool` 风格，使用黑色底色
- 功能：点击打开版本切换弹窗
- 红点提示：`x4_game_version` 不存在时显示在版本切换按钮上
- 原 `SettingsButton` 组件暂时从工具栏隐藏，并取消与版本切换入口的直接关联，但组件与逻辑不删除，保留后续复用空间

**设置弹窗**
- 下拉框：`{version}-{codename}` 格式，beta 显示 `(beta)`
- 若所选目标版本与当前生效版本（`version + beta`）实质相同，且 `x4_game_version` 尚未写入 localStorage，则本次操作仅将当前版本写入 `x4_game_version`，不保存 dirty 模块，也不触发页面重载
- 若所选目标版本与当前生效版本实质相同，且 `x4_game_version` 已存在且内容相同，则“切换”按钮直接置灰，不允许执行无效切换
- 当 `empire`、`logic_flow`、`ship_blueprints` 存在 `isDirty` 时，显示“未保存的模块”区域
- 未保存模块区域仅列出当前 dirty 模块，默认均不勾选
- 提供“全选”复选框，一键勾选/取消所有 dirty 模块
- 未保存模块勾选区域使用红框强调，提醒用户这是切换前会被保存的范围
- 对每个被勾选且处于 `isNew` 状态的模块，显示单独的名称输入框，并预填该模块默认名称
- 若未勾选任何模块，按钮为：`取消`、`切换`
- 若勾选了至少一个模块，按钮为：`取消`、`保存并切换`
- `保存并切换` 仅保存被勾选模块；未勾选模块视为忽略其未保存改动
- dirty 模块保存流仅在目标版本与当前版本实质不同的真实切换场景下生效
- 所有新增标题、提示、模块名称、按钮与输入框文案都必须做 i18n

## Non-Goals

- 自动检测可用版本目录
- 版本数据迁移
- 多语言版本名称

## Success Criteria

1. 用户可通过导出右侧的版本切换按钮切换游戏版本
2. 不同版本的数据存储在独立的 localStorage keys
3. 切换版本后重新加载数据无需刷新页面
4. 8.0 stable 用户无感知（保持现有 storage keys）
5. 切换前可选择性保存 dirty 模块，新建模块可在弹窗中补全默认名称后保存
6. 使用默认配置版本但尚未写入 `x4_game_version` 时，允许用户通过“切换”仅确认当前版本写库，且不触发 reload
