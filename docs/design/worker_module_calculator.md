# workerModuleCalculator.ts 技术设计文档

## 1. 概述 (Overview)

`workerModuleCalculator.ts` 是本项目中专门用于计算 **补给区（Supply Zone）** 闭环需求的独立核心模块。

与普通的工业产线计算（线性的、单向的）不同，补给区的计算是一个 **递归收敛（Recursive Convergence）** 问题：
> 为了养活 1000 个工人 $\rightarrow$ 需要建造食物厂 $\rightarrow$ 食物厂本身需要额外的工人 $\rightarrow$ 额外的工人又需要更多的食物...

该模块的核心职责是：**在给定目标种族和初始工人数的情况下，计算出为了达成“自给自足”所需的完整工厂列表。**

---

## 2. 核心架构决策：为何返回“工厂”而非“物资”？

我们选择让该模块直接返回 **工厂列表（Modules）**，而不是“物资缺口（Wares）”，是为了解决不同种族在生产同一种物资时的 **“成本不对等”** 与 **“系数失效”** 问题。

### 2.1 案例分析：Argon vs Teladi 医疗物资产线
以生产同一种商品“医疗物资 (Medical Supplies)”为例，不同种族的工厂在输入与人力成本上有显著差异：

| 特性 | Argon 医疗物资产线 | Teladi 医疗物资产线 |
| :--- | :--- | :--- |
| **主要原料** | 消耗 **水 + 香料 (Spices)** | 消耗 **水 + 沼气 (Biogas)** |
| **工人需求** | **低** (假设 40 人) | **高** (假设 60 人) |
| **生产效率** | 标准 | 较高 |
| **后勤连锁** | 触发 **肉/小麦** 产业链 | 触发 **油/豆** 产业链 |

### 2.2 潜在风险：需求转嫁导致系数失效
如果我们仅返回“缺 1000 单位医疗物资”，交由外层逻辑去建造：

1.  **计算阶段 (Calculation)**:
    本模块在计算 **Teladi** 人口的自维持系数时，是基于事实 **“Teladi 医疗厂需要 60 人”** 进行的。这意味着每生产 1 单位医疗物资，系统预估了较高的后勤人口负担（系数 $R$ 较大）。

2.  **建造阶段 (Build)**:
    如果外层逻辑为了省事（或基于全局最优解），错误地选择了 **Argon 医疗厂**（仅需 40 人）来填补这 1000 单位的缺口。

3.  **后果 (Consequence)**:
    * **人口过剩**: 系统依照 Teladi 系数准备了大量的居住舱和 Nostrop Oil（为了养活预估的 60 人），但实际上只需要养活 40 人。
    * **资源错配**: 系统准备了 Teladi 产线所需的“沼气”，但实际建造的 Argon 工厂需要的是“香料”。

**结论**：为了保证数学模型的闭环，**“谁算的系数，就必须用谁的工厂”**。直接返回工厂列表能强制锁定生产路径，确保物理建造与数学预估严格一致。

---

## 3. 核心工作原理 (Core Logic)

该文件不使用简单的线性累加，而是采用了 **系数预测 + 迭代逼近** 的算法。

### 3.1 步骤一：递归计算自维持系数 (Recursive Cost Analysis)
首先，通过递归算法计算特定种族的自维持系数 $R$ 和人口乘数 $M$：

* **$R$ (Ratio)**: 维持 1 个该种族工人，其背后产业链所需的所有“潜在工人份额”。
    * *公式概念*: $R = \sum (\text{物资消耗} \times \text{该物资的单位工人成本})$
* **$M$ (Multiplier)**: 最终人口乘数。
    * *公式*: $M = \frac{1}{1 - R}$
    * *意义*: 如果 $R=0.2$，则 $M=1.25$。这意味着每雇佣 1 个前台工人，你需要准备 0.25 个后台后勤人口。

### 3.2 步骤二：种族逻辑隔离 (Race Segregation)
在多种族混居场景下，采取 **“各算各的”** 策略：
* **输入**: Argon 人口 1000, Teladi 人口 500。
* **执行**:
    * 计算 Argon 需求时，`findBestProducer` 强制锁定 Argon 图纸。
    * 计算 Teladi 需求时，`findBestProducer` 强制锁定 Teladi 图纸。
* **输出**: 两套独立的工厂列表。哪怕同时存在两种医疗厂，也是逻辑上最安全、最健壮的方案。

### 3.3 步骤三：收敛循环 (Convergence Loop)
有了乘数 $M$，我们就可以跳过繁琐的死循环，直接进行快速收敛：

1.  **预测总量**: `当前预计总人口 = 目标人口 * M`。
2.  **计算物资缺口**: 基于预计总人口，计算所有生活物资的总消耗。
3.  **填补工厂**: 
    * 调用 `findBestProducer`。
    * **关键**: 严格传入 `raceKey`，禁止跨种族借用工厂。
4.  **误差修正**: 
    * 统计新造这些工厂实际需要的工人数。
    * 如果 `实际需要总人数 != 当前预计总人口`，更新预计人数，重复步骤 2。
    * 由于 $M$ 的准确性，通常只需要 1-2 次循环即可完美收敛。

---

## 4. 接口定义 (Interface)

```typescript
/**
 * 计算指定种族、指定工人数所需的完整补给产线模块列表
 * * @param targetWorkerCount 目标工人数 (例如：普查出的 1000 Argon 人)
 * @param raceKey 目标种族 (用于强制锁定工厂类型，确保系数准确，如 'argon', 'teladi')
 * @param modulesMap 模块数据
 * @param waresMap 物资数据
 * * @returns Record<string, number> 模块ID与数量的键值对
 * 例如: { 
 * "module_gen_prod_medical_argon": 2, 
 * "module_gen_prod_foodrations": 4 
 * }
 */
export function calculateWorkerSupplyNeeds(
  targetWorkerCount: number,
  raceKey: string,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>
): Record<string, number>