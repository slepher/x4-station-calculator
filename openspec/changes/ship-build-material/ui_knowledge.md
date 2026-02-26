# UI Knowledge: ship-build-material

## 页面入口与标准状态基线

- 页面入口：`船只建造` 视图，选中飞船后显示右侧材料面板。
- 本 change 的执行基线固定为：`状态：标准测试状态-大阪`（不使用大太刀/苍鹭）。

## 状态扩展（本 change 新增）

- 状态 ID：`状态：标准测试状态-大阪-材料分项聚合`
  - 建立动作（基于“状态：标准测试状态-大阪”推断）：
    - 切换到 `slotType=turret`。
    - 在 `group_back_down_mid` 选择 `turret_arg_m_beam_02_mk1`（Argon）。
    - 在 `group_back_mid_up` 选择 `turret_ter_m_beam_02_mk1`（Terran）。
    - 在 `group_down_mid_left` 选择 `turret_arg_m_beam_02_mk1`（Argon，再次选择形成重复 `equipmentId`）。
  - 到位探针（state probes）：
    - 材料分项区出现且仅出现 2 个目标装备分项：
      - `turret_arg_m_beam_02_mk1 x 3`
      - `turret_ter_m_beam_02_mk1 x 1`
    - 该状态用于“装备分项按 ID 聚合”与“分项展开明细”场景。

- 状态 ID：`状态：标准测试状态-大阪-多模块聚合`
  - 建立动作：
    - 切换到 `slotType=turret`。
    - `group_back_down_mid` 选择 `turret_arg_m_beam_02_mk1`。
    - `group_back_mid_up` 选择 `turret_ter_m_beam_02_mk1`。
    - `group_down_mid_left` 选择 `turret_arg_m_beam_02_mk1`（2 连接点）。
    - `group_down_mid_right` 选择 `turret_arg_m_gatling_02_mk1`（2 连接点）。
  - 到位探针（state probes）：
    - 装备分项为：
      - `turret_arg_m_beam_02_mk1 x 3`
      - `turret_ter_m_beam_02_mk1 x 1`
      - `turret_arg_m_gatling_02_mk1 x 2`
    - `default` 下总览数量应为：
      - `energycells=1174`
      - `computronicsubstrate=286`
      - `metallicmicrolattice=507`
      - `advancedelectronics=20`
      - `turretcomponents=54`
      - `siliconcarbide=4`

- 切换路径：`切换：method default -> closedloop -> terran`
  - 建立动作：
    - 在“状态：标准测试状态-大阪-方法测试聚合”基础上操作 method 下拉。
    - 按顺序切换：`default` -> `closedloop` -> `terran`。
  - 到位探针（state probes）：
    - method 下拉应出现 `default`、`closedloop`、`terran` 三个选项。
    - `closedloop` 下：
      - `thruster_gen_l_allround_01_mk1` 显示 `closedloop` 材料集（`antimatterconverters/energycells/engineparts`）。
    - `terran` 下：
      - `thruster_gen_l_allround_01_mk1` 显示 `terran` 材料集（`computronicsubstrate/energycells/metallicmicrolattice/siliconcarbide`）。

- 状态 ID：`状态：标准测试状态-大阪-方法测试聚合`
  - 建立动作（用于 method 选项测试）：
    - 切换到 `slotType=engine`。
    - 在任意 engine 槽位选择 `thruster_gen_l_allround_01_mk1`（含 `default`、`closedloop`、`terran` 三种 method）。
  - 到位探针（state probes）：
    - method 下拉出现 `default`、`closedloop`、`terran` 三个选项。
    - 该状态用于“method 选项聚合”与“method fallback”场景。

- 切换路径：`切换：method default -> closedloop -> terran（使用推进器）`
  - 建立动作：
    - 在“状态：标准测试状态-大阪-方法测试聚合”基础上操作 method 下拉。
    - 按顺序切换：`default` -> `closedloop` -> `terran`。
  - 到位探针（state probes）：
    - `default` 下：`thruster_gen_l_allround_01_mk1` 显示 `antimatterconverters/energycells/engineparts`。
    - `closedloop` 下：`thruster_gen_l_allround_01_mk1` 显示 `antimatterconverters/energycells/engineparts`。
    - `terran` 下：`thruster_gen_l_allround_01_mk1` 显示 `computronicsubstrate/energycells/metallicmicrolattice/siliconcarbide`。

- 切换路径：`切换：method default -> closedloop -> terran（使用炮塔）`
  - 建立动作：
    - 在“状态：标准测试状态-大阪-材料分项聚合”基础上操作 method 下拉。
    - 按顺序切换：`default` -> `closedloop` -> `terran`（由于 terran 不存在于 Argon/Terran 炮塔，会回退到 default）。
  - 到位探针（state probes）：
    - `closedloop` 下：
      - `turret_ter_m_beam_02_mk1` 显示 `default` 材料集（`computronicsubstrate/energycells/metallicmicrolattice/siliconcarbide`）。
      - `turret_arg_m_beam_02_mk1` 显示 `closedloop` 材料集（`claytronics/energycells/hullparts`）。
    - `terran` 下：
      - `turret_arg_m_beam_02_mk1` 回退并显示 `default` 材料集（`advancedelectronics/energycells/turretcomponents`）。
  - 本轮执行备注（2026-02-26）：
    - 在大阪基线下（仅炮塔无 terran），`terran` 选项不出现，路径 `default -> closedloop -> terran` 不可用。
    - 使用推进器 `thruster_gen_l_allround_01_mk1` 可触发完整的 method 切换路径。

## 建议测试定位（新增）

- 材料面板容器：`ship-build-materials-panel`
- method 下拉：`ship-build-material-method-select`
- 总材料汇总行：`ship-build-material-summary`
- 总材料展开区：`ship-build-material-summary-list`
- 装备分项行：`ship-build-material-equipment-group-<equipmentId>`
- 装备分项展开区：`ship-build-material-equipment-list-<equipmentId>`
- 材料价格滑条：`ship-build-material-price-slider`

## 交互语义

1. method 下拉
- 选项来源是 ship/equipment method 聚合集合。
- 切换 method 后，总览和分项金额都应实时刷新。

2. 折叠结构
- 总览行与装备行均复用 `CollapsibleDetailList`。
- 折叠状态默认收起，点击行头切换展开。

3. fallback 语义
- 某条目不存在当前 method 时，回退 `default`。
- fallback 对飞船成本与装备成本一致。
- 回归采样要求：同一轮 fallback 测试需同时覆盖 2 条路径：
  - 推进器 `thruster_gen_l_allround_01_mk1`：`closedloop -> terran -> closedloop`（两种 method 都存在，切换后不需回退）
  - Argon 炮塔 `turret_arg_m_beam_02_mk1`：`terran -> default`（无 terran，回退到 default）
- 固定采样装备与材料切换断言：
  - `thruster_gen_l_allround_01_mk1`（推进器，完整 method 支持）
    - `default`: `antimatterconverters + energycells + engineparts`
    - `closedloop`: `antimatterconverters + energycells + engineparts`（与 default 相同）
    - `terran`: `computronicsubstrate + energycells + metallicmicrolattice + siliconcarbide`
  - `turret_arg_m_beam_02_mk1`（Argon 炮塔）
    - `default`: `advancedelectronics + energycells + turretcomponents`
    - `closedloop`: `claytronics + energycells + hullparts`
    - 切到 `terran` 时应回退并显示 `default` 材料集。

4. 价格滑条语义
- 拖动后仅影响金额显示，不影响数量。
- 建议断言“同一行数量文本不变，金额文本变化”。

## 断言建议

- 可见性：面板、下拉、总览行、滑条可见。
- 结构性：总览展开后出现材料明细；装备行展开后出现对应明细。
- 聚合性：同装备 ID 仅出现一个分项，数量为合计值。
- 多模块正确性：在“大阪-多模块聚合”状态下，总览数量与固定期望值一致。
- 鲁棒性：在 method 不全覆盖场景下无报错且仍有稳定输出（fallback 生效）。
- 定位稳定性：材料明细断言应基于 `.list-item` 行文本（`数量 x 名称`）与 `data-testid` 容器，不依赖 wareId 字段直出。

## 数据样本来源说明

- 飞船与状态切换路径：沿用 `ship-build-equipment` 标准状态文档。
- 本 change 不新增 fixture 文件；测试数据基于现有游戏数据与标准状态构建。

## ShipBlueprint 数据源说明

- **数据源变更**：从 `selectedByConnection` computed 改为 `ShipBlueprint` 的 `blueprint.connections`
- **装备数据获取**：从 `blueprint.connections` 中按 `slot_type` -> `group` 层级获取装备配置
- **船体材料来源**：`ShipBlueprint.hull` 配置，包含船体建造所需的材料列表
- **测试路径**：
  - 新建飞船配装 -> 保存 Blueprint -> 加载 Blueprint -> 验证材料计算一致
  - 确保空 blueprint（未保存时）也能正常计算材料
