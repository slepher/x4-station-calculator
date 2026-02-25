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
    - 在“状态：标准测试状态-大阪-材料分项聚合”基础上操作 method 下拉。
    - 按顺序切换：`default` -> `closedloop` -> `terran`。
  - 到位探针（state probes）：
    - `closedloop` 下：
      - `turret_ter_m_beam_02_mk1` 显示 `default` 材料集（`computronicsubstrate/energycells/metallicmicrolattice/siliconcarbide`）。
      - `turret_arg_m_beam_02_mk1` 显示 `closedloop` 材料集（`claytronics/energycells/hullparts`）。
    - `terran` 下：
      - `turret_arg_m_beam_02_mk1` 回退并显示 `default` 材料集（`advancedelectronics/energycells/turretcomponents`）。

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
  - Terran 装备：`closedloop -> default`（`turret_ter_m_beam_02_mk1`）
  - Argon 装备：`terran -> default`（`turret_arg_m_beam_02_mk1`）
- 固定采样装备与材料切换断言：
  - `turret_arg_m_beam_02_mk1`
    - `default`: `advancedelectronics + energycells + turretcomponents`
    - `closedloop`: `claytronics + energycells + hullparts`
    - 切到 `terran` 时应回退并显示 `default` 材料集。
  - `turret_ter_m_beam_02_mk1`
    - `default`: `computronicsubstrate + energycells + metallicmicrolattice + siliconcarbide`
    - 切到 `closedloop` 时应回退并显示 `default` 材料集。

4. 价格滑条语义
- 拖动后仅影响金额显示，不影响数量。
- 建议断言“同一行数量文本不变，金额文本变化”。

## 断言建议

- 可见性：面板、下拉、总览行、滑条可见。
- 结构性：总览展开后出现材料明细；装备行展开后出现对应明细。
- 聚合性：同装备 ID 仅出现一个分项，数量为合计值。
- 多模块正确性：在“大阪-多模块聚合”状态下，总览数量与固定期望值一致。
- 鲁棒性：在 method 不全覆盖场景下无报错且仍有稳定输出（fallback 生效）。

## 数据样本来源说明

- 飞船与状态切换路径：沿用 `ship-build-equipment` 标准状态文档。
- 本 change 不新增 fixture 文件；测试数据基于现有游戏数据与标准状态构建。
