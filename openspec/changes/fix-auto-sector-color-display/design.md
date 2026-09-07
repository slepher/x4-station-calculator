# 设计

先追SketchPicker实际model update/preset click事件顺序，避免undefined清空后又被透明字符串覆盖。复用已安装库/现有颜色工具规范化真实输出，不猜不存在data-color属性，不用固定默认蓝色掩盖不合法输入。显式透明与普通非透明颜色保持明确语义，新展示组装需要时进局部presenter，不加中间层。

持久化链已接受undefined但须验证确认/reload不会自动重新配色。若确需扩到store/default-color流程，先交主agent精确边界，不预先改整个颜色算法。

SVG仅改覆盖填色几何的半径比例，单sector与多sector一致；中心、图层次序和无色隐藏保持。不是全地图坐标重构，不影响其它点击命中层。保留诊断日志。
