# Ship Items Specification

## Purpose

为飞船配装界面增加物品存储配置功能，支持可部署、诱导弹、无人机、导弹四种类型的物品数量。

## ADDED Requirements

### Requirement: 飞船物品存储配置

**前提**
- 用户已选择一艘飞船
- 飞船具有 storage 配置（deployable, countermeasure, unit）

**当**
- 用户打开飞船配装面板

**那么**
- 显示两个配装槽位标签页：
  1. C 槽（可部署 + 诱导弹）
  2. U 槽（无人机 + 导弹）

#### Scenario: C 槽 - 可部署 + 诱导弹

**前提**
- 用户选中"C 槽"标签

**当**
- 界面加载时

**那么**
- 显示可部署物品列表（consumables.json 中 deployable=true）
- 显示诱导弹物品列表（consumables.json 中 class="countermeasure"）
- 使用 X4DualPhaseRangeSlider 显示物品数量

**当**
- 用户调整可部署物品的拖动条

**那么**
- 该物品数量更新
- 可部署总量不能超过 ship.storage.deployable
- 使用 dragMax 限制单个物品的最大拖动值

**当**
- 用户调整诱导弹的拖动条

**那么**
- 诱导弹数量更新
- 不能超过 ship.storage.countermeasure 上限

#### Scenario: U 槽 - 无人机 + 导弹

**前提**
- 用户选中"U 槽"标签

**当**
- 界面加载时

**那么**
- 显示无人机列表（drones.json，显示前3个）
- 显示导弹列表（missiles.json，显示前3个）
- 显示各物品的拖动条

**当**
- 用户调整无人机物品的拖动条

**那么**
- 该无人机物品数量更新
- 无人机总量不能超过 ship.storage.unit 上限
- 使用 dragMax 限制单个物品的最大拖动值

**当**
- 用户调整导弹的拖动条

**那么**
- 导弹数量更新
- 不能超过固定上限 20

#### Scenario: 数据持久化

**当**
- 用户配置完物品数量

**那么**
- 数据保存到 ShipBlueprint 的 storage 字段
- 重新加载后数据恢复

**当**
- 用户点击"另存为"

**那么**
- 新 blueprint 保留原 storage 数据

### Requirement: UI 布局规范

**当**
- 渲染物品配置区域

**那么**
- 每个物品项使用以下布局：
  - 第一行：左侧物品名称，右侧 "当前数量/最大容量"
  - 第二行：X4DualPhaseRangeSlider 拖动条
- storage-section 只保留圆角，无背景/边框/内边距
- 物品名称需要翻译为本地化文本

### Requirement: 槽位标签 Tooltip

**当**
- 用户鼠标悬停在槽位标签上（E、R、S、W、T、C、U）

**那么**
- 显示 tooltip，内容为槽位属性说明
- tooltip 向右弹出
- E：引擎 (Engine)
- R：推进器 (Thruster)
- S：护盾 (Shield)
- W：武器 (Weapon)
- T：炮塔 (Turret)
- C：可部署 + 诱导弹 (Consumables)
- U：无人机 + 导弹 (Units)

### Requirement: 双阶段拖动条

**当**
- 用户拖动有总量限制的物品数量

**那么**
- 绿色填充表示已使用（0 到当前值）
- 蓝色填充表示可用范围（当前值到 dragMax）
- 灰色背景表示不可用范围（dragMax 到 max）

**当**
- 用户拖动无总量限制的物品数量

**那么**
- 只显示绿色填充（0 到当前值）
- 无蓝色填充区域

**当**
- 用户拖动到 dragMax 位置后继续向右

**那么**
- 保持可拖动，不会显示禁用图标

**当**
- 用户点击 dragMax 到 max 区域

**那么**
- 当前值设置为 dragMax

### Requirement: C/U 槽与其他槽的隔离

**当**
- 用户选择 C 槽或 U 槽

**那么**
- 不显示 group-tabs（连接/分组模式切换）
- 不显示 compatibility-box（兼容标签）
- 不显示 slot-wall（装备选择列表）
- 只显示 ShipStoragePanel 组件

## MODIFIED Requirements

无

## REMOVED Requirements

无
