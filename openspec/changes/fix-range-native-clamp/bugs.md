# BUG-001: 重复越界后原生值不同步

状态Confirmed。权威 archive/2026-03-09-ship-items/specs/ship-items/spec.md 双阶段拖动条。M10.3真实鼠标：原生250，库存/显示220，另项30，总250。

原证据 /tmp/x4-migration-M10.3/correction.log 及correction/ship-ship-items-3-8-drag-i-c40be--shared-deployable-capacity-chromium/trace.zip。根因/全调用者详见 direct-migration/results/FIX-M10.3-diagnosis.md。Unit及新构建E2E尚待完成；旧失败不删除。

T1实际mounted RED6failed/2passed，原生property在input、release/change及dragMax0未同步；修复复用toNumber回写后GREEN8passed，有限FIT7消费者通过，合计2files/15passed。日志 `/tmp/x4-migration-FIX-M10.3/unit-{red,green}.log`。状态仍Confirmed，build及真实鼠标E2E待父级调度。
