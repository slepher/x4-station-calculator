# 星区存档资源验证任务清单

## 已完成任务

### 1. 分析脚本开发 ✓

- [x] 创建 `analysis/scripts/verify_sector.py` 脚本
- [x] 支持命令行参数输入星区 ID
- [x] 实现第一级验证：星区总量（与 total.json 对比）
- [x] 实现第二级验证：密度分级（直接从 resourceareas 获取 yield_name）
- [x] 密度级别映射：通过 `resourceareas[].areas[].resources[].yield_name` 获取密度级别
- [x] 实现气体 Block 分布分析
- [x] 实现 Nebula 参数推断
- [x] 实现理论 Block 计算（圆柱体相交判断）
- [x] 实现 Markdown 报告生成

### 2. 文档更新 ✓

- [x] 创建 `openspec/changes/resource-save-verify/request.md`
- [x] 创建 `openspec/changes/resource-save-verify/spec.md`
- [x] 创建 `openspec/changes/resource-save-verify/current_status.md`（当前状态总结）
- [x] 更新两级验证逻辑说明
- [x] 更新密度级别字段说明（yield_name 直接在 resourceareas 中）

### 3. 典型星区验证 ⏳

已验证的 4 个典型星区（第一级全部通过，第二级待分析）：

| 类型 | 星区 ID | 第一级验证 | 第二级验证 | Block 匹配 | 报告位置 |
|------|---------|-----------|-----------|-----------|----------|
| 大圆形 | `cluster_04_sector001_macro` | ✓ 全部合格 | ? 部分存疑 | 7.2% | `analysis/doc/resource/cluster_04_sector001_macro.md` |
| 小圆形 | `cluster_15_sector001_macro` | 待验证 | 待验证 | 待验证 | `analysis/doc/resource/cluster_15_sector001_macro.md` |
| 圆柱形 | `cluster_49_sector001_macro` | 待验证 | 待验证 | 待验证 | `analysis/doc/resource/cluster_49_sector001_macro.md` |
| 星带 | `cluster_18_sector001_macro` | 待验证 | 待验证 | 待验证 | `analysis/doc/resource/cluster_18_sector001_macro.md` |

**注意**:
- 第一级验证（星区总量）全部通过
- 第二级验证（密度分级）存在大量不匹配，需要进一步调查（见 `current_status.md`）
- Block 匹配率 7.2% 为单向匹配（实际 Block 全部在理论范围内），需要检查理论计算逻辑

### 4. 验证逻辑说明 ✓

#### 第一级验证（星区总量）
- 理论值来源：`total.json` 中 `sectors[].ware.<ware>.<density>.max` 的所有密度之和
- 误差 < 10% 为合格

#### 第二级验证（密度分级）
- 理论值来源：`resourceareas[].areas[].resources[].total_yield` 按 `yield_name` 分组
- 密度级别名称：来自 `resourceareas[].areas[].resources[].yield_name`（如 medplus, medium, verylow）
- 误差 < 10% 为合格

#### Block 分布验证
- **双向完整匹配**: 理论 Block 集合 = 实际 Block 集合
- 匹配率 = 匹配 Block 数量 / max(理论 Block 数量，实际 Block 数量) × 100%
- 输出：匹配数量、理论独有、实际独有、匹配率

## 使用方法

```bash
# 验证任意星区
python3 analysis/scripts/verify_sector.py <sector_id>

# 示例
python3 analysis/scripts/verify_sector.py cluster_01_sector001_macro
```

## 验收状态

⏳ **待重新验证**

验证脚本已修正，需要重新运行 4 个典型星区的验证并生成报告
