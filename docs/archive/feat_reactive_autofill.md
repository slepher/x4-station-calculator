# Feature Spec: Reactive Auto-Fill & 3-Tier Architecture

## 1. 核心目标 (Overview)
利用现有的自动补全算法，重构 UI 和数据流，将“手动点击”改为“响应式计算”，并引入**三层列表架构**以解决循环依赖并优化视觉层级。

## 2. 数据架构 (Data Architecture)

### 2.1 状态定义 (State Definitions)
Pinia Store (`useStationStore`) 将维护以下三个核心列表：

1.  **`plannedModules` (Tier 1 - Existing)**
    * **定义:** 用户手动添加、调整过的核心模块。
    * **属性:** *Source of Truth*。数量绝对优先，不会被算法减少。
    * **计算配置:** 遵循全局劳动力加成设置。

2.  **`autoIndustryModules` (Tier 2 - Computed)**
    * **定义:** 为了满足 `plannedModules` 原料缺口而自动生成的上游工业模块。
    * **计算逻辑:** * 基于现有补全算法。
        * **差异点:** 仅填补 `plannedModules` 产生的净缺口。
        * **锁判定:** 尊重现有的 `lockedWares` 状态。
    * **计算配置:** 遵循全局劳动力加成设置。

3.  **`autoSupplyModules` (Tier 3 - Computed)**
    * **定义:** 为了满足 Tier 1 和 Tier 2 的劳动力消耗而自动生成的农业/医疗模块。
    * **配置独立:** 使用独立的 `supplyWorkforceBonus` (Boolean) 开关。

### 2.2 现有辅助状态 (Existing Helpers)
-   **`lockedWares`**: 保持现状。记录哪些货物被锁定（不自动补全）。
-   **`settings`**: 保持现状。新增 `supplyWorkforceBonus` 字段。

---

## 3. 算法适配 (Logic Adaptation)

**现状:** 核心的递归补全算法 (`autoFillMissingLines`) 已存在。
**变更:** 需要对现有算法进行**微调 (Tweak)**，以适配分离的列表结构。

1.  **输入源区分:** * 算法不再混淆所有模块。
    * **Pass 1:** 先读取 `plannedModules` 计算基础缺口。
    * **Pass 2:** 生成 `autoIndustryModules` 填补未锁定的工业缺口。
    * **Pass 3:** 汇总 T1+T2 的人口需求，生成 `autoSupplyModules`。

2.  **输出分离:** * 计算结果不再直接修改 `plannedModules`（除非用户执行“晋升”操作）。
    * 结果分别写入两个 `computed` 或临时 State 供 UI 渲染。

---

## 4. UI/UX 规范 (UI Specification)

### 4.1 模块列表 (StationModuleList.vue)
列表垂直分为三个独立区域：

1.  **用户规划区 (Tier 1)**
    * 渲染 `plannedModules`。
    * 保留完整的拖拽、删除、修改功能。

2.  **自动产线区 (Tier 2)**
    * 渲染 `autoIndustryModules`。
    * 样式区分（如：虚线边框或不同背景色）。
    * **交互:** 不可直接删除。修改数量或点击交互可将其“晋升”入 `plannedModules`。

3.  **自动补给区 (Tier 3)**
    * 渲染 `autoSupplyModules`。
    * 样式同 Tier 2，逻辑上独立显示。

### 4.2 资源面板 (ResourceOverview)
* **锁控制:** 保持现有逻辑。在面板上操作 `lockedWares`，变更后立即触发响应式重算。

---

## 5. 迁移要点 (Migration Notes)
* **Logic:** 复用现有的 `autoFill` 逻辑核心，将其改造为纯函数风格，接受 `targetDeficit` 作为输入，返回建议的模块列表。
* **Store:** 确保 getters 正确合并三层列表供“总产出计算”使用 (`allModules = planned + autoIndustry + autoSupply`)。