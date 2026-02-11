# Implementation Tasks

- [x] 更新 `scripts/x4_data_processor.py` 以解析仓储模块的 `cargo` 属性 (capacity, type) <!-- id: 0 -->
- [x] 更新 `src/types/x4.ts` 中的 `X4Module` 定义，增加 `cargo` 字段 <!-- id: 1 -->
- [x] 在 `src/store/logic/moduleDiffCalculator.ts` 中实现 `calculateAutoFill` 的 Phase 4 逻辑 <!-- id: 2 -->
    - [x] 引入 `analyzeWareFlow` 并复用其计算逻辑
    - [x] 实现 `findBestStorage` 函数 (支持 Race Preference 和 Fallback)
    - [x] 实现增量填充逻辑 (Delta Calculation)
    - [x] 实现双重计算逻辑：支持 Main Storage 和 AutoSupply Storage 的独立计算
- [x] 更新 `src/store/useStationStore.ts` <!-- id: 3 -->
    - [x] 确保调用 `calculateAutoFill` 时传入 `warePriority` 和 `medicalConsumption`
    - [x] 执行第一次计算：Main Storage (Industry + Planned - Supply)
    - [x] 执行第二次计算：AutoSupply Storage (Supply Only)
    - [x] 将结果分别合并到 `autoStorage` 和 `autoSupply` 数组
- [x] 验证生成的 `modules.json` 数据结构 (手动检查或运行脚本) <!-- id: 4 -->
- [ ] Refactor: 合并 `autoStorage` 到 `autoIndustry` <!-- id: 5 -->
    - [ ] 修改 `calculateAutoFill` 将计算出的仓储模块追加到 `autoIndustry` 数组
    - [ ] 从返回值和 Store 中移除 `autoStorage`
    - [ ] 更新 UI，移除独立的 `autoStorage` 渲染循环（它们将作为工业区的一部分显示）
