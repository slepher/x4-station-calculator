# 设计

在 Blueprint store 形成单一当前可计算 modulesMap，限制关闭用完整库，开启只包含激活模块。以同一库筛选计算输入和全部自动生产者/居住/仓储/码头候选。

Map 四处写入口（planned setter、updateStationModules、sync snapshot、initialize）及 buildDerivedActiveStationState 二次分析一致消费上述输入。active state 的 plannedModules 明确保留原计划，effective/resolved 保持有效计算结果；成本、工人、体积由 resolved 输入既有分析器。

activeDlcs 内容或 enforce 变化必须重建静态依赖、所有站点缓存与聚合。先复用 initializeAllStationDerived，不增加新缓存框架。必须测试 0 结果不会被旧缓存恢复。若该边界不足以保持全部调用语义，报告精确扩域需求后再修改通用代码。

不回写过滤后的计划，不修改 Live archive/full/reference/canonical 语义，不增加 UI 适配层，不写 fallback 链，不清理现有调试日志。
