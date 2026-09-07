# 选船筛选生命周期

## MODIFIED Requirements

### Requirement: 取消后保留正确筛选

#### Scenario: 同船级取消并重新进入
- **前提** 当前 Katana，用户在 M 船级增选 Argon
- **当** 取消并重新进入 selector
- **那么** Argon 筛选保持，blueprint 不变。

#### Scenario: 跨船级取消
- **当** 筛选船级相对 selectedShip 已变化后取消
- **那么** 按 selectedShip 回填筛选属性。

#### Scenario: 进入 selector
- **当** 重新进入 selector
- **那么** 不因组件重新初始化额外回填筛选；实际蓝图载入的初始回填保留。
