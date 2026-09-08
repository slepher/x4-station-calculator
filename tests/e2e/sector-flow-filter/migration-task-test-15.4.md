# M15.4 核查记录 — done（二审 oracle 已闭合）

基线为 1 pass / 2 fail；这是修复前历史记录。三个原用例均已保留并迁移到独立 expected，未删除验收项、未增加 skip/fixme/only。

| 原用例 | 当前事实与待完成映射 |
|---|---|
| 小行星星区聚合 flows 应只显示三个 station 的 planned ware 作为 surplus | 用户动作：进入 live-production，点击 `cluster_100_sector001_macro`。独立 ledger 来源为 `tests/fixtures/db.json:15–134,395`（binding、sector/group）、`tests/fixtures/save/save_old.json:5562,10826,12540`（KXN/MGO/EOF station records）、`src/assets/x4_game_data/8.0-Diplomacy/data/modules.json:5221–5258,5453–5485,6656–6688`（module outputs/inputs/workforce）及 `maps.json:25017`（Mercury sunlight `7.14`）。Energy 为 `12×3000×7.14 − (360+480+1200+900) = 254100`；四个消耗项依次对应 MGO planned fieldcoils、derived plasmaconductors、derived graphene、derived superfluidcoolant。Quantum 链为 MGO local `−258`；EOF explicit `2×470 − 5×400 + auto 3×470 = +350`；分配前 sector nets 为 cluster100 `−258`、cluster601 `+350`、cluster48 `−92`，总和为 `0`。 |
| 单个 station flows 显示原始数据（含 auto-industry surplus） | 用户动作：在同一星区点击 `MGO-010`。Products 精确集合为 fieldcoils `+1050.0`、energycells `+33060.0`、plasmaconductors `+112.0`、graphene `+672.0`、superfluidcoolant `+305.0`；Operations 精确集合仅 quantumtubes `-258.0`；资源组不参与本项 expected。 |
| 小行星聚合 flows 详细快照（基准数据） | 用户动作：点击星区后读取产品组。按 `src/store/state/StationDerivedMap.ts:786–839,873–875` 与 `src/store/logic/sectorLinkFlow.ts:534–651` 的无向 link solver，供应→需求路径为 `cluster601 → cluster48 → cluster100`：第一条边 allocation `350`（满足 cluster48 的 `92` 和下游 `258`），第二条边 allocation `258`；分配后各 sector residual 均为 `0`。cluster100 的 external `+258` 抵消 local `−258`，最终 Quantum 为 `0`。Products 精确允许集合为反物质转换器 `+3192.0`、励磁线圈 `+2100.0`、电子基质 `+5880.0`、碳化硅 `+5760.0`、能量电池 `+254100.0`、金属微晶 `+37760.0`、量子管 `+0.0`；全 panel 的 quantumtubes 仅一行，Operations 不含 quantumtubes，拒绝额外 product ware。 |

规范证据：live-planning-modules（recommended/effective planned、priority2）、live-planning-flow（canonical flow）、one-flow-contribution（统一派生入口）、sector-link-calc（一跳外部贡献）。静态 ledger 与 PORT=22654 的 3/3 E2E 共同完成验收。
