# LiveStationToolbar 修改需求

## 目标

修改 LiveStationToolbar 的界面结构和功能，支持实时/规划模式切换，并根据存档数据来源展示只读字段。

## 已确认方案（审核重点）

### 1. 界面结构变更

修改后布局：

```
[名称(可编辑)] [编码(只读)] [实时/规划 切换按钮(toggle-chip)] | [星区(点击弹出坐标)] [星区资源(只读)] [光伏效率(百分比)] [单位吞吐量(只读)] | [偏好种族] [工人运算] [显示缺口] ← 仅规划模式显示
```

字段行为矩阵：

| 字段 | 实时模式 | 规划模式 |
|-----|---------|---------|
| 名称 | 可编辑 | 可编辑 |
| 编码 | 只读显示 | 只读显示 |
| 模式切换 | toggle-chip 样式，只显示当前模式 | toggle-chip 样式，只显示当前模式 |
| 星区 | 只读，点击弹出坐标 popover | 只读，点击弹出坐标 popover |
| 星区资源 | 只读（popover 展示列表） | 只读 |
| 光伏效率 | 只读（百分比显示，原始值×100） | 只读 |
| 单位吞吐量 | 只读 | 只读 |
| 偏好种族 | 隐藏 | 显示并可编辑 |
| 工人运算 | 隐藏 | 显示并可切换 |
| 显示缺口 | 隐藏 | 显示并可切换 |

### 2. 模式切换逻辑

| 数据状态 | 初始模式 | 切换按钮状态 |
|---------|---------|-------------|
| 存在 bindingStation + saveStation | 规划模式 | 可切换 |
| 存在 bindingStation 不存在 saveStation | 规划模式 | 禁用切换（仅规划） |
| 存在 saveStation 不存在 bindingStation | 实时模式 | 可切换 |

### 3. 数据来源映射

| 字段 | 数据来源 |
|-----|---------|
| 编码 | 存档 station 的 `code` 字段（如 `FIX-154`） |
| 星区名称 | station 所在 `sectorMacro` 对应的 map sector 的 `name`，支持 i18n（通过 `nameId`） |
| 星区坐标 | 存档 station 的 `relative_position` 字段 `{x, y, z}` |
| 星区资源 | station 所在 `sectorMacro` 对应的 map sector 的 `resources` |
| 光伏效率 | station 所在 `sectorMacro` 对应的 map sector 的 `sunlight` 值 × 100（如 0.13 → 13%） |

### 4. 删除字段

- 站点类型 (station type) - 移除
- 站点数量 (station count) - 移除
- 运输时间 (transport time) - 移除

### 5. liveData popover

暂不实现，保留为后续功能。当前 toolbar 不展示 liveData popover。

## 边界

### In Scope

- LiveStationToolbar UI 结构变更
- 实时/规划模式切换按钮及状态逻辑
- 编码、星区资源、光伏效率的只读展示
- 规划模式下偏好种族、工人运算、显示缺口的显示和编辑

### Out of Scope

- liveData popover 内容实现（站点储量、在途资源、在建模块）
- 内容区域随模式变化的展示逻辑
- saveStation 数据的完整接入逻辑
- 站点类型、站点数量、运输时间字段的处理（后续方案）

## 验收标准（DoD）

1. Toolbar 布局符合新结构：名称 + 编码 + 切换按钮 | 星区 + 星区资源 + 光伏效率 + 单位吞吐量 | 规划专属字段
2. 模式切换按钮使用 toggle-chip 样式，只显示当前模式（实时/规划），不可切换时不显示禁止图标
3. 编码字段正确展示存档 station 的 code
4. 星区字段显示星区名称（支持 i18n），点击弹出坐标 popover
5. 星区资源 popover 展示存档 sector 的 resources 列表（只读，无 checkbox）
6. 光伏效率展示存档 sector 的 sunlight 值 × 100（百分比格式）
7. 规划模式下偏好种族、工人运算、显示缺口正常显示并可编辑
8. 实时模式下偏好种族、工人运算、显示缺口隐藏
9. 切换按钮点击可正确切换模式状态
10. TypeScript 编译无错误
11. `npm run build` 成功
12. E2E 测试通过

## 未决项

无