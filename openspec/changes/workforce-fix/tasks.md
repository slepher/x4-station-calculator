# Workforce Fix - Tasks

## Tasks

### Phase 1: 数据模型与提取修正

- [x] T1. 定义新的 workforce consumption 类型，能够表达 `race -> state(idle|busy) -> ware -> perPersonPerHour`
- [x] T2. 替换 `RaceMedicalConsumption` / `medicalConsumptionMap` 的命名与注释，消除 medical-only 与错误时间单位误导
- [x] T3. 修改 `scripts/x4_data_processor.py`，同时提取 `workunit_idle` 与 `workunit_busy`
- [x] T4. 更新处理后数据文件结构，并确认单位统一为“每人每小时”

### Phase 2: 运行时 workforce consumption 计算修正

- [x] T5. 修改 `calculateProductionFlows.ts`，使 workforce consumption 计算支持 idle / busy 双档
- [x] T5a. 将运行时 workforce consumption 计算改为直接消费 `perPersonPerHour`，不再在计算阶段乘 `3600`
- [x] T5b. 扩展 `FlowContribution.class`，新增 `workforce_idle`，保持 contribution 字段数量不变
- [x] T6. 保持 blueprint / planning 路径在缺少总居民输入时只按 busy 计算，并明确 idle = 0
- [x] T7. 修改 live / archive 路径的 workforce override 语义，不再把全部 `workforces` 直接当作 busy workforce
- [x] T8. 在 live / archive 路径中计算：
  - `totalResidents`
  - `busyWorkers`
  - `idleWorkers`
- [x] T9. 按 race 占总居民比例分摊 busy / idle，并据此生成各 ware 的 workforce consumption
- [ ] T9d. `manualWorkforce` 路径先按 habitation race 拆分，再与 `workforceOverride` 共用同一套 busy / idle 后处理逻辑
- [ ] T9e. 移除 `manualWorkforce` 路径的 busy-only 特判，避免手动人数大于需求时丢失 idle contribution
- [x] T9a. auto 路径只生成 `class: 'workforce'` contribution
- [x] T9b. override / settings 路径为 idle 部分生成 `class: 'workforce_idle'` contribution
- [x] T9c. 当 `idleWorkers === 0` 时，不生成 `class: 'workforce_idle'` contribution
- [ ] T9f. 当 `busyWorkers === 0` 时，不生成 `class: 'workforce'` contribution
- [x] T10. 修正 efficiency 口径，确保 live 下 `actualWorkforceOverride` 反映 busyWorkers 而不是 totalResidents

### Phase 3: Store 集成与语义收口

- [x] T11. 更新 `StationDerivedMap` 及相关调用，确保 `workforcesOverride` 在 full/live 语义下表示真实居民分布
- [x] T12. 检查并更新所有依赖 workforce consumption 数据结构的 store / facade / presenter 类型引用
- [x] T12a. 将所有 `class === 'workforce'` 的旧判断升级为“workforce 类判断”，同时覆盖 `workforce` 与 `workforce_idle`
- [x] T13. 保持 supply 分组、workforce contribution trace 与非 workforce flow 聚合行为不变

### Phase 4: 测试需求补齐

- [x] T14. 更新 unit test 需求，覆盖 idle / busy 双档基础计算
- [x] T15. 更新 live 场景测试需求，覆盖“总居民大于岗位需求”时的 busy/idle 拆分
- [x] T16. 更新 race 分摊测试需求，覆盖多 race `workforces` 的 food / medical / race-specific food 消耗
- [x] T17. 补充回归测试需求，确认 blueprint / planning 路径在无总居民输入时保持 busy-only

### Phase 5: 构建验证

- [x] T18. 代码完成后执行 `npm run build`

## 完成定义

- [x] 数据层不再只保留 busy consumption
- [x] live / archive 路径不再把全部居民按 busy 计算
- [x] efficiency 与 consumption 对 live workforce 的口径一致
- [x] blueprint / planning 路径边界清晰且无伪造 idle 人口
- [x] contribution 不新增字段数量，busy/idle 仅通过 `class` 区分
- [x] `idleWorkers === 0` 时不产生 idle contribution 噪音
- [x] food / medical / race-specific food 的 wareflow 正确反映 idle + busy 结果
- [x] 类型、命名、注释与运行时结构保持一致
