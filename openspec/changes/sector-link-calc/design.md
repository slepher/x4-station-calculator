# sector-link-calc 设计说明

## 设计目标
在保持现有 UI 结构与产物显示规则的前提下，重构缺口与中转需求的计算域与数据模型：
- 缺口展示从“全帝国”改为“当前星区子网”。
- 中转站需求从“仅本地空间站”扩展为“本地 + 外星区一跳中转贡献”。
- 本地与外部贡献统一进入同一公式口径，避免双轨计算。

## 1. 总体架构

### 1.1 两条计算链路
- 链路 A（空间站缺口开关）：
  - 输入：当前空间站、其所属星区、子网范围内的站/星区聚合数据。
  - 输出：按产物归并的合并明细（本星区按站 + 其他星区按星区）。
- 链路 B（中转站存储/运输）：
  - 输入：本星区本地贡献 + 一跳边外部贡献。
  - 输出：统一口径下的存储/运输需求与明细。

### 1.2 纯函数角色
- `splitSectorNetwork` / `getSectorNetworkComponent`：确定子网边界。
- `solveMultiWareByLink`：提供连接级边流与缺口摘要（container 范围）。
- 允许调整纯函数输出结构，新增适配字段以减少 UI 侧二次推导成本。

## 2. 数据模型设计

### 2.1 缺口明细统一模型（建议）
- `WareGapDetailEntry`
  - `wareId`
  - `sourceType: 'station' | 'sector'`
  - `sourceId`
  - `sourceName`
  - `productionRate`
  - `consumptionRate`
  - `netRate`
- 说明：
  - 本星区站点条目：`sourceType='station'`
  - 其他星区条目：`sourceType='sector'`

### 2.2 中转增量明细模型（建议）
- `TransitExternalContribution`
  - `wareId`
  - `peerSectorId`
  - `peerSectorName`
  - `direction: 'in' | 'out'`
  - `rate`（每小时）
- 一跳边规则：仅保留“本星区与连接星区”的边流贡献。

### 2.3 中转面板合并模型（建议）
- `TransitMergedRateByWare`
  - `localProductionRate`
  - `localConsumptionRate`
  - `externalInRate`
  - `externalOutRate`
  - `productionRate = localProductionRate + externalOutRate`
  - `consumptionRate = localConsumptionRate + externalInRate`

## 3. 关键流程

### 3.1 缺口开关流程
1. 获取当前空间站 `sectorId`，若为空直接返回空结果。
2. 基于 `getSectorNetworkComponent` 获取子网。
3. 按现有规则筛选产物（保持旧规则不变）。
4. 对每个产物生成合并明细：
   - 本星区：按空间站拆分条目。
   - 其他星区：按星区聚合条目。
5. 按产物输出明细列表给现有缺口 UI。

### 3.2 中转站存储/运输流程
1. 计算本星区本地贡献（沿用现有本地逻辑）。
2. 从纯函数边流中过滤“与本星区相邻的一跳边贡献”。
3. 生成外部贡献：
   - 本星区->外星区：记为输出（production 侧）。
   - 外星区->本星区：记为输入（consumption 侧）。
4. 本地+外部贡献合并到统一 `production/consumption/net`。
5. 套用现有公式（buffer 固定 12h）生成存储/运输结果与明细。

## 4. 公式统一

### 4.1 存储
- `productionStorageVolume = productionRate * unitVolume * 12`
- `consumptionStorageVolume = consumptionRate * unitVolume * 12`
- `totalRequiredStorageVolume = max(productionStorageVolume, consumptionStorageVolume)`

### 4.2 运输
- `transportVolume = abs(netRate) * unitVolume`

## 5. 兼容与迁移策略
- 不改现有交互入口与开关位置，仅替换其数据源。
- 本次不新增用户配置项；12h 写死于中转增量链路。
- 对未分配星区空间站保持“开关无效”行为，避免误导数据。

## 6. 风险与对策
- 风险：外部贡献与本地贡献重复计入。
  - 对策：明确一跳边过滤条件，外部贡献只取边流，不取本地站点聚合。
- 风险：旧规则与新口径混用导致展示跳变。
  - 对策：保持旧产物显示规则不变，仅替换计算域与数据合并层。
- 风险：纯函数输出不足以支持一跳明细。
  - 对策：允许增补接口字段（如按边按产物聚合映射）减少 UI 推导。

## 7. 后续增补设计（本次同步）

### 7.1 纯函数执行上移与缓存
- 将中转纯函数执行从 `TransitHubWorkbench` 下沉到 `useEmpireStore` 计算层。
- 产出 `sectorLinkCalcMap`，按“当前查看星区”缓存：
  - `allowedWareIds`
  - `sectorsInput`
  - `solverOutput`
- UI 侧改为读取缓存结果，避免 tab 切换触发重复求解。

### 7.2 输入过滤与空星区回退
- 输入阶段采用“类别口径”筛选产物（不以 `netRate` 先行裁剪）。
- 当查看星区无本地站导致允许产物集为空时：
  - 回退到“连接且有空间站的星区”产物并集，保证中转可视。

### 7.3 正确性修复
- 边流 key 由字符串拼接改为结构化编码，避免 `linkId` 含 `|` 时解析错位。
- 修复后保证 `allocatedDemand` 与 `linkWareFlows` 的方向/节点一致性。

### 7.4 视图展示一致性
- 仓储/运输明细标签规则：
  - 外星区条目：`输入/输出`（输入绿、输出红）
  - 本星区空间站：`产出/消耗`（保持原规则）
- 仓储/运输分组标题与内容同显同隐：
  - 无数据仅显示空态，不显示分组标题。
- `storageItems/transportItems` 在上游过滤零值条目，避免空壳组。

### 7.5 Tab 可达性
- 星区中转 tab 显示规则：
  - 仅当“本星区有站”或“连接到有站星区”时显示。
- 当 tab 栏超出可视范围时，显示左右滚动按钮并支持平滑横移。
