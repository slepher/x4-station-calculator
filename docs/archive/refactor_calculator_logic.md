# Refactor Spec: Independent Supply Zone & 3-Tier Calculation

## 1. 目标 (Objective)
重构核心计算逻辑文件 `src/utils/moduleDiffCalculator.ts`。
将原本单一的增量计算拆分为**三阶段单向流水线**，实现"补给区 (Supply Zone)"与"工业区 (Industry Zone)"的逻辑隔离。

## 2. 接口变更 (Interface Changes)

### 目标函数
将 `calculateModuleDiff` 重命名并改造为 `calculateAutoFill`。

### 输入参数 (Input Parameters)
```typescript
plannedModules: SavedModule[]  // Tier 1 - 用户手动规划
race: string
globalWorkforceBonus: boolean  // 控制 Manual 和 Industry 的加成
supplyWorkforceBonus: boolean  // 新增 - 仅控制 Supply 区的加成
modules: Record<string, X4Module>
wares: Record<string, X4Ware>
lockedWares: string[]  // 默认为 []
```

### 输出结构 (Output Structure)
```typescript
{
  autoIndustry: SavedModule[]; // 自动生成的工业模块 (Tier 2)
  autoSupply: SavedModule[];   // 自动生成的补给模块 (Tier 3)
}
```

## 3. 核心算法流程 (Algorithm Pipeline)
计算过程严格遵循以下顺序，禁止回环：

### Phase 1: 工业硬补完 (Tier 2 Calculation)
**目标**：填补 `plannedModules` 产生的原料缺口。

**逻辑**：
1. 复制 `plannedModules` 作为基础状态
2. 递归循环 (Loop):
   - 计算当前净产出 (Net Production)
   - 效率设定：使用 `globalWorkforceBonus`
   - 识别缺口 (Deficit)
   - 过滤：若资源在 `lockedWares` 中，**跳过**
   - 匹配：使用 `findBestProducer` 寻找最佳工厂
   - 添加：将新工厂加入 `autoIndustry` 列表，并累加到当前计算状态中
3. 产出：`autoIndustry` 列表

### Phase 2: 客户人口普查 (Client Census)
**目标**：统计需要被"喂养"的总人口。

**逻辑**：
1. 合并列表：`AllProducers = plannedModules + autoIndustry`
2. 统计总工人数 (`ClientPopulation`)
   - 效率设定：使用 `globalWorkforceBonus`
   - 遍历 `AllProducers`，累加 `workforce.needed * count`

### Phase 3: 补给区独立构建 (Tier 3 Calculation)
**目标**：基于 `ClientPopulation` 构建完全独立的后勤闭环。

**关键原则**：补给区是"孤岛"，其水电自给自足，其人口不计入全局统计。

#### 步骤 A: 物资生产 (Production)
1. 调用 `calculateWorkerSupplyNeeds(ClientPopulation, ...)`
   - 该函数已内部处理了"食物厂需要人、人需要食物"的递归收敛
   - 它会返回所需的农场、水厂、电厂、药厂列表
2. 将结果转换为 `autoSupply` 列表

#### 步骤 B: 居住舱补全 (Habitation) - 逻辑分支
根据 `supplyWorkforceBonus` 参数决定：

**Case 1: supplyWorkforceBonus === false**
- 动作：不做任何操作
- 结果：补给区只有工厂，没有居住舱（按 100% 无人效率运行）

**Case 2: supplyWorkforceBonus === true**
- 动作：
  1. 统计 `autoSupply` 列表（仅步骤 A 生成的部分）的工人数 (`SupplyWorkers`)
     - 注意：这里计算需求时传入 `true` (启用加成)
  2. 选择最佳居住舱 (`findBestHabitat`)
     - 限制：直接根据 `race` 选择，**不**参考 `plannedModules` 中的居住舱类型
  3. 计算数量：`HabitatCount = Math.ceil(SupplyWorkers / Habitat.Capacity)`
     - 限制：直接按总需求计算，**不**扣除 Manual 区可能有剩余的容量（完全隔离）
  4. 将居住舱加入 `autoSupply` 列表

## 4. 辅助函数要求 (Helper Functions)
- `calculateNetProduction`: 提取为独立纯函数，接受 `SavedModule[]` 和 `bonus` 开关
- `calculateTotalWorkforce`: 提取为独立纯函数，接受 `SavedModule[]` 和 `bonus` 开关
- 保持引用：继续使用 `bestModuleSelector.ts` 和 `workerModuleCalculator.ts` 中的现有导出函数

## 5. 验证点 (Checklist for AI)
- [ ] 确保 `calculateAutoFill` 的入参没有被包裹在 Context 对象中
- [ ] 确保 `autoSupply` 里的居住舱计算逻辑与 `plannedModules` 完全解耦
- [ ] 确保 `lockedWares` 仅影响 Phase 1 (Industry)，不影响 Phase 3 (Supply 内部的递归)
- [ ] 确保补给区的人口加成由 `supplyWorkforceBonus` 独立控制

## 6. 重构src/store/useStationStore.ts

### 计算属性定义
```
// 2. The Engine (核心计算引擎)
  // 这是一个 Computed，它监听 manualModules 变化，
  // 并在内部一次性完成所有依赖计算，输出最终的两个自动列表。
  const calculationResult = computed(() => {
 
    /// 调用刚才重构完成的函数 calculateAutoFill

    return {
      industry: autoIndustry,
      supply: autoSupply
    };
  });

  // 3. 暴露给 UI 的接口
  // UI 只需要读这两个属性，它们会自动同步
  const autoIndustryModules = computed(() => calculationResult.value.industry);
  const autoSupplyModules = computed(() => calculationResult.value.supply);
  ```