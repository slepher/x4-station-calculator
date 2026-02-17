# Test Tasks: Logic Flow UI Adjust

## Unit Tests

无需单元测试（纯 UI 修改）

## Web Integration Tests

### 压缩率显示测试

- [ ] 2.1 非 T0 ware-card 显示压缩率测试
    - **目标**: 验证非 T0 ware-card 正确显示压缩率
    - **步骤**:
        1. 打开逻辑组网视图
        2. 检查 Tier 1+ 的 ware-card
        3. 验证压缩率显示在 T0 标签右侧
    - **期待结果**: 压缩率显示为百分比 + 图标

- [ ] 2.2 压缩率颜色编码测试
    - **目标**: 验证压缩率颜色正确
    - **步骤**:
        1. 找到一个压缩率 ≤100% 的 ware
        2. 验证文本颜色为绿色
        3. 找到一个压缩率 >100% 的 ware
        4. 验证文本颜色为红色
    - **期待结果**: 颜色与压缩率值对应正确

- [ ] 2.3 T0 ware-card 不显示压缩率测试
    - **目标**: 验证 T0 ware-card 不显示压缩率
    - **步骤**:
        1. 检查 Tier 0 的 ware-card
        2. 验证不显示压缩率
    - **期待结果**: T0 ware-card 不显示压缩率

### Hover 展开测试

- [ ] 2.4 非 T0 ware-card hover 显示+按钮测试
    - **目标**: 验证 hover 时+按钮显示
    - **步骤**:
        1. 打开逻辑组网视图
        2. hover 一个 Tier 1+ 的 ware-card
        3. 验证+按钮出现
    - **期待结果**: +按钮在 hover 时显示

- [ ] 2.5 T0 ware-card 不显示+按钮测试
    - **目标**: 验证 T0 ware-card hover 时不显示+按钮
    - **步骤**:
        1. hover 一个 Tier 0 的 ware-card
        2. 验证+按钮不出现
    - **期待结果**: T0 ware-card 不显示+按钮

## Manual Verification

- [x] 候选区 tier 列宽度比例为 2:3:3:4
- [x] 规划区紧凑视图 tier 列宽度比例为 2:3:3:4
- [x] ProductionLineGroup tier 列宽度比例为 2:3:3:4
- [x] 候选区 ware-grid padding 为 16px
- [x] 候选区 ware-grid gap 为 48px
