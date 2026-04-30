# CONTEXT.md — X4 Station Calculator

## 领域术语

| 术语 | 含义 |
|------|------|
| A | 电子黏土（Claytronics）+ 船体部件（Hull Parts）生产模块 |
| B | 先进复合材料（Advanced Composites）+ 等离子导体（Plasma Conductors）生产模块 |
| C | 目标产线（Target Production Line） |
| A_autoFill | A 产线 autoFill 追加的运营/支持模块 |
| 通用自举模式 | 控制建材产线自举策略的下拉选项，替代原 self-sufficient checkbox |
| 联合自举 | A+B 视为联合模块，通过 greedyFill 直接满足 C 的 buildCost 需求 |
| 耦合迭代自举 | A↔B 外层循环迭代：A 必须同时满足 (C+B) & A_autoFill 对 电子黏土+船体部件的消耗 |
| 孤立特种自举 | B→A→C 单向顺序：B 孤立建设（外部供应），A 自迭代满足 C+自身 |
| 不自举 | 无建材自举，仅出目标产线（方案3） |
| greedyFill | 最低满足度追加模块的迭代算法，直至所有 source 满足率 ≥ 100% |
| max_merge | 多个 source 的 rates 逐 ware 取最大值 |
