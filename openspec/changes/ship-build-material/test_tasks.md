# Test Tasks: ship-build-material

## 1. Unit Tests（Vitest）

- [x] 1.0 method 选项过滤 xenon
  - [x] 步骤 1：准备固定输入：飞船、装备均包含 xenon manufacturing method。
  - [x] 步骤 2：执行 method 选项聚合。
  - [x] 步骤 3：断言结果不包含 `xenon` 选项。

- [x] 1.1 method 选项聚合
  - [x] 步骤 1：准备固定输入：飞船 `ship_ter_l_destroyer_01_a`（terran，只有 default），推进器 `thruster_gen_l_allround_01_mk1`（有 default, closedloop），炮塔 `turret_arg_m_beam_02_mk1`（有 default, closedloop）。
  - [x] 步骤 2：执行 method 选项聚合。
  - [x] 步骤 3：断言结果过滤 xenon 后为 `default`, `closedloop`。

- [x] 1.2 method fallback（飞船）
  - [x] 步骤 1：准备飞船 `ship_ter_l_destroyer_01_a`（仅含 `default`），当前 method 设为 `closedloop`。
  - [x] 步骤 2：执行飞船材料计算。
  - [x] 步骤 3：断言飞船仍使用 `default` 成本：`computronicsubstrate=281`、`energycells=1034`、`metallicmicrolattice=471`。

- [x] 1.3 method fallback（装备）
  - [x] 步骤 1：准备装备 `turret_ter_m_beam_02_mk1`（仅含 `default`），当前 method 设为 `closedloop`。
  - [x] 步骤 2：执行装备材料计算。
  - [x] 步骤 3：断言装备使用 `default` 成本：`computronicsubstrate=5`、`energycells=100`、`metallicmicrolattice=36`、`siliconcarbide=4`。

- [x] 1.4 装备分项按 equipmentId 聚合
  - [x] 步骤 1：准备选择映射：`group_back_down_mid=turret_arg_m_beam_02_mk1`、`group_back_mid_up=turret_ter_m_beam_02_mk1`、`group_down_mid_left(2个连接点)=turret_arg_m_beam_02_mk1`。
  - [x] 步骤 2：执行分项聚合。
  - [x] 步骤 3：断言分项为 `turret_arg_m_beam_02_mk1 x 3` 与 `turret_ter_m_beam_02_mk1 x 1`。

- [x] 1.5 总材料合并规则
  - [x] 步骤 1：准备默认 method 下的固定输入（同 1.4）。
  - [x] 步骤 2：执行总览汇总。
  - [x] 步骤 3：断言总览材料数量至少包含并等于：`energycells=1164`、`computronicsubstrate=286`、`metallicmicrolattice=507`、`advancedelectronics=18`、`turretcomponents=30`、`siliconcarbide=4`。

- [x] 1.6 价格倍率只影响金额
  - [x] 步骤 1：使用同一输入分别计算 `priceMultiplier=0` 与 `priceMultiplier=1`。
  - [x] 步骤 2：比较结果。
  - [x] 步骤 3：断言每种材料 `count` 完全一致，`value` 发生变化。

- [ ] 1.7 船体材料独立计算
  - [ ] 步骤 1：准备 ShipBlueprint 包含 hull 配置（如 ship_ter_m_corvette_02_a）。
  - [ ] 步骤 2：执行材料计算。
  - [ ] 步骤 3：断言总材料包含船体材料（独立于 production cost）。
  - [ ] 步骤 4：断言材料分项中存在船体独立分项，显示格式为"Odachi x 1"（船体名称 x 1）。

- [ ] 1.8 船体分项展开显示材料明细
  - [ ] 步骤 1：准备 ShipBlueprint 包含 hull 配置。
  - [ ] 步骤 2：执行材料计算。
  - [ ] 步骤 3：展开船体分项（如"Odachi x 1"）。
  - [ ] 步骤 4：断言分项内显示船体对应材料明细（如 hullparts）。

- [ ] 1.9 数据源 ShipBlueprint
  - [ ] 步骤 1：准备 blueprint.connections 包含装备配置。
  - [ ] 步骤 2：从 blueprint 计算装备分项。
  - [ ] 步骤 3：断言结果与 blueprint.connections 数据一致。

## 2. Bootstrapping & State（E2E）

### 2.1 method 选项过滤 xenon（通用）

- [ ] 2.1.1 验证：method 下拉不包含 xenon 选项
  - [ ] 步骤 1：进入 Ship Build 界面，选择任意飞船和装备。
  - [ ] 步骤 2：打开 method 下拉。
  - [ ] 步骤 3：断言下拉选项中不包含 `xenon`。

### 2.2 大太刀 - 护盾 fallback 测试场景

测试目标：验证当 method=closedloop 时，护盾 `shield_ter_m_standard_02_mk2`（仅支持 default）fallback 到 default。

- [ ] 2.2.1 状态：大太刀标准测试状态
  - [ ] 步骤 1：进入 Ship Build 界面。
  - [ ] 步骤 2：筛选 class=M, race=terran，选择飞船"大太刀"（ship_ter_m_corvette_02_a）。
  - [ ] 步骤 3：断言材料面板、method 下拉、总材料汇总行可见且无报错。

- [ ] 2.2.2 状态：大太刀-护盾配置（shield_ter_m_standard_02_mk2）
  - [ ] 步骤 1：先进入"状态：大太刀标准测试状态"。
  - [ ] 步骤 2：切换到 `slotType=shield`。
  - [ ] 步骤 3：选择护盾 `shield_ter_m_standard_02_mk2`（该护盾仅支持 default manufacturing）。
  - [ ] 步骤 4：断言护盾分项出现。

- [ ] 2.2.3 状态：大太刀-推进器配置（thruster_gen_m_allround_01_mk1）
  - [ ] 步骤 1：继续"状态：大太刀-护盾配置"。
  - [ ] 步骤 2：切换到 `slotType=engine`。
  - [ ] 步骤 3：选择推进器 `thruster_gen_m_allround_01_mk1`（该推进器支持 default, closedloop, terran）。
  - [ ] 步骤 4：断言推进器分项出现。

- [ ] 2.2.4 验证：method 选项包含 closedloop
  - [ ] 步骤 1：进入"状态：大太刀-推进器配置"。
  - [ ] 步骤 2：断言 method 下拉出现 `default`、`closedloop` 选项（过滤 xenon）。
  - [ ] 步骤 3：确认选项中不包含 `terran`（因为护盾仅支持 default，推进器虽然支持 terran 但被过滤或取交集）。

- [ ] 2.2.5 切换：method default -> closedloop，验证护盾 fallback
  - [ ] 步骤 1：进入"状态：大太刀-推进器配置"。
  - [ ] 步骤 2：method 保持 `default`，记录护盾 `shield_ter_m_standard_02_mk2` 的材料成本。
  - [ ] 步骤 3：切换 method 为 `closedloop`。
  - [ ] 步骤 4：断言护盾仍使用 `default` 成本（fallback 生效），材料数量不变。
  - [ ] 步骤 5：断言总材料金额因推进器从 default 变为 closedloop 而变化。

### 2.3 大阪 - Argon 炮塔 fallback 测试场景

测试目标：验证当 method=terran 时，Argon 炮塔 `turret_arg_m_beam_02_mk1`（仅支持 default, closedloop）fallback 到 default。

- [ ] 2.3.1 状态：大阪标准测试状态
  - [ ] 步骤 1：进入 Ship Build 界面。
  - [ ] 步骤 2：筛选 class=L, race=argon，选择飞船"大阪"（ship_arg_l_destroyer_01_a）。
  - [ ] 步骤 3：断言材料面板、method 下拉、总材料汇总行可见且无报错。

- [ ] 2.3.2 状态：大阪-推进器配置（thruster_gen_l_allround_01_mk1）
  - [ ] 步骤 1：先进入"状态：大阪标准测试状态"。
  - [ ] 步骤 2：切换到 `slotType=engine`。
  - [ ] 步骤 3：选择推进器 `thruster_gen_l_allround_01_mk1`（该推进器支持 default, closedloop, terran）。
  - [ ] 步骤 4：断言推进器分项出现。

- [ ] 2.3.3 状态：大阪-炮塔配置（turret_arg_m_beam_02_mk1）
  - [ ] 步骤 1：继续"状态：大阪-推进器配置"。
  - [ ] 步骤 2：切换到 `slotType=turret`。
  - [ ] 步骤 3：选择炮塔 `turret_arg_m_beam_02_mk1`（该炮塔支持 default, closedloop，不支持 terran）。
  - [ ] 步骤 4：断言炮塔分项出现。

- [ ] 2.3.4 验证：method 选项包含 terran
  - [ ] 步骤 1：进入"状态：大阪-炮塔配置"。
  - [ ] 步骤 2：断言 method 下拉出现 `default`、`closedloop`、`terran` 选项（推进器支持 terran）。

- [ ] 2.3.5 切换：method default -> terran，验证 Argon 炮塔 fallback
  - [ ] 步骤 1：进入"状态：大阪-炮塔配置"。
  - [ ] 步骤 2：method 保持 `default`，记录炮塔 `turret_arg_m_beam_02_mk1` 的材料成本。
  - [ ] 步骤 3：切换 method 为 `terran`。
  - [ ] 步骤 4：断言炮塔仍使用 `default` 成本（fallback 生效），材料数量不变。
  - [ ] 步骤 5：断言总材料金额因推进器从 default 变为 terran 而变化。

### 2.4 原有测试场景保留

- [x] 2.4.1 状态：标准测试状态-大阪（保留）
  - [x] 步骤 1：按 `ship-build-equipment` 标准路径进入"状态：标准测试状态-大阪"。
  - [x] 步骤 2：断言材料面板、method 下拉、总材料汇总行可见且无报错。

- [x] 2.4.2 状态：标准测试状态-大阪-材料分项聚合（保留）
  - [x] 步骤 1：先进入"状态：标准测试状态-大阪"。
  - [x] 步骤 2：在配装区切换到 `slotType=turret`。
  - [x] 步骤 3：进入 `group_back_down_mid` 并选择 Argon 装备 `turret_arg_m_beam_02_mk1`。
  - [x] 步骤 4：进入 `group_back_mid_up` 并选择 Terran 装备 `turret_ter_m_beam_02_mk1`。
  - [x] 步骤 5：进入 `group_down_mid_left` 并再次选择 `turret_arg_m_beam_02_mk1`（形成重复 `equipmentId`）。
  - [x] 步骤 6：断言材料分项区出现以下两个分项：`turret_arg_m_beam_02_mk1 x 3`、`turret_ter_m_beam_02_mk1 x 1`。

- [x] 2.4.3 切换：method 变更（使用推进器完整测试）（保留）
  - [x] 步骤 1：进入"状态：标准测试状态-大阪-方法测试聚合"（推进器+炮塔）。
  - [x] 步骤 2：断言 method 下拉出现 `default`、`closedloop` 选项（terran 未出现因推进器槽无该选项）。
  - [x] 步骤 3：切换 method 为 `closedloop`，断言总材料金额变化。
  - [x] 步骤 4：断言切换成功，无报错。

- [x] 2.4.4 状态：标准测试状态-大阪-多模块聚合（保留）
  - [x] 步骤 1：先进入"状态：标准测试状态-大阪"。
  - [x] 步骤 2：在配装区切换到 `slotType=turret`。
  - [x] 步骤 3：`group_back_down_mid` 选择 `turret_arg_m_beam_02_mk1`。
  - [x] 步骤 4：`group_back_mid_up` 选择 `turret_ter_m_beam_02_mk1`。
  - [x] 步骤 5：`group_down_mid_left` 选择 `turret_arg_m_beam_02_mk1`（该组 2 个连接点）。
  - [x] 步骤 6：`group_back_mid_mid` 选择 `turret_arg_m_gatling_02_mk1`（该组 2 个连接点）。
  - [x] 步骤 7：断言分项聚合结果为：
    - [x] `turret_arg_m_beam_02_mk1 x 3`
    - [x] `turret_ter_m_beam_02_mk1 x 1`
    - [x] `turret_arg_m_gatling_02_mk1 x 2`

- [x] 2.4.5 状态：标准测试状态-大阪-方法测试聚合（推进器+炮塔）（保留）
  - [x] 步骤 1：进入"状态：标准测试状态-大阪"。
  - [x] 步骤 2：切换到 `slotType=engine`。
  - [x] 步骤 3：在任意 engine 槽选择装备。
  - [x] 步骤 4：切换到 `slotType=turret`。
  - [x] 步骤 5：在任意 turret 槽选择装备。
  - [x] 步骤 6：断言 method 下拉出现 `default`、`closedloop`（过滤 xenon）。

## 3. Scenario Content（E2E）

- [x] 3.1 场景：总材料折叠明细展示
  - [x] 步骤 1：进入"状态：标准测试状态-大阪-材料分项聚合"（保持 method=`default`）。
  - [x] 步骤 2：展开"总材料 xxxCr"。
  - [x] 步骤 3：断言总览明细可见。

- [x] 3.2 场景：装备分项按 ID 聚合展示
  - [x] 步骤 1：进入"状态：标准测试状态-大阪-材料分项聚合"。
  - [x] 步骤 2：观察材料分项列表。
  - [x] 步骤 3：断言出现装备分项。

- [x] 3.3 场景：装备分项展开明细
  - [x] 步骤 1：进入"状态：标准测试状态-大阪-材料分项聚合"，展开装备分项。
  - [x] 步骤 2：断言分项明细可见。

- [x] 3.4 场景：method 切换时 fallback 生效
  - [x] 步骤 1：进入"状态：标准测试状态-大阪-方法测试聚合"（推进器+炮塔）。
  - [x] 步骤 2：method=`default` 记录各分项材料。
  - [x] 步骤 3：切换 method 为 `closedloop`，断言材料金额变化。
  - [x] 步骤 4：断言 fallback 生效。

- [x] 3.5 场景：价格滑条联动
  - [x] 步骤 1：进入"状态：标准测试状态-大阪"，记录总览金额。
  - [x] 步骤 2：将材料价格滑条拖动。
  - [x] 步骤 3：断言金额发生变化。

- [x] 3.6 场景：多模块聚合下材料数量正确
  - [x] 步骤 1：进入"状态：标准测试状态-大阪-多模块聚合"。
  - [x] 步骤 2：断言材料面板显示正确。

### 3.7 新增 fallback 场景

- [ ] 3.7.1 场景：大太刀护盾 fallback（method=closedloop）
  - [ ] 步骤 1：进入"状态：大太刀-推进器配置"（护盾 + 推进器）。
  - [ ] 步骤 2：method=`default` 记录护盾 `shield_ter_m_standard_02_mk2` 材料成本。
  - [ ] 步骤 3：切换 method 为 `closedloop`。
  - [ ] 步骤 4：断言护盾材料成本不变（fallback 到 default）。
  - [ ] 步骤 5：断言推进器材料成本变化（使用 closedloop）。

- [ ] 3.7.2 场景：大阪 Argon 炮塔 fallback（method=terran）
  - [ ] 步骤 1：进入"状态：大阪-炮塔配置"（推进器 + 炮塔）。
  - [ ] 步骤 2：method=`default` 记录炮塔 `turret_arg_m_beam_02_mk1` 材料成本。
  - [ ] 步骤 3：切换 method 为 `terran`。
  - [ ] 步骤 4：断言炮塔材料成本不变（fallback 到 default）。
  - [ ] 步骤 5：断言推进器材料成本变化（使用 terran）。

- [ ] 3.8 场景：船体材料计入总材料
  - [ ] 步骤 1：进入"状态：标准测试状态-大阪"并保存/加载 ShipBlueprint（确保 hull 配置存在）。
  - [ ] 步骤 2：展开总材料汇总行。
  - [ ] 步骤 3：断言总材料包含船体材料（独立于装备分项和 production cost）。
  - [ ] 步骤 4：验证船体材料数量与 ShipBlueprint hull 配置一致。

- [ ] 3.9 场景：船体作为独立分项显示
  - [ ] 步骤 1：进入"状态：标准测试状态-大阪"（包含 hull 配置）。
  - [ ] 步骤 2：在材料分项列表中查找船体分项。
  - [ ] 步骤 3：断言船体分项显示格式为"船体ID x 1"（如"ship_ter_m_corvette_02_a x 1"或显示名称如"Odachi x 1"）。
  - [ ] 步骤 4：展开船体分项，断言内部显示船体对应材料明细（如 hullparts）。

- [ ] 3.10 场景：船体分项独立于装备分项
  - [ ] 步骤 1：进入"状态：标准测试状态-大阪-多模块聚合"（有装备 + 船体）。
  - [ ] 步骤 2：断言材料分项列表中同时存在船体分项和装备分项。
  - [ ] 步骤 3：验证船体分项不与装备分项混淆。

- [ ] 3.11 场景：ShipBlueprint 数据源正常
  - [ ] 步骤 1：保存当前配装为 ShipBlueprint。
  - [ ] 步骤 2：刷新页面后加载该 ShipBlueprint。
  - [ ] 步骤 3：断言材料面板数据与保存前一致（blueprint.connections 数据源正常）。
