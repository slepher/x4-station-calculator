# Test Tasks: Logic Flow UI Adjust

## Unit Tests

无需单元测试（纯 UI 修改）

---

## E2E Tests

### 1. Tier 列宽度比例测试

- [x] 1.1 候选区 tier 列宽度比例测试
    - **目标**: 验证候选区 tier 列宽度比例为 2:3:3:4
    - **步骤**:
        1. 打开逻辑组网视图
        2. 使用浏览器开发者工具检查 `.ware-grid` 的列宽
        3. 计算各列宽度比例
    - **期待结果**: T0:T1:T2:T3 = 2:3:3:4

- [x] 1.2 ProductionLineGroup tier 列宽度比例测试
    - **目标**: 验证 ProductionLineGroup tier 列宽度比例为 2:3:3:4
    - **步骤**:
        1. 添加一个规划组
        2. 检查 ProductionLineGroup 的列宽
        3. 计算各列宽度比例
    - **期待结果**: T0:T1:T2:T3 = 2:3:3:4

- [x] 1.3 紧凑区等宽布局测试
    - **目标**: 验证紧凑区使用等宽布局
    - **步骤**:
        1. 开始拖拽一个 ware
        2. 检查紧凑视图的列宽
        3. 计算各列宽度比例
    - **期待结果**: 4 列等宽

---

### 2. 间距测试

- [x] 2.1 候选区间距测试
    - **目标**: 验证候选区 ware-grid 间距正确
    - **步骤**:
        1. 检查 `.ware-grid` 的 padding
        2. 检查 `.ware-grid` 的 gap
        3. 检查 `.draggable-area` 的 mb
    - **期待结果**: padding = pl-4 pr-8, gap = 48px, mb = 6px

- [x] 2.2 规划区间距测试
    - **目标**: 验证规划区 planning-zone 间距正确
    - **步骤**:
        1. 检查 `.planning-zone` 的 padding
        2. 检查 ProductionLineGroup 内部无 padding
    - **期待结果**: padding = pl-4 pr-8, ProductionLineGroup 无内部 padding

---

### 3. Ware Card 压缩率显示测试

- [x] 3.1 非 T0 ware-card 显示压缩率测试
    - **目标**: 验证非 T0 ware-card 正确显示压缩率
    - **步骤**:
        1. 打开逻辑组网视图
        2. 检查 Tier 1+ 的 ware-card
        3. 验证压缩率显示在 T0 标签右侧
    - **期待结果**: 压缩率显示为百分比 + 图标

- [x] 3.2 压缩率颜色编码测试
    - **目标**: 验证压缩率颜色正确
    - **步骤**:
        1. 找到一个压缩率 ≤100% 的 ware
        2. 验证文本颜色为绿色
        3. 找到一个压缩率 >100% 的 ware
        4. 验证文本颜色为红色
    - **期待结果**: 颜色与压缩率值对应正确

- [x] 3.3 T0 ware-card 不显示压缩率测试
    - **目标**: 验证 T0 ware-card 不显示压缩率
    - **步骤**:
        1. 检查 Tier 0 的 ware-card
        2. 验证不显示压缩率
    - **期待结果**: T0 ware-card 不显示压缩率

---

### 4. Ware Card Hover 展开测试

- [x] 4.1 非 T0 ware-card hover 显示+按钮测试
    - **目标**: 验证 hover 时+按钮显示
    - **步骤**:
        1. 打开逻辑组网视图
        2. hover 一个 Tier 1+ 的 ware-card
        3. 验证背景层向右扩展
        4. 验证+按钮从右侧滑入
    - **期待结果**: +按钮在 hover 时显示，背景层扩展

- [x] 4.2 Hover 时其他元素位置不变测试
    - **目标**: 验证 hover 时其他元素位置不变
    - **步骤**:
        1. hover 一个 ware-card
        2. 检查产品名位置
        3. 检查压缩率位置
        4. 检查相邻 ware-card 位置
    - **期待结果**: 所有元素位置不变

- [x] 4.3 T0 ware-card hover 不显示+按钮测试
    - **目标**: 验证 T0 ware-card hover 时不显示+按钮
    - **步骤**:
        1. hover 一个 Tier 0 的 ware-card
        2. 验证+按钮不出现
        3. 验证背景染色正常显示
    - **期待结果**: T0 ware-card 不显示+按钮，背景染色正常

---

### 5. T0 标签 Hover 消失测试

- [x] 5.1 T0 标签 hover 时消失测试
    - **目标**: 验证 hover 时 T0 标签渐变消失
    - **步骤**:
        1. 找一个有 T0 标签的 ware-card
        2. hover 该 ware-card
        3. 观察 T0 标签的透明度变化
    - **期待结果**: T0 标签渐变消失，露出完整产品名

- [x] 5.2 压缩率 hover 时保持显示测试
    - **目标**: 验证 hover 时压缩率保持显示
    - **步骤**:
        1. hover 一个有压缩率的 ware-card
        2. 检查压缩率是否仍然可见
    - **期待结果**: 压缩率保持显示，不消失

---

### 6. 新建规划区预览测试

- [x] 6.1 新建规划区预览位置测试
    - **目标**: 验证新建规划区预览节点始终在第1列
    - **步骤**:
        1. 拖拽一个 T1 ware 到新建规划区
        2. 检查预览节点位置
        3. 拖拽一个 T2 ware 到新建规划区
        4. 检查预览节点位置
        5. 拖拽一个 T3 ware 到新建规划区
        6. 检查预览节点位置
    - **期待结果**: 所有 tier 的预览节点都在第1列

---

## Manual Verification Checklist

- [x] 候选区 tier 列宽度比例为 2:3:3:4
- [x] ProductionLineGroup tier 列宽度比例为 2:3:3:4
- [x] 紧凑区使用等宽布局
- [x] 候选区 ware-grid padding 为 pl-4 pr-8
- [x] 规划区 planning-zone padding 为 pl-4 pr-8
- [x] ProductionLineGroup 内部无 padding
- [x] draggable-area mb 为 1.5
- [x] 非 T0 ware-card 显示压缩率
- [x] 非 T0 ware-card hover 时背景层扩展，+按钮滑入
- [x] T0 ware-card 不显示压缩率和+按钮，但保留背景染色
- [x] T0 标签使用半透明背景遮罩，hover 时消失
- [x] 压缩率 hover 时保持显示
- [x] 新建规划区预览节点始终在第1列
