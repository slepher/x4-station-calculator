# map-resource-processor 需求说明

## 目标

基于当前 `scripts/processor` 中处理 resource 代码的实现为准，整理出完整的 resource 处理文档，包括两个版本的逻辑分叉。

## 背景

当前 resource 处理代码已经完成了模块化重构，形成了清晰的版本分叉架构：

- **8.0 版本（regions 模型）**: 使用 legacy_processor.py 处理传统 region 定义
- **9.0+ 版本（resourceareas 模型）**: 使用 modern_processor.py 处理新版 resourcearea 定义

需要将这些实现逻辑整理成文档，便于后续维护和开发。

## 范围

本文档涵盖以下数据处理链路：

1. **Region 处理** (8.0 版本)
   - regionyields.json 生成
   - regions.json 生成
   - resourceareas.json 生成

2. **ResourceArea 处理** (9.0+ 版本)
   - regionyield_definitions.json 生成
   - resourceareas.json 生成
   - regionyields.json (空数组占位)

3. **Map 中 Resources 处理**
   - maps.json 中的 sector.resources 聚合
   - 跨版本统一的资源聚合计算

4. **Region Yield 定义**
   - 8.0: regionyields.json (yield 定义)
   - 9.0+: regionyield_definitions.json (definition 定义)

## 交付物

1. 完整的 resource 处理流程文档
2. 两个版本的数据流对比
3. 核心算法说明
4. 输出数据结构定义
5. **文档对比分析报告**（新增）

## 验收标准

1. [ ] 文档准确反映当前代码实现
2. [ ] 清晰区分 8.0 和 9.0+ 的处理逻辑
3. [ ] 包含所有关键数据结构的字段说明
4. [ ] 包含核心算法的公式说明
5. [ ] 完成文档对比分析并生成报表

---

## 新增任务：文档对比分析

### 任务目标

对最终文档与原始文档、代码实现进行对比分析，识别差异和缺失内容。

### 对比范围

| 对比类型 | 对比双方 | 分析内容 |
|---------|---------|---------|
| **文档间对比** | 最终文档 vs 原始 change 文档 | 最终文档**缺少**了哪些原始文档中有的内容 |
| **文档 - 代码对比** | 最终文档 vs processor 代码实现 | 两者的**差异**（双向：文档缺失的代码实现 + 代码未实现的文档描述） |

### 对比范围限定

- 仅关注**生成 JSON 输出**相关的部分
- 不包括：测试策略、UI/前端、纯重构优化等内容

### 相关文档目录

- **最终文档**: `openspec/changes/map-resource-processor/design.md`
- **原始 change 文档**: `openspec/changes/` 目录下与 resource 相关的 change 文档
- **代码实现**: `scripts/processor/resource/`、`scripts/processor/map/` 等

### 交付物

1. **文档间对比报告**: 列出最终文档相比原始 change 文档缺少的内容
2. **文档 - 代码对比报告**: 列出最终文档与代码实现的双向差异
3. **汇总报表**: 整合两份报告的发现，提出补充建议
