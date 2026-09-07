# BUG-HULL

Fixed（Unit边界）。ship-build-material/spec.md:20–21,63–69；现行类型x4.ts:817–843及stateMigrations.ts:357–366明确保留hull。M10.4总2197漏100，原trace及完整消费者见results/M10.4.md。共享analyzeShipBlueprintBuild现有shipEntry合并production+hull成本，保持时间及输入不变。当前独立Unit RED4failed/3passed→GREEN7passed；有限消费者3files/18passed，日志/tmp/x4-migration-FIX-M10.4-HULL/。等待主agent统一build与原失败/完整M10.4独立E2E，不标Verified。

# BUG-STATS

Fixed（聚焦Unit边界，合同尚未完成）。archive/2026-03-05-ship-build-stat/request.md:23,43–46及design.md:215,463,475。原平均额外/6导致36.7/50.2，回充率100s；原两船严格失败与原34其他指标证据见results/M10.4.md。PanelStats现移除额外/6并在既有展示计算将recharge/100、单位%/s，共享装备详情不改。真实mounted Unit当前RED4failed/2passed→GREEN6passed，日志/tmp/x4-migration-FIX-M10.4-STATS/。用户要求快速结束，有限消费者尚未运行，build/E2E未执行；STATS任务保持未勾选，不标Verified。
