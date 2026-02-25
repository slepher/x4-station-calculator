# Test Tasks: ship-build-material

## 1. Unit Tests（Vitest）

- [ ] 1.1 method 选项聚合
  - [ ] 步骤 1：准备固定输入：飞船 `ship_ter_l_destroyer_01_a`，装备 `turret_arg_m_beam_02_mk1`、`turret_ter_m_beam_02_mk1`。
  - [ ] 步骤 2：执行 method 选项聚合。
  - [ ] 步骤 3：断言结果为去重后的 `default`、`closedloop`、`terran`。

- [ ] 1.2 method fallback（飞船）
  - [ ] 步骤 1：准备飞船 `ship_ter_l_destroyer_01_a`（仅含 `default`），当前 method 设为 `closedloop`。
  - [ ] 步骤 2：执行飞船材料计算。
  - [ ] 步骤 3：断言飞船仍使用 `default` 成本：`computronicsubstrate=281`、`energycells=1034`、`metallicmicrolattice=471`。

- [ ] 1.3 method fallback（装备）
  - [ ] 步骤 1：准备装备 `turret_ter_m_beam_02_mk1`（仅含 `default`），当前 method 设为 `closedloop`。
  - [ ] 步骤 2：执行装备材料计算。
  - [ ] 步骤 3：断言装备使用 `default` 成本：`computronicsubstrate=5`、`energycells=100`、`metallicmicrolattice=36`、`siliconcarbide=4`。

- [ ] 1.4 装备分项按 equipmentId 聚合
  - [ ] 步骤 1：准备选择映射：`group_back_down_mid=turret_arg_m_beam_02_mk1`、`group_back_mid_up=turret_ter_m_beam_02_mk1`、`group_down_mid_left(2个连接点)=turret_arg_m_beam_02_mk1`。
  - [ ] 步骤 2：执行分项聚合。
  - [ ] 步骤 3：断言分项为 `turret_arg_m_beam_02_mk1 x 3` 与 `turret_ter_m_beam_02_mk1 x 1`。

- [ ] 1.5 总材料合并规则
  - [ ] 步骤 1：准备默认 method 下的固定输入（同 1.4）。
  - [ ] 步骤 2：执行总览汇总。
  - [ ] 步骤 3：断言总览材料数量至少包含并等于：`energycells=1164`、`computronicsubstrate=286`、`metallicmicrolattice=507`、`advancedelectronics=18`、`turretcomponents=30`、`siliconcarbide=4`。

- [ ] 1.6 价格倍率只影响金额
  - [ ] 步骤 1：使用同一输入分别计算 `priceMultiplier=0` 与 `priceMultiplier=1`。
  - [ ] 步骤 2：比较结果。
  - [ ] 步骤 3：断言每种材料 `count` 完全一致，`value` 发生变化。

## 2. Bootstrapping & State（E2E）

- [ ] 2.1 状态：标准测试状态-大阪
  - [ ] 步骤 1：按 `ship-build-equipment` 标准路径进入“状态：标准测试状态-大阪”。
  - [ ] 步骤 2：断言材料面板、method 下拉、总材料汇总行可见且无报错。

- [ ] 2.2 状态：标准测试状态-大阪-材料分项聚合
  - [ ] 步骤 1：先进入“状态：标准测试状态-大阪”。
  - [ ] 步骤 2：在配装区切换到 `slotType=turret`。
  - [ ] 步骤 3：进入 `group_back_down_mid` 并选择 Argon 装备 `turret_arg_m_beam_02_mk1`。
  - [ ] 步骤 4：进入 `group_back_mid_up` 并选择 Terran 装备 `turret_ter_m_beam_02_mk1`。
  - [ ] 步骤 5：进入 `group_down_mid_left` 并再次选择 `turret_arg_m_beam_02_mk1`（形成重复 `equipmentId`）。
  - [ ] 步骤 6：断言材料分项区出现以下两个分项：`turret_arg_m_beam_02_mk1 x 3`、`turret_ter_m_beam_02_mk1 x 1`。

- [ ] 2.3 切换：method 变更
  - [ ] 步骤 1：进入“状态：标准测试状态-大阪-材料分项聚合”，记录 `default` 下总价。
  - [ ] 步骤 2：切换 method 为 `closedloop`，记录总价。
  - [ ] 步骤 3：切换 method 为 `terran`，记录总价。
  - [ ] 步骤 4：断言三次总价存在变化，且页面无异常。

- [ ] 2.4 状态：标准测试状态-大阪-多模块聚合
  - [ ] 步骤 1：先进入“状态：标准测试状态-大阪”。
  - [ ] 步骤 2：在配装区切换到 `slotType=turret`。
  - [ ] 步骤 3：`group_back_down_mid` 选择 `turret_arg_m_beam_02_mk1`。
  - [ ] 步骤 4：`group_back_mid_up` 选择 `turret_ter_m_beam_02_mk1`。
  - [ ] 步骤 5：`group_down_mid_left` 选择 `turret_arg_m_beam_02_mk1`（该组 2 个连接点）。
  - [ ] 步骤 6：`group_down_mid_right` 选择 `turret_arg_m_gatling_02_mk1`（该组 2 个连接点）。
  - [ ] 步骤 7：断言分项聚合结果为：
    - [ ] `turret_arg_m_beam_02_mk1 x 3`
    - [ ] `turret_ter_m_beam_02_mk1 x 1`
    - [ ] `turret_arg_m_gatling_02_mk1 x 2`

## 3. Scenario Content（E2E）

- [ ] 3.1 场景：总材料折叠明细展示
  - [ ] 步骤 1：进入“状态：标准测试状态-大阪-材料分项聚合”（保持 method=`default`）。
  - [ ] 步骤 2：展开“总材料 xxxCr”。
  - [ ] 步骤 3：断言总览中出现并匹配数量：`energycells=1164`、`computronicsubstrate=286`、`metallicmicrolattice=507`、`advancedelectronics=18`、`turretcomponents=30`、`siliconcarbide=4`。

- [ ] 3.2 场景：装备分项按 ID 聚合展示
  - [ ] 步骤 1：进入“状态：标准测试状态-大阪-材料分项聚合”。
  - [ ] 步骤 2：观察材料分项列表。
  - [ ] 步骤 3：断言仅出现目标分项 `turret_arg_m_beam_02_mk1 x 3` 与 `turret_ter_m_beam_02_mk1 x 1`。

- [ ] 3.3 场景：装备分项展开明细
  - [ ] 步骤 1：进入“状态：标准测试状态-大阪-材料分项聚合”，展开 `turret_arg_m_beam_02_mk1` 分项（method=`default`）。
  - [ ] 步骤 2：断言 Argon 分项明细数量为：`advancedelectronics=18`、`energycells=30`、`turretcomponents=30`。
  - [ ] 步骤 3：展开 `turret_ter_m_beam_02_mk1` 分项并断言数量为：`computronicsubstrate=5`、`energycells=100`、`metallicmicrolattice=36`、`siliconcarbide=4`。

- [ ] 3.4 场景：method fallback 生效
  - [ ] 步骤 1：进入“状态：标准测试状态-大阪-材料分项聚合”（固定包含 `turret_arg_m_beam_02_mk1` 与 `turret_ter_m_beam_02_mk1`）。
  - [ ] 步骤 2：切换 method 为 `closedloop`，断言 Terran 分项 `turret_ter_m_beam_02_mk1` 使用 `default` 材料：`computronicsubstrate + energycells + metallicmicrolattice + siliconcarbide`。
  - [ ] 步骤 3：继续在 `closedloop` 下断言 Argon 分项 `turret_arg_m_beam_02_mk1` 使用 `closedloop` 材料：`claytronics + energycells + hullparts`（不出现 `advancedelectronics/turretcomponents`）。
  - [ ] 步骤 4：切换 method 为 `terran`，断言 Argon 分项 `turret_arg_m_beam_02_mk1` 回退到 `default` 材料：`advancedelectronics + energycells + turretcomponents`（不出现 `claytronics/hullparts`）。
  - [ ] 步骤 5：断言两条回退路径成立：Terran `closedloop -> default`，Argon `terran -> default`，且总览/分项无空白异常。

- [ ] 3.5 场景：价格滑条联动
  - [ ] 步骤 1：进入“状态：标准测试状态-大阪-材料分项聚合”，记录总览 `energycells` 的数量与金额。
  - [ ] 步骤 2：将材料价格滑条从中位拖到最大值（或最小值）。
  - [ ] 步骤 3：断言 `energycells` 数量保持不变，金额发生变化；并对 `turret_arg_m_beam_02_mk1` 分项重复同一断言。

- [ ] 3.6 场景：多模块聚合下材料数量正确
  - [ ] 步骤 1：进入“状态：标准测试状态-大阪-多模块聚合”（method=`default`）。
  - [ ] 步骤 2：展开总材料汇总行。
  - [ ] 步骤 3：断言总览材料数量精确等于：
    - [ ] `energycells=1174`
    - [ ] `computronicsubstrate=286`
    - [ ] `metallicmicrolattice=507`
    - [ ] `advancedelectronics=20`
    - [ ] `turretcomponents=54`
    - [ ] `siliconcarbide=4`
  - [ ] 步骤 4：展开 `turret_arg_m_gatling_02_mk1` 分项，断言分项材料数量为：`advancedelectronics=2`、`energycells=10`、`turretcomponents=24`。
