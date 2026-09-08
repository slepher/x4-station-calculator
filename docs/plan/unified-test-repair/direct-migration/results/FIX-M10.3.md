# FIX-M10.3

Resolved change: fix-range-native-clamp。T1完成，T2 build/E2E已由父级独立复验并通过。

共享slider原有toNumber改接收input，夹值后同步原生input.value；input和commitCurrent复用同一路径。保留max全轨道、dragMax数值政策、非有限值guard、窗口监听及skipNextChange，无新watch/状态/presenter。所有调用者已在诊断列明，仅两源组件五模板实例，未改调用者。

- `npm run test:unit -- tests/unit/common/x4-dual-phase-range-slider.spec.ts` exit1，6failed/2passed，`/tmp/x4-migration-FIX-M10.3/unit-red.log`。
- `npm run test:unit -- tests/unit/common/x4-dual-phase-range-slider.spec.ts tests/unit/ship/ship-fit-single-candidate-count.spec.ts` exit0，2files/15passed（新mounted8+FIT7），`unit-green.log`。

真实mounted直接操作HTMLInputElement.value并触发原生组件事件，覆盖model220下重复raw250、从0先达220再越界、mouse/touch结束后change仅commit一次、直接change、dragMax0、无dragMax与step/受控prop更新、卸载监听清理。断言原生property和独立220/0数值，不仅检查emit。透明input的原生/可访问值错误不被描述成可见thumb错误；没有宣称已验证真实键盘或鼠标浏览器行为。

当前补充证据：父级 fresh dist 上，M10.3 原 3.8 真实 mouse down/move/up 为 1/1，DOM property=220；完整四 spec 为 22/22 passed、exit 0、0 skip，trace 在 `/tmp/x4-test-repair-M10.3/full/`，3.8 focused trace 在 `/tmp/x4-test-repair-M10.3/drag-3.8/`。旧失败日志/trace 全部保留为历史证据。
