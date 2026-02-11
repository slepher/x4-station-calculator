# 设计文档: 仓储自动填充 (Storage Auto-Fill)

## 架构 (Architecture)
- **数据源**: Python 脚本从 XML 中提取 `cargo` 属性（包含 capacity 和 type）。
- **核心逻辑**: `moduleDiffCalculator.ts` 复用 `analyzeWareFlow.ts` 的逻辑来计算总容量需求。
- **状态管理**: `useStationStore.ts` 负责协调数据流，传递优先级和模块数据。

## 关键决策 (Key Decisions)
1. **复用 analyzeWareFlow**: 为了保证 UI 仪表盘显示的流量分析与自动填充逻辑的一致性，我们直接调用现有的分析函数，而不是复制一套逻辑。
2. **AutoSupply 独立计算**: 自动补给区被视为一个独立的子系统。我们对其模块列表单独执行一次 `analyzeWareFlow`，计算其内部循环（小麦/肉/香料）及对工业区输出（食物/药）所需的缓冲仓储，并将生成的仓储模块直接归入 `autoSupply` 列表。
3. **增量填充逻辑 (Delta Logic)**: 系统尊重用户手动放置的仓储模块，仅在计算出的需求超过现有容量时，才填充差额。
4. **种族偏好回退**: 优先匹配用户设定的种族。如果没有对应种族的 L 级仓储，则自动回退到任意可用的同类型最大仓储。

## 数据流 (Data Flow)
1. **Main**: `Planned` + `AutoIndustry` -> `analyzeWareFlow` -> `Main Volume` -> (`Main` - `Existing`) -> `AutoIndustry` (Merged)
2. **Supply**: `AutoSupply` -> `analyzeWareFlow` -> `Supply Volume` -> `AutoSupply Storage` -> (Append to `AutoSupply`)

## 变更记录 (Change Log)
- **2026-02-11**: 简化数据结构，不再维护独立的 `autoStorage` 列表，计算出的工业区仓储直接合并入 `autoIndustry`，补给区仓储合并入 `autoSupply`。
