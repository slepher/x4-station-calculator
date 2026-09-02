# Recycling Flow

## 目标

让 Scrap Processor、Scrap Recycler 及其 Kha'ak/Terran 变体进入同一套权威生产数据和规划链路：Logic Flow 能建立独立回收产线，Station 与 Build Plan 能正确补齐 Scrap Metal 等中间产物，同时普通 Hull Parts 等产线不会误选回收模块。

## 已确认方案（审核重点）

### Processor 数据与产率

- 数据处理器 SHALL 解析 `class="processingmodule"` 模块的 `<properties><products>`，并结合对应 Ware 的 `method="processing"` recipe 生成模块小时率。
- `<products><ware amount>` 表示模块每周期处理的 recipe 批量；输入按 `moduleProductAmount / recipeOutputAmount` 等比例放大。
- Generic Scrap Processor `module_gen_proc_scrapworks` SHALL 生成：
  - `scrapmetal: 9000/h`；
  - `rawscrap: 9000/h`；
  - `energycells: 90000/h`；
  - `cycleTime: 60s`。
- Kha'ak Scrap Processor `module_gen_proc_scrapworkskhaak_01` SHALL 生成：
  - `khaakscrapmetal: 3000/h`；
  - `rawkhaakscrap: 3000/h`；
  - `energycells: 30000/h`；
  - `cycleTime: 60s`。
- Processor 保持 `type="processingmodule"`；本次不依赖为其新增 `method` 枚举值。
- Processor 没有 workforce 配置，基础小时率不应用 workforce bonus。

### Logic Flow 回收子类型

- 工业候选区新增 `recycling` 子类型，候选 Ware 包含 `method="recycling"` 模块的全部 outputs 及其普通上游链；Tier 1 Processor 产物允许添加，Tier 0 只展示且不可添加。
- 普通生产者选择 SHALL 接受非 recycling 的 `production` 与 `processingmodule`，并排除所有 `method="recycling"` 模块。
- recycling 手动根节点 SHALL 使用回收模块选择规则：`recycling + output wareId` 定位唯一 Recycler，无需额外 module selector 或 recipe 信息。
- Recycler 的自动上游 SHALL 回到普通生产者规则，形成：
  - Generic/Terran Recycler → `scrapmetal` → Generic Scrap Processor → `rawscrap + energycells`；
  - Kha'ak Recycler → `khaakscrapmetal` → Kha'ak Scrap Processor → `rawkhaakscrap + energycells`。
- `rawscrap`、`rawkhaakscrap`、`nividium` 等没有生产模块的 Ware 保持资源边界；`energycells` 继续解析为能源生产模块。
- 同一多产出 Recycler 通过任意 output 添加时，按 moduleId 去重，只创建一个模块节点；需要展示或高亮其产物时 SHALL 覆盖该模块的全部 outputs。

### 保存与导出

- 保持现有 module-centric 持久化：手动节点保存 moduleId，isolated 节点保存 wareId，不新增 recipe snapshot 或 selected-output 字段。
- 自动上游节点不保存；加载 Logic Flow 时根据手动模块的 inputs 重新展开。
- Logic Flow 导入 Station 时继续按 moduleId 聚合手动模块；Recycler 的全部 outputs/inputs 从当前版本 `modulesMap` 读取。
- 若用户把自动 Processor 提升为手动节点，则 Processor moduleId 也进入保存和 Station 导入；否则由目标环境自动补全。

### Station 与规划生产者规则

- Station 自动补全 SHALL 允许非 recycling 的 `production` 和 `processingmodule` 成为生产者。
- `solid`/`liquid` transport 不再直接等价于不可生产资源；是否可自产以是否存在合格生产模块为准。
- 普通 Hull Parts、Claytronics、Computronic Substrate、Silicon Carbide 等缺口 SHALL NOT 选择 Recycler。
- Recycler 造成 `scrapmetal`/`khaakscrapmetal` 缺口时 SHALL 自动添加对应 Processor；Processor 的 Raw Scrap 输入因无生产模块自然停止展开。
- Station 的净流量计算继续遍历模块完整 outputs/inputs，多产出 Recycler 只计一个模块，不做 `cycleTime` 二次换算。

### Build Plan 与 Build Flow

- Build Plan 所有按 Ware 查找生产者和递归展开依赖的路径 SHALL 使用与 Station 一致的生产者规则，不再用 transport 或 `type === "production"` 预判上游是否存在。
- Logic Flow 已提供明确 moduleId 时，Build Plan SHALL 保留该模块选择；普通 Ware 目标重新选择模块时仍排除 Recycler。
- Processor SHALL 可进入推荐/参考生产模块基线，Recycler 仍不作为普通自动生产者。
- `recycling` 子类型的 Logic Flow 组 SHALL NOT 进入 Build Flow 建筑产线：不生成建筑产线卡片、产物连接或责任归属。
- Recycler 仍可作为显式 `build-module` 建造目标；“不进入 Build Flow”不禁止计算其建造成本或 Station 产能。

### UI 分层

- recycling 候选入口的新增 UI SHALL 遵守 `store -> presenter -> vue`：store 提供领域状态与选择能力，presenter 组装候选标签和交互数据，Vue 不新增直接 store 访问。

## 边界

### In Scope

- 解析 Generic/Kha'ak `processingmodule` 的 `<products>` 及 processing recipe 小时率。
- Logic Flow 工业 `recycling` 子类型、Recycler 根节点选择、Processor 自动上游与多产出高亮。
- Logic Flow 保存、恢复、Station 导入和 Build Plan moduleId 传播的一致性。
- Station、Build Plan、Live/Blueprint 共用生产者规则对 `processingmodule` 的支持。
- Build Plan 递归依赖、责任匹配和推荐模块基线的 processor 支持。
- 从 Build Flow 建筑产线中排除 recycling 组。
- 8.0 与 9.0 游戏数据重新生成及构建验证。

### Out of Scope

- Processor 的拖船数量、投递距离、排队、停机时间或实际 uptime 模型。
- Processor workforce bonus、Recycler 每个 output 独立 workforce 精度。
- 为多产出模块拆分多个模块节点、保存 selected-output 或 recipe snapshot。
- 让 recycling 组参与 Build Flow 建筑材料供应关系。
- 全面重构现有 race、lineage 与 method 类型体系。
- 本文档阶段编写或运行 Unit/E2E 测试；测试由后续测试工作流维护。

## 验收标准（DoD）

1. 两个 Scrap Processor 在 8.0/9.0 生成数据中包含正确 cycleTime、outputs 与 inputs 小时率。
2. 工业候选区存在 recycling 子类型，显示 Recycler outputs、Tier 1 Processor 产物与 Tier 0 输入；任意 Recycler output 添加唯一 Recycler，Tier 1 添加 Processor，Tier 0 不可添加。
3. 普通 Hull Parts 等产线始终选择普通生产模块，不误选 Recycler。
4. Generic/Terran Recycler 的 Logic Flow 上游包含 Generic Scrap Processor；Kha'ak Recycler 上游包含 Kha'ak Scrap Processor。
5. Raw Scrap 类资源停在资源边界，Energy Cells 正常添加能源模块。
6. Logic Flow 保存/恢复及导入 Station 后，Recycler moduleId 保持不变，多产出模块不重复添加。
7. Station 中 Recycler 的 Scrap Metal 缺口会自动补对应 Processor，并按全部 outputs/inputs 计算流量。
8. Build Plan 能展开 `Recycler -> Processor -> Energy Cells`，且不会因 `scrapmetal` 为 solid 或 processor 类型而中断。
9. 普通 Ware 的 Build Plan 自动选择不使用 Recycler；显式 Recycler moduleId 仍被保留。
10. recycling Logic Flow 组不出现在 Build Flow 建筑产线卡片、连接或责任归属中。
11. 多产出 Recycler 的产物高亮覆盖全部 outputs，但模块数量只计算一次。
12. `npm run build` 通过。

## 未决项

无。
