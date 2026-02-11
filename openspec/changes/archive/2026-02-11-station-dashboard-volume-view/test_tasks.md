# 测试任务：空间站仪表盘空间视图

## UI 验证

### 统计栏 (Stats Bar)
- [x] 验证统计栏使用 2x3 网格布局。
- [x] 验证 "Workers Needed" 标签显示，且数值为绿色 (`text-emerald-400`)。
- [x] 验证 "Transport Trips" 标签显示，且数值为蓝色 (`text-blue-400`)。
- [x] 验证 "Total Volume" 标签显示，且数值为蓝色。

### 空间视图切换 (Volume View Switch)
- [x] 点击 "空间视图" (Volume View) 按钮。
- [x] 验证列表更新显示体积数值 (m³)。
- [x] 验证所有体积数字均为蓝色。
- [x] 验证 Summary 标题显示为 "建设总体积" (或本地化等效词)。
- [x] 验证 Summary 数值与统计栏中的 `Total Volume` 一致。

### 底部控制 (Footer Controls)
- [x] 在成本视图中：验证 "建设资源价格" (Build Resource Price) 滑块存在。
- [x] 在空间视图中：验证 "运输船运量" (Transport Capacity) 滑块存在。
- [x] 调整运输船运量滑块：
  - [x] 验证统计栏中的 "Transport Trips" 动态更新。
  - [x] 验证公式：Trips = ceil(Total Volume / Slider Value)。

## 数据验证
- [x] 添加一个模块 (例如: Claytronics Production)。
- [x] 检查 `analyzeStation` 输出 (通过 Vue DevTools 或 Console log，或者视觉检查)。
- [x] 验证 `volume` 计算为 `count * unitVolume`。
- [x] 验证 `totalVolume` 为所有模块体积之和。

## 国际化验证 (I18n Verification)
- [x] 切换语言到 ZH-CN。
- [x] 验证 "成本视图", "空间视图", "运输船次", "工人需求", "建设总体积"。
- [x] 切换语言到 EN。
- [x] 验证 "Cost View", "Volume View", "Transport Trips", "Workers Needed", "Total Build Volume".

## 持久化验证 (Persistence Verification)
- [x] 修改运输船运量滑块的值。
- [x] 保存布局并刷新页面 (或重载)。
- [x] 验证运输船运量滑块的值保持修改后的状态。
