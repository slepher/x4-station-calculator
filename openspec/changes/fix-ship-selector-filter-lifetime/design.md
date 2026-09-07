# 设计

先检查 Selector 所有进入/离开、pending、确认/取消和 selectedShipId watcher。优先复用组件实例保留 local filters；如 v-show 已能覆盖所有路径，不引入持久化字段或状态管理层。检查隐藏 selector 的 watch/布局副作用。若不足以稳定保留当前语义，报告精确新边界后再扩域。

只读追踪发现跨级回填与pending清除同样依赖原卸载重建，因此仅v-show不足。保留实例时，必须在取消事件明确清pending，仅跨级时按currentShip回填。把本次筛选生命周期的refs、watch和必要动作精确移入presenter，避免Vue增加store业务路径；不全面重构其他候选/设备/布局逻辑。保留诊断日志。
