# 颜色显示修复

## MODIFIED Requirements

### Requirement: 显式清空颜色
#### Scenario: 透明预设
- **当** 用户点透明预设并确认/reload
- **那么** group.color为空，不保存任何透明字符串；无色卡显示虚线，无coverage fill。

### Requirement: Coverage填色尺寸
#### Scenario: 内部六边形
- **当** 单sector或多sector星区绘制group coverage颜色
- **那么** 同心色层半径为sector半径2/3，原图层顺序不变。
