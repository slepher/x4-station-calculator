# Refactor Checklist: Workforce Census & Supply Logic

## 1. productionCalculator.ts
**目标**: 抽离人口普查逻辑，供外部复用，消除重复代码。

- [x] **新增接口定义**
  - 定义并导出 `WorkforceCensusItem` 接口 (包含 `moduleId`, `nameId`, `residents`, `count`, `race`)。

- [x] **新增导出函数: `calculateWorkforceCensus`**
  - [x] 接收参数: `modules`, `modulesMap`, `availableWorkforce`.
  - [x] 逻辑: 
    - 遍历模块列表。
    - 识别有效居住舱 (Habitation)。
    - 从上到下扣减 `availableWorkforce` 填入居住舱。
    - 记录实际入住人数和对应种族 (`info.race || 'default'`)。
  - [x] 返回: `WorkforceCensusItem[]`.

- [x] **重构: `calculateProfitBreakdown`**
  - [x] 删除原有的 Phase 2 "动态工人消耗" 循环代码。
  - [x] 调用 `calculateWorkforceCensus` 获取普查结果。
  - [x] 遍历普查结果，根据 `item.race` 查表 (`consumption.json`) 计算物资消耗 (`wareDetails`)。

---

## 2. moduleDiffCalculator.ts
**目标**: 在补给计算阶段引入精准的人口普查逻辑，支持多种族混居计算。

- [x] **引入依赖**
  - [x] 导入 `calculateWorkforceCensus` (from `./productionCalculator`).

- [x] **修改 Phase 3: 补给区独立构建**
  - [x] **合并列表**: 创建 `allModulesForCensus` (包含 `plannedModules` + `autoIndustry`)。
  - [x] **调用普查**: 使用 `calculateWorkforceCensus` 获取当前工人的居住分布。
  - [x] **统计种族**: 
    - 遍历普查结果，汇总各族实际人数 (`workersByRace`)。
    - 计算已安置总人数，将剩余的无家可归工人归入默认种族 (`race` 参数)。
  - [x] **计算补给需求**: 
    - 遍历 `workersByRace`。
    - 对每个种族调用 `calculateWorkerSupplyNeeds(count, raceKey, ...)` (旧接口保持不变)。
    - 将返回的模块需求累加到 `supplyModulesMap`。
  - [x] **生成结果**: 将 Map 转换为 `SavedModule[]` 推入 `autoSupply`。

---

## 3. workerModuleCalculator.ts
- [x] **保持不变** (接口与内部逻辑均不做修改)。