# Request: 补给与运营分组拆分

## 需求背景

当前空间站的缺口分类中，工人建筑消耗的物资（如食物配给、医疗用品等）与工业生产消耗的 container 类物资被统一归类到"运营"分组中，无法区分。用户需要将这两类消耗分开显示，以便更清晰地了解空间站的补给需求和运营成本。

## 功能描述

将空间站的缺口分类从单一的"运营"拆分为：
- **补给**：由工人建筑需求导致的缺口（工人消耗物资）
- **运营**：其他 container 类物资缺口（工业生产消耗）

## 用户场景

### 场景 1：查看工人补给需求
- 用户在空间站计算器中添加了需要工人的生产模块
- 用户切换到数量视图
- 系统显示"补给"分组，包含 foodrations、medicalsupplies 等工人消耗物资的缺口

### 场景 2：区分运营成本和补给成本
- 用户切换到经济视图
- 系统显示"运营支出"和"补给支出"两个独立分组
- 用户可以清晰看到运营成本和补给成本的差异

## 技术决策

### 方案选择
采用方案 A：在 `WareFlow` 接口中新增 `workforceConsumption` 字段

**理由**：
- 语义清晰，直接表达"工人消耗"概念
- 分组时无需遍历 `contributions`，性能更好
- 未来可扩展其他消耗类型

### 分组规则
| 分组 | 条件 |
|------|------|
| `positive` | `netRate > 0` |
| `operations` | `netRate <= 0 && transportType === 'container' && workforceConsumption === 0` |
| `supply` | `netRate <= 0 && workforceConsumption > 0` |
| `resources` | `netRate <= 0 && transportType !== 'container' && workforceConsumption === 0` |

### UI 分组顺序
产品 → 运营 → 补给 → 资源

### 国际化
- 数量视图：补给
- 经济视图：补给支出

## 验收标准

1. `WareFlow` 接口包含 `workforceConsumption` 字段
2. `GroupedFlows.rateGroups` 包含 `supply` 分组
3. 工人消耗物资正确归入补给分组
4. 工业 container 消耗物资正确归入运营分组
5. UI 显示四个分组，顺序正确
6. 国际化文本正确显示

## 影响范围

- **类型定义**: `src/types/x4.ts`
- **计算逻辑**: `src/store/logic/analyzeWareFlow.ts`
- **UI 组件**: `src/components/StationWareFlowsDashboard.vue`
- **国际化**: i18n 文件
