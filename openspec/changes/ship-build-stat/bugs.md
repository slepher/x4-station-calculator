# Ship Build Stats Bugs

## Bug: Summary Mode Missing Missile/Deployable/Countermeasure Fields

- **ID**: BUG-001
- **Description**: The summary mode in ShipBuildPanelStats is missing 3 fields: missile (导弹), deployable (可投放设备), and countermeasure (干扰弹). The test expects 18 fields in summary mode, but the product only shows 15 fields.
- **Steps to Reproduce**:
  1. Load a ship blueprint (e.g., ship_ter_m_corvette_02_a)
  2. Click on "简略" (summary) mode tab
  3. Count the number of stats labels displayed
- **Expected Behavior**: Summary mode should display 18 fields including: 船体(MJ)、护盾(MJ)、雷达范围(km)、武器爆发输出值(MW)、炮塔平均输出值(MW)、集装仓储(m3)、M级泊位数量、M级飞船容量、S级泊位数量、S级飞船容量、速度(m/s)、助推速度(m/s)、巡航速度(m/s)、船员、单位、导弹、可投放设备、干扰弹
- **Actual Behavior**: Summary mode displays only 15 fields, missing: missile (导弹), deployable (可投放设备), countermeasure (干扰弹)
- **Status**: New
- **Related Test**: Test case 3.1 "简略字段对齐" in test_tasks.md
- **Root Cause**: The `buildSummaryStatsByUseEquipmentStats` function (lines 1000-1028 in ShipBuildPanelStats.vue) does not include the missile, deployable, and countermeasure fields, while `buildDetailStatsByUseEquipmentStats` (lines 1032-1117) correctly includes them at rows 16-18.
