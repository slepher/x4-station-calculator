# Ship Equipment Selector Specification

## Purpose

定义 ship build 配装区域在槽位候选选择、展开态布局、过滤数据来源与模式切换上的行为约束。

## ADDED Requirements

### Requirement: 槽位候选显示与点击

#### Scenario: 候选数量等于 1

**前提** 当前槽位候选集合大小为 1

**当** 用户点击该槽位

**那么** 槽位装备该唯一候选

**并且** 再次点击同一槽位时取消装备并回到空槽

#### Scenario: 候选数量大于 1

**前提** 当前槽位候选集合大小大于 1

**当** 用户点击该槽位

**那么** 展开 picker 选择面板

**并且** 候选列表显示在右侧候选区

---

### Requirement: 展开态三行布局

#### Scenario: 展开态结构

**前提** picker 已展开

**那么** 第一行显示模式切换与确认取消按钮

**并且** 第二行显示槽位分页签与候选分页

**并且** 第三行左侧为兼容/过滤与槽位区，右侧为候选列表

**并且** 第一行与第二行高度固定为 `25.6px`

#### Scenario: compatibility 内容替换

**前提** picker 已展开

**那么** `compatibility-box` 内原展示内容被 `filter-block` 替换

**并且** 槽位列表保持展开前视觉风格并与 compatibility 区共同处于第三行左侧容器

---

### Requirement: 过滤来源与计数

#### Scenario: 数据来源

**前提** picker 已展开

**那么** Race 标签来源于当前候选的 `equipment.race`

**并且** MK 标签来源于当前候选的 `equipment.mk`

**并且** Tag 标签来源于预置集合 `standard/advanced/xenon/mining/missile/highpower`

**并且** Tag 标签文本使用 i18n 翻译

#### Scenario: 标签可见性与计数

**前提** picker 已展开

**那么** 仅显示当前候选中实际出现的标签值

**并且** Race 计数基于 `MK + Tag` 过滤后的候选

**并且** MK 计数基于 `Race + Tag` 过滤后的候选

**并且** Tag 计数基于 `Race + MK` 过滤后的候选

---

### Requirement: 展开态交互与模式切换

#### Scenario: 展开态允许切换模式

**前提** picker 已展开

**当** 用户点击 `标准/简化` 模式按钮

**那么** 模式可切换

**并且** 若存在展开槽位，使用其 `connectionKeys` 作为锚点在新模式映射目标槽位

#### Scenario: 展开态下 group/tab 切换

**前提** picker 已展开

**当** 用户切换 group/tab

**那么** picker 保持展开

**并且** 当前展开槽位映射到切换后对应槽位

**并且** 过滤器与候选列表按新槽位重算

#### Scenario: slot.type 点击行为

**前提** picker 已展开

**当** 用户点击左侧 slot.type（E/S/W/T/R）

**那么** picker 关闭

---

### Requirement: 关闭后的回退与确认

#### Scenario: 关闭后模式回退

**前提** 当前模式为 `group` 且不满足 `canSwitchToGroupMode`

**当** picker 关闭

**那么** 模式自动回退为 `connection`

#### Scenario: 确认赋值与空 group 清理

**前提** picker 已展开且用户已高亮候选（可为 `null` 空槽）

**当** 用户点击确认

**那么** 对 `pickerTarget.connectionKeys` 执行批量赋值

**并且** 若 `equipment_id` 与 `shield.equipment_id` 同时为空，则移除对应 group
