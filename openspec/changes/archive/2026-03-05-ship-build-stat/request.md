# 需求说明：ship-build-stat

## 目标
在”船只建造”页面中列属性区提供两个显示档位（简略/详细）。
两档位展示字段需对齐你提供的两张截图：简略对应截图 2，详细对应截图 1。
在当前阶段接入可直接由 XML 抽取产物计算的属性真实值；暂缺底层数据的字段继续显示占位并明确”待接入”状态。
同时取消中列属性区与已选详情区的固定高度限制，改为按内容自适应。
**属性计算数据源：使用 blueprint.connections 作为计算飞船属性（武器伤害、护盾、引擎等）的唯一数据源，而不是通过 selectedByConnection 计算**。

## 已确认方案（审核重点）
1. **中列属性区双档位**
   - 提供 `简略` / `详细` 两个切换档位。
   - 默认进入 `简略` 档位。
2. **字段对齐策略（按截图）**
   - `简略`：字段集合对齐截图 2。
   - `详细`：字段集合对齐截图 1。
   - 关系约束：`详细` 必须覆盖 `简略` 字段，并在其基础上增加细项。
3. **简略档位字段（截图 2）**
   - 左列：`船体(MJ)`、`护盾(MJ)`、`雷达范围(km)`、`武器爆发输出值(MW)`、`炮塔平均输出值(MW)`、`集装仓储(m3)`、`M级泊位数量`、`M级飞船容量`、`S级泊位数量`、`S级飞船容量`。
   - 右列：`速度(m/s)`、`助推器助推速度(m/s)`、`巡航速度(m/s)`、`船员`、`单位`、`导弹`、`可投放设备`、`干扰弹`。
4. **详细档位字段（截图 1）**
   - 左列：包含简略左列全部字段，且新增 `再充率(MW)`、`再充延迟(秒)`、`编组平均护盾容量(...)`、`武器持续性输出值(...)`、`固体仓储(m3)`、`液体仓储(m3)`、`冷凝态仓储(m3)`。
   - 右列：包含简略右列全部字段，且新增 `加速(m/s2)`、`助推加速度(m/s2)`、`助推时长(秒)`、`助推回充率(%/s)`、`巡航加速度(m/s2)`、`巡航加力时间(秒)`、`平移速度(m/s)`、`平移加速度(m/s2)`、`水平转向(°/s)`、`俯仰(°/s)`、`横滚(°/s)`。
   - 注：字段命名与单位在 UI 中以截图文案为准；当前阶段无法计算的字段 value 使用占位（如 `--`）。
5. **高度策略调整**
   - 中列属性区取消固定高度（如 `h-48`）。
   - 已选详情区取消固定高度（如 `72px` 行内样式或 CSS 强制高度）。
   - 内容高度按实际行数自适应。
6. **数据源与计算分层（XML + Blueprint）**
   - 数据源优先复用已有抽取产物：
     - 船体与基础参数：`ships.json`（来源 `ship_macros.xml + ship_connections.xml`）。
     - 装备参数：`equipments.json`（来源 `equipment_macros.xml`）。
     - 弹体参数：`bullets.json`（来源 bullet_macros.xml）。
   - **已选装备数据源：使用 `blueprint.connections` 作为计算属性的唯一数据源**
     - 护盾属性（`护盾(MJ)`、`再充率`、`再充延迟`、`编组平均护盾容量`）：从 `blueprint.connections` 中查找 `slot_type='shield'` 的已装备设备，聚合计算。
     - 引擎属性（`速度`、`助推速度`、`巡航速度`）：从 `blueprint.connections` 中查找 `slot_type='engine'` 的已装备设备，聚合计算。
     - 不再依赖 `selectedByConnection` ref 进行计算。
   - 可直接计算字段优先落地真实值：
     - 船体、船员、仓储、泊位/容量：来自 `ships.json`
     - 雷达范围：来自 `ship.radarRange`
     - 可投放设备、干扰弹：来自 `ship.storage.deployable` / `ship.storage.countermeasure`
     - 护盾、速度链路：来自 blueprint.connections + equipments.json
   - bullets.json 已包含 `damage` 和 `reload` 字段，可计算武器/炮塔输出值：
     - **武器爆发输出值** = `bullet.damage * 装备数量`（取前几秒为基准估算）
     - **武器持续输出值** = `bullet.damage / bullet.reload * 装备数量`（DPS）
     - **炮塔平均输出值**：遍历 turret 槽位，计算同上的平均值
   - 注意：武器/turret 没有直接的 rate of fire 字段，用 `1/bullet.reload` 近似射速
7. **文案与可测试性**
   - 为双档位按钮和属性区保留稳定测试定位（`data-testid`）。
   - 新增中英文文案键：档位名称、详细档位待接入提示、字段标签。
8. **示例锚点（回归基线）**
   - 以“苍鹭级运输船（Heron Vanguard, `ship_tel_l_trans_container_02_a`）”作为数据链路验证样本：
     - 船体/船员/仓储来自 `ships.json`；
     - 护盾与引擎关联属性来自选配装备 `equipments.json`。

## 边界
### In Scope
- 中列属性区新增双档位切换能力。
- 在当前资产可覆盖范围内接入真实属性值，并对剩余字段保留占位展示与提示文案。
- 中列属性区和已选详情区取消固定高度限制。
- 同步更新对应 OpenSpec 文档与测试任务描述。

### Out of Scope
- 新引入/打包额外原始弹体资产文件以实现武器与炮塔精确 DPS。
- 与截图无关的属性扩展展示。
- 修改其它 change 下已确认的需求文档。

## 验收标准（DoD）
1. 已选择飞船后，中列属性区可见”简略/详细”两个档位按钮。
2. 点击档位按钮可稳定切换显示内容。
3. `简略` 档位字段集合与截图 2 对齐。
4. `详细` 档位字段集合与截图 1 对齐，且覆盖简略字段。
5. 可由现有 XML 抽取产物计算的字段显示真实值，不再统一占位。
6. 暂无底层数据支撑的字段展示占位值和”待接入”提示。
7. 以 Heron 样本验证数据来源可追溯（船体/仓储/船员/护盾与引擎链路）。
8. **护盾/引擎属性计算基于 blueprint.connections，不依赖 selectedByConnection ref**。
9. 中列属性区不存在固定高度限制类或固定高度内联样式。
10. 已选详情区不存在固定 `72px` 等强制高度限制。
11. 双档位与提示文案具备中英文 i18n 键。
12. 测试任务覆盖字段对齐、档位切换、占位展示、高度策略回归。

## 未决项
无。

## 附录

### PanelStats 与 default_maxes.json 字段配对表

数值条的 max 值来源：`default_maxes.json`（从 `defaults.xml` 提取的各飞船 class 最大值）

| PanelStats Key | Label EN | default_maxes 字段 | xl | l | m | s |
|---------------|----------|-------------------|-----|-----|-----|-----|
| hull | Hull | hull | 1,795,200 | 253,200 | 46,800 | 8,040 |
| shield | Shield | shield_value | 1,376,898 | 765,000 | 86,549 | 10,554 |
| shield_recharge_rate | Recharge Rate | shield_rate | 5,473 | 2,194 | 922 | 1,258 |
| shield_recharge_delay | Recharge Delay | shield_delay | 0 | 0 | 0.57 | 13.9 |
| shield_group_avg | Group Avg Shield | group_shield_value | 54,734 | 36,489 | 86,549 | 10,554 |
| radar_range | Radar Range | radar_range | 48,000 | 96,000 | 48,000 | 48,000 |
| weapon_burst | Weapon Burst Output | weapon_burst | 971,277 | 69,817 | 71,851 | 52,489 |
| weapon_sustained | Weapon Sustained Output | weapon_sustained | 361,404 | 25,323 | 21,292 | 13,235 |
| turret_avg | Turret Avg Output | turret_burst | 24,729 | 9,260 | 948 | 0 |
| speed | Speed | engine_forward | 654 | 720 | 1,959 | 2,145 |
| acceleration | Acceleration | engine_acceleration | 287 | 200 | 435 | 1,557 |
| boost_speed | Boost Speed | boost_speed | 3,687 | 5,130 | 14,855 | 18,604 |
| boost_acceleration | Boost Acceleration | boost_acceleration | 731 | 641 | 3,248 | 9,851 |
| boost_duration | Boost Duration | boost_duration | 46 | 46 | 31.7 | 26.4 |
| boost_recharge | Boost Recharge | boost_recharge | 3.3 | 3.3 | 2.0 | 10.0 |
| travel_speed | Travel Speed | travel_speed | 29,777 | 30,204 | 24,724 | 41,859 |
| travel_acceleration | Travel Acceleration | travel_acceleration | 424 | 558 | 1,065 | 3,160 |
| travel_charge_time | Travel Drive Charge Time | travel_charge_time | 30 | 20 | 8 | 6 |
| strafe_speed | Strafe Speed | thruster_horizontal_speed | 57 | 119 | 404 | 421 |
| strafe_acceleration | Strafe Acceleration | thruster_horizontal_acceleration | 25 | 43 | 202 | 1,053 |
| yaw | Yaw | engine_yaw | 0.11 | 0.56 | 2.0 | 4.3 |
| pitch | Pitch | engine_pitch | 0.11 | 0.56 | 2.5 | 4.3 |
| roll | Roll | engine_roll | 0.10 | 0.70 | 3.3 | 5.1 |
| crew | Crew | capacity_crew | 406 | 226 | 26 | 8 |
| storage_container | Container Storage | capacity_container | 56,000 | 62,000 | 15,100 | 4,120 |
| storage_solid | Solid Storage | capacity_solid | 0 | 57,600 | 12,000 | 5,480 |
| storage_liquid | Liquid Storage | capacity_liquid | 0 | 54,000 | 12,960 | 510 |
| storage_condensed | Condensed Storage | capacity_condensate | 0 | 0 | 4,300 | 250 |
| storage_unit | Drone Storage | capacity_unit | 247 | 74 | 21 | 4 |
| missile | Missile Capacity | capacity_missile | 6,144 | 2,684 | 120 | 41 |
| deployable | Deployable | capacity_deployable | 454 | 254 | 104 | 54 |
| countermeasure | Countermeasure | capacity_countermeasure | 44 | 24 | 12 | 8 |
| dock_m_count | M Dock Count | dock_ship_m | 4 | 1 | 0 | 0 |
| dock_m_capacity | M Ship Capacity | capacity_ship_m | 8 | 2 | 0 | 0 |
| dock_s_count | S Dock Count | dock_ship_s | 21 | 8 | 1 | 0 |
| dock_s_capacity | S Ship Capacity | capacity_ship_s | 100 | 16 | 1 | 0 |

### 数值条 Max 值计算规则

1. **根据飞船 class (ship_xl / ship_l / ship_m / ship_s) 确定使用哪一列的 max 值**
   - 例如：选择的飞船 class 为 `ship_l`，则使用 `l` 列的数值作为 max

2. **max 值来源**：`default_maxes.json` 中对应字段的值

3. **视觉表现**：
   - 进度条比例 = `当前值 / max值`
   - **如果当前值 >= max，视觉上占满整个进度条即可（100%），不需要超出显示**

4. **字段特殊说明**：
   - `shield` → `shield_value`（外层护盾最大值）
   - `shield_group_avg` → `group_shield_value`（护盾组平均值）
   - `shield_recharge_rate` → `shield_rate`
   - `shield_recharge_delay` → `shield_delay`

