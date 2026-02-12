# Test Tasks

## Unit Tests

- [ ] **FavoriteButton Logic**: 验证 `formatHours` 函数
  - 输入: prod=12, res=1, hasProd=true, hasRes=true -> 输出 "12h + 1h"
  - 输入: prod=12, res=1, hasProd=true, hasRes=false -> 输出 "12h"
  - 输入: prod=0, res=1, hasProd=false, hasRes=true -> 输出 "1h"
- [ ] **FavoriteButton Logic**: 验证 `getDesc` 动态描述逻辑
  - 验证 Level 2 + 仅产出 -> 返回 "Long Buffer" (无 Resource)
  - 验证 Level 2 + 产出 + 消耗 -> 返回 "Long Buffer + Resource Buffer"

## Web Integration Tests

- [ ] **Tooltip Persistence**:
  - 打开 StationWareflow
  - 悬停在 Fav 按钮上，确认 Tooltip 显示
  - 点击 Fav 按钮切换等级
  - **验证**: Tooltip 依然显示，且内容（图标/文本）已更新为新等级
  - 移开鼠标，验证 Tooltip 消失
- [ ] **Lock Button Persistence**:
  - 悬停在 Lock 按钮上
  - 点击锁定/解锁
  - **验证**: Tooltip 保持显示并更新状态文本
- [ ] **Fav Tooltip Layout**:
  - 检查 Tooltip 是否为 4 列布局
  - 切换语言为英文
  - **验证**: "No Demand" 文本在同一行显示，未换行
- [ ] **Buffer Info Accuracy**:
  - 设置主产物缓冲 12h，资源缓冲 1h
  - 找到一个既生产又消耗的 Ware (如中间产物)
  - **验证**: Tooltip 显示 "12h + 1h" 及完整描述
  - 找到一个纯产出 Ware (如最终产品)
  - **验证**: Tooltip 显示 "12h" 且描述为 "Long Buffer"
