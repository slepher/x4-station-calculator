# Logic Flow Drag Feedback Specification

## Purpose
提升规划区（Logic Flow Planning Zone）在拖拽模块时的确定性和交互质量。通过实时的资源预览和占位幻化，让用户在松开鼠标前就能清晰感知操作的结果。同时优化候选区的资源显示，使其更加直观。

## ADDED Requirements

### Requirement: New Line Placeholder Transformation
当用户将模块拖拽到“新建产线”区域时，该区域应展示为一条即将生成的产线的预览。

#### Scenario: Drag over new line zone
**前提** 规划区处于紧凑模式（正在拖拽中）
**当** 拖拽一个模块（如“先进电子设备”）悬停在“+ 拖拽以创建”区域时
**那么** 该区域应立即呈现为产线组样式
**并且** 标题显示为“预览：先进电子设备”
**并且** 内部网格显示一个蓝色虚线占位符，位于对应的 Tier 位置

### Requirement: Dependency-Follow Sorting
在产线组标题栏（以及候选区预览）显示的资源列表，其排序必须严格跟随产线组内成品节点的顺序。

#### Scenario: Resources follow product order
**前提** 产线组内有成品 A（消耗硅）和成品 B（消耗矿）
**当** 成品 A 排在成品 B 之前时
**那么** 标题栏的资源列表应显示为 `[硅, 矿]`
**当** 调整布局使成品 B 排在成品 A 之前时
**那么** 标题栏的资源列表应更新为 `[矿, 硅]`
**注意** 若多个成品需要同一种资源，保留其首次出现的位置（去重）。

### Requirement: Static Input Resource Display in Candidate Zone
在候选区（Candidate Zone）的每一个产物卡片内部，直接展示该产线所需的 T0 输入资源。

#### Scenario: Static display
**前提** 候选区显示“先进电子设备”卡片
**当** 用户查看该卡片时（无论是否拖拽）
**那么** 在产物名称下方，应有一行小字显示其所需的 T0 资源（如 `Microchip, Quantum Tube` 的 T0 原料）
**并且** 资源名称使用 i18n 短名，逗号分隔，字体较小且颜色较淡

### Requirement: Derived Candidate Resource Filtering
候选区显示的产物列表（包括 T0 基础资源）必须完全基于生产链推导生成，严禁使用硬编码的组白名单或 Tier 判断。

#### Scenario: Dynamic T0 filtering by race
**前提** 候选区处于“工业”分类
**当** 切换二级分类为“地球人 (Terran)”时
**那么** 候选区仅显示地球人生产线所需的 T0 资源（如：金属微格、碳化硅的原料）
**并且** 自动隐藏不属于地球人产业链的资源（如：硅、矿石等，除非有特定模块需求）
**当** 切换二级分类为“默认 (Default)”时
**那么** 候选区应显示标准产业链所需的全部资源（矿石、硅、气体等）

### Requirement: Candidate Zone Quick Add Visibility
- **T0 资源**：不显示 "+" 按钮（Ore, Silicon, etc.）。
- **Energy Cells**：显示 "+" 按钮。
- **T1+ 资源**：显示 "+" 按钮。

### Requirement: Lock Node Isolation
被锁定的节点（`isLocked: true`）在逻辑上视为“外部供应”或“手动管理”，不参与自动规划系统的计算。
- **Visual Status**: 锁定节点的存在不会触发候选区对应资源的“已规划”（绿色）状态。
- **Expansion Logic**: 
  - 当递归生成上游产线时，若遇到已锁定的同类资源节点，停止该分支的扩展。
  - 严禁修改已锁定节点的任何属性（如 `method`）。

### Requirement: Lock Override and Interaction
用户可以通过拖拽相同产品到锁定节点上方来“接管”并解锁该节点。

#### Scenario: Drag over locked node to unlock
**前提** 产线组 A 中存在一个锁定的 `Graphene` 节点
**当** 拖拽候选区的 `Graphene` 悬停在组 A 标题栏时
**那么** 反馈标签应显示为 `Locked` (i18n)
**当** 鼠标进一步悬停在组 A 的网格区域（Grid）时
**那么** 反馈标签应转变为 `Unlock` (i18n)
**并且** 在网格中 `Graphene` 的对应位置应显示预览停靠点（Phantom Node）
**当** 用户松开鼠标（投放）时
**那么** 现有的 `Graphene` 节点 `isLocked` 变为 `false`
**并且** 自动触发该节点的上游产线扩展（生成 `Methane` 等）

### Requirement: Node Operation Permissions Matrix
系统必须根据节点的来源和当前依赖状态，严格控制操作按钮的可用性。

#### Scenario: Manual node (No dependencies)
**前提** 节点 A 由用户手动拖入，且没有其他节点依赖它
**那么** 节点 A 仅显示 **删除 (🗑️)** 按钮
**并且** 禁止 **锁定 (🔒)** 操作

#### Scenario: Auto node (System generated)
**前提** 节点 B 由系统自动生成，用户未曾手动操作过
**那么** 节点 B 仅显示 **锁定 (🔒)** 按钮
**并且** 禁止 **直接删除** 操作（以保护产业链完整性）

#### Scenario: Mixed node (Manual + Dependency)
**前提** 节点 C 由用户手动拖入，同时也是其他节点的依赖项
**那么** 节点 C 同时显示 **删除 (🗑️)** 和 **锁定 (🔒)** 按钮
**当** 点击 **删除** 时
**那么** 节点 C 的 `manual` 身份被移除，转为 `auto` 状态（降级），节点保留在组内
**当** 点击 **锁定** 时
**那么** 节点 C 的 `manual` 身份被移除，并立即进入 `locked` 状态，停止上游递归

### Requirement: Node Provenance Visual Distinction
规划区节点应根据其创建方式展示不同的视觉特征，以便用户区分“核心产物”与“系统补充”。

#### Scenario: Manual vs Auto visual check
**前提** 规划区包含一个手动添加的 `Hull Parts` 和一个自动生成的 `Graphene`
**当** 用户观察这两个节点时
**那么** `Hull Parts` 应显示为实线边框
**并且** `Graphene` 应显示为虚线边框或带有轻微的 `Auto` 标识（i18n）

### Requirement: Auto Node Promotion
用户可以通过拖拽相同产品到自动生成的节点上方来将其“转正”为手动节点。

#### Scenario: Drag over auto node to promote
**前提** 产线组 A 中存在一个自动生成的 `Microchip` 节点（source: 'auto'）
**当** 拖拽候选区的 `Microchip` 悬停在组 A 标题栏时
**那么** 反馈标签应显示为 `Auto` (i18n)
**当** 鼠标进一步悬停在组 A 的网格区域（Grid）时
**那么** 反馈标签应转变为 `Manual` (i18n)
**并且** 在网格中 `Microchip` 的对应位置应显示预览停靠点（Phantom Node）
**当** 用户松开鼠标（投放）时
**那么** 现有的 `Microchip` 节点 `source` 变为 `manual`
**并且** 节点边框从虚线变为实线

## MODIFIED Requirements

### Requirement: Compact View Layout
- FROM: 标题栏仅显示名称和重复标签。
- TO:   标题栏同行排列 T0 资源预览，并排除能量电池，且遵循“依赖跟随排序”规则。

## REMOVED Requirements

### Requirement: Dragging Object Resource Arrows
- REASON: 替换为候选区直接显示的静态资源列表，减少视觉干扰。

### Requirement: Manual Upstream Expansion Button
- REASON: 系统已实现自动扩展逻辑，手动按钮不再必要，移除 🌳 图标及其点击行为。
