# build-plan-production-line 需求

## 目标

将建材产线计算从"点击计算建造方案"提前到"勾上建材产线 checkbox"时执行，C 按产线分配拆分为多个 scheme，scheme 按建材产线/生产产线两大分组展示，产线按 groupId 唯一，重叠归入建材分组，依赖图 BFS 融入 isolated 扩展。

## 已确认方案（审核重点）

### 提前计算

- 勾上"建材产线"checkbox 时立即执行：依赖图构建 + SCC 检测 + 建材产线分配
- 结果存入 `useBlueprintProductionStore`
- 点击"计算建造方案"仍需手动触发，基于已有依赖图/分配结果生成完整 scheme（含 steps 明细、费用、时间）
- 提前计算不产出 steps，只产出依赖图 + 分配结果

### 触发时机

- 勾上 checkbox 立即计算一次
- goals 变化时自动重算
- logic-flow 产线/build-flow 数据变化时自动重算

### 依赖图构建算法变更（融入 BFS）

现有 BFS：从 C 的 buildCost 出发，沿 `outputBuildTags` 连线扩散。

**新增 isolated 扩展**（融入同一轮 BFS，不区分两轮）：
- 产线 L 加入图后，同时检查 L 的 isolated 节点
- 在所有 logic-flow groups 中搜索产出该 ware 的产线 B
- 搜索优先级：manual 节点 > auto 节点
- B 已在图中 → 加边 L→B（消费→供给方向，与现有一致）
- B 不在图中 → 加入图，加边 L→B，递归检查 B 的 isolated
- 边方向与现有一致：消费→供给
- **B 自身建材来源**：
  - 若 B 在 buildFlowGroups 中（建材产线区已有定义）→ B 的 buildMaterialTags 作为建材来源继续扩散
  - 若 B 不在 buildFlowGroups 中 → B 的建材来源通过 outputBuildTags 连线查找
  - **无连线时忽略**：buildMaterialTags 无连线或 outputBuildTags 无连线，均不回退搜索其他来源，视为外部供应

### C 按产线分配拆分

- 当前 C 是一个整体 scheme → 变更为按产线分配拆分为多个 scheme
- 每个子 scheme 对应一条已分配的产线
- 每个产线根据自己分配到的 goals 独立 expandGoalDependencies + autoFill
- 未分配到任何产线的 goals 归入"待规划产线"（与现有一致）

### 产线唯一性

- 按 groupId 判断，一条产线只出现在一个分组
- 重叠场景：一条产线同时在依赖图中（产出建材）和产线分配中（产出目标产品）
- 重叠归属：归入建材产线分组，只出一个 scheme
- 重叠计算：建材需求 + 生产需求的速率**叠加相加**

### scheme 卡片分组展示

两大分组：
- **建材产线**：依赖图中的产线 schemes（含重叠产线）
- **生产产线**：C 拆分后不属于建材分组的产线 schemes

建造顺序：先建材后生产，组内按依赖拓扑序。

### SCC 数据

- 存入 store
- 供 computePlan 内部计算使用
- 未来用于 UI 标注循环依赖（当前不展示）

### 约束面板变更

- 勾上"建材产线"后，在现有产线分配区域**上方**新增"建材产线分配"预览区
- 格式与现有产线分配区域一致（目标展示目标，derived 展示 derived）
- derived goal 来源：产线中 isolated 的部分，分配到其他产线
- derived goal 逻辑与现有 `computeProductionLineAllocation` 中 derived goal 逻辑相同
- 待规划产线（unmatched）不参与建材分组检查

### 产线分配逻辑（既有，保持不变）

三级匹配优先级：
1. **Layer 1: Build-flow 材料产出匹配** — outputMaterialTags 中的连线（assignment 或 virtualEdge）
2. **Layer 2: Logic-flow 节点匹配** — manual 节点优先，auto 节点兜底
3. **Layer 3: 待规划产线** — 未命中 goals

派生 goal 生成：
- 检测 logic-flow 中的 isolated 节点是否为 goal 的上游产品（全链路递归）
- 派生 goal 类型 `derived-rate`，初始数量 0，不可编辑/删除
- 实时重算：goals 或 logic-flow 变化时全量重算

## 边界

### In Scope

- 提前计算依赖图 + SCC + 建材产线分配，结果存 store
- C 按产线分配拆分为多个 scheme
- 产线唯一性 + 重叠归建材分组 + 叠加相加
- 依赖图 BFS 融入 isolated 扩展
- scheme 卡片按建材产线/生产产线两大分组展示
- 约束面板新增建材产线分配预览区
- i18n key（分组标题）
- TypeScript 类型定义
- `npm run build` 通过

### Out of Scope

- 修改 build-flow 的数据模型或推导逻辑
- 修改 build-flow 的连线/绑定/分组机制
- checkbox 状态持久化
- SCC 循环依赖的 UI 展示（预留数据，未来实现）
- 编写测试代码
- 产线间模块重叠去重策略（与 build-flow-plan 一致，独立计算）

## 验收标准（DoD）

1. 勾上"建材产线"checkbox 后立即执行依赖图构建 + SCC 检测 + 建材产线分配
2. 依赖图构建正确融入 isolated 扩展（递归，manual > auto 优先级）
3. 新增的边方向为消费→供给（与现有图一致）
4. goals 变化或 logic-flow/build-flow 数据变化时自动重算
5. C 按产线分配拆分为多个 scheme，每个产线独立计算模块
6. 按 groupId 判断产线唯一性，重叠产线归入建材产线分组
7. 重叠产线的建材需求 + 生产需求速率叠加相加
8. scheme 卡片按"建材产线"/"生产产线"两大分组展示
9. 建造顺序：先建材后生产，组内按依赖拓扑序
10. 点击"计算建造方案"仍需手动触发，生成完整 steps 明细
11. SCC 数据存入 store，可供 computePlan 和未来 UI 使用
12. 约束面板在现有产线分配区域上方新增建材产线分配预览
13. 建材产线分配预览格式与现有产线分配区域一致
14. 待规划产线不参与建材分组检查
15. `npm run build` 通过

## 未决项

无
