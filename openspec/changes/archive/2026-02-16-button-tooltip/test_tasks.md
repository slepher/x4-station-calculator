# Test Tasks

## Unit Tests

- [x] **FavoriteButton Logic**: 验证 `formatHours` 函数
  - 输入: prod=12, res=1, hasProd=true, hasRes=true -> 输出 "12h + 1h"
  - 输入: prod=0, res=2, hasProd=true, hasRes=true -> 输出 "2h" (New: 生产缓冲为0时隐藏 0h)
  - 输入: prod=12, res=1, hasProd=true, hasRes=false -> 输出 "12h"
  - 输入: prod=0, res=1, hasProd=false, hasRes=true -> 输出 "1h"
- [x] **FavoriteButton Logic**: 验证 `getDesc` 动态描述逻辑
  - 验证 Level 2 + 仅产出 -> 返回 "Long" (无 Res)
  - 验证 Level 2 + 产出 + 消耗 -> 返回 "Long + Res"
- [x] **AvailableLevels Logic**: 验证 `StationWareFlow` 中的优先级计算
  - Planned Ware (手动添加模块) -> `[1, 2]`
  - Auto/Byproduct (自动填充) -> `[0, 1]`
  - Pure Consumption (纯消耗/矿物) -> `[0]`

## Web Integration Tests

- [x] **Tooltip Persistence**:
  - 打开 StationWareflow
  - 悬停在 Fav 按钮上，确认 Tooltip 显示
  - 点击 Fav 按钮切换等级
  - **验证**: Tooltip 依然显示，且内容（图标/文本）已更新为新等级
  - 移开鼠标，验证 Tooltip 消失
- [x] **Lock Button Persistence**:
  - 悬停在 Lock 按钮上
  - 点击锁定/解锁
  - **验证**: Tooltip 保持显示并更新状态文本
- [x] **Fav Tooltip Layout**:
  - 检查 Tooltip 是否为 4 列布局
  - 切换语言为英文
  - **验证**: "No Demand" 文本在同一行显示，未换行
  - **验证**: 描述文本为精简格式 (如 "Long + Res")
- [x] **Buffer Info Accuracy**:
  - 设置主产物缓冲 12h，资源缓冲 1h
  - 找到一个既生产又消耗的 Ware (如中间产物)
  - **验证**: Tooltip 显示 "12h + 1h" 及完整描述
  - 找到一个纯产出 Ware (如最终产品)
  - **验证**: Tooltip 显示 "12h" 且描述为 "Long"
  - 找到一个生产缓冲为 0 但有资源缓冲的 Ware
  - **验证**: Tooltip 显示 "1h" (而非 "0h + 1h")
- [x] **Resource Interaction Rules (New)**:
  - **Case 1: Planned Ware (e.g. Energy Cells from Solar Panel)**
    - 悬停 Fav 按钮
    - **验证**: Tooltip 仅显示 "Secondary" (Level 1) 和 "Primary" (Level 2) 两行。
    - **验证**: 无法切换到 "No Demand" (Level 0)。
  - **Case 2: Auto/Byproduct Ware**
    - 悬停 Fav 按钮
    - **验证**: Tooltip 仅显示 "No Demand" (Level 0) 和 "Secondary" (Level 1) 两行。
    - **验证**: 无法切换到 "Primary" (Level 2)。
  - **Case 3: Pure Consumption/Mineral (e.g. Ore)**
    - **验证**: 按钮图标清晰可见（不应变暗/半透明）。
    - **验证**: 点击按钮无效（不可切换状态）。
    - **验证**: 悬停时 Tooltip **必须出现**。
    - **验证**: Tooltip 仅显示 "No Demand" (Level 0) 一行。
