# Knowledge: sector-link-calc

## UI 锚点与 Locator 映射

### 中转站视图

| 锚点 | Locator | 说明 |
|------|---------|------|
| 中转视图 Tab 容器 | `[data-testid="view-tab-ui-transit-hub-wareflow"]` | 中转站 tab 切换容器 |
| 数量视图按钮 | `[data-testid="view-tab-btn-transit-hub-wareflow-quantity"]` | 数量维度视图 |
| 仓储视图按钮 | `[data-testid="view-tab-btn-transit-hub-wareflow-volume"]` | 仓储/体积维度视图 |
| 运输视图按钮 | `[data-testid="view-tab-btn-transit-hub-wareflow-transport"]` | 运输维度视图 |
| 经济视图按钮 | `[data-testid="view-tab-btn-transit-hub-wareflow-economy"]` | 经济维度视图 |
| 中转列表容器 | `.list-wrapper` | 中转站流量列表容器 |
| 仓储/运输分组标题 | `.storage-group-header` | 仓储或运输分组标题 |
| 空态容器 | `.empty-container` | 无数据时的空态显示 |

### 星区管理 Tab

| 锚点 | Locator | 说明 |
|------|---------|------|
| 星区中转 Tab | `.supply-tab` (filter by text) | 星区中转入口 Tab |
| 概览 Tab | `.overview-tab` | 返回星区管理概览 |
| 星区输入框 | `.sector-input` | 创建新星区输入框 |
| 星区创建按钮 | `.sector-create-btn` | 创建新星区按钮 |

## Fixture 数据映射

### 货物 (Wares)

| 测试关键词 | Fixture ID | 显示名称 (EN/CN) |
|-----------|------------|------------------|
| 能量电池 | `energycells` | Energy Cells / 能量电池 |
| 金属矿石 | `ore` | Ore / 金属矿石 |
| 精炼金属 | `refinedmetals` | Refined Metals / 精炼金属 |
| 船体部件 | `hullparts` | Hull Parts / 船体部件 |
| 食品配给 | `foodrations` | Food Rations / 食品配给 |
| 医疗物资 | `medicalsupplies` | Medical Supplies / 医疗物资 |

### 模块 (Modules)

| 测试关键词 | Fixture ID | 显示名称 (EN/CN) |
|-----------|------------|------------------|
| 能量电池产线 | `prod_gen_energycells_macro` | Energy Cell Production / 能量电池产线 |
| 精炼金属产线 | `prod_gen_refinedmetals_macro` | Refined Metal Production / 精炼金属产线 |
| 船体部件产线 | `prod_gen_hullparts_macro` | Hull Part Production / 船体部件产线 |

## 核心函数映射

### 单元测试函数

| 函数 | 文件路径 | 用途 |
|------|----------|------|
| `solveSingleWareDistancePull` | `src/store/logic/sectorLinkFlow.ts` | 单货物距离优先分配算法 |
| `solveMultiWareByLink` | `src/store/logic/sectorLinkFlow.ts` | 多货物链路级流量聚合 |
| `splitSectorNetwork` | `src/store/logic/sectorLinkFlow.ts` | 网络连通性分割 |
| `getSectorNetworkComponent` | `src/store/logic/sectorLinkFlow.ts` | 获取星区所属网络组件 |
| `buildTransitHubStorageFlows` | `src/store/logic/transitHubViewModel.ts` | 中转站仓储流量构建 |
| `buildStationComponentGapFlows` | `src/store/logic/stationGapViewModel.ts` | 星区子网缺口流量构建 |

### 输出结构

#### `SolveSingleWareDistancePullOutput`
- `linkFlows`: 边级流量列表 `{ linkId, from, to, amount }`
- `unmetDemand`: 未满足需求列表 `{ sectorId, amount }`
- `unusedSupply`: 未使用供给列表 `{ sectorId, amount }`
- `allocatedDemandBySector`: 按星区汇总的已分配需求
- `deficitSummary`: 缺口汇总 `{ totalDeficit }`

#### `SolveMultiWareByLinkOutput`
- `linkWareFlows`: 按货物分组的边级流量 `{ linkId, wareId, from, to, amount }`
- `allocatedDemandBySector`: 按星区汇总，包含 `byWare` 维度
- `deficitSummary`: 包含 `deficitByNode` 和 `producerNodes`

## 测试数据场景

### Empire 3 (中转测试)
- 生产星区 (`production-sector`): 有空间站
- 补给星区 (`supply-sector`): 有空间站
- 星区连接: 两个星区之间有链路
- 用于测试中转流量生成和 tab 切换缓存

## 方向语义

### 外部条目文案
- **输入**: 外星区 -> 本星区，显示绿色 `输入` 标签
- **输出**: 本星区 -> 外星区，显示红色 `输出` 标签

### 本地条目文案
- **产出**: 本地空间站净产出
- **消耗**: 本地空间站净消耗

## 测试运行

### 测试缺陷修复记录

- [✓] E2E fixture 路径问题
  - 问题: 测试文件位于 `tests/e2e/sector-link-calc/` 时，fixture 导入路径 `../fixtures/db.json` 解析错误
  - 解决: 改为 `../../fixtures/db.json`

- [✓] E2E locator 过滤器问题
  - 问题: `.filter({ hasText: /生产星区|补给星区/ })` 返回多个元素时 `expect().toBeVisible()` 失败
  - 解决: 添加 `.first()` 选择第一个匹配元素

- [✓] ViewTab active class 检查问题
  - 问题: 页面加载后默认视图可能不是 quantity，导致 `toHaveClass(/active/)` 失败
  - 解决: 移除非必要的默认视图断言，只验证切换后的目标视图状态

- [✓] Bug 4.1 单元测试 vs E2E 测试
  - 问题: E2E 测试尝试访问 `window.sectorLinkFlow` 但函数未暴露到浏览器环境
  - 解决: 算法级测试应在单元测试中覆盖，E2E 测试改为验证 UI 功能正常