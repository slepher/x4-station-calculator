# 实现任务

- [x] T1: 追踪活动身份所有caller，修保存事务，focused Unit红绿与有限消费者。
  - 真实 Blueprint/ActiveView/EmpireData store，新 Pinia 恢复、多帝国 A 保留、SaveAs 两站选第二站映射/缓存、其他模块视图不被切走。
  - `/tmp/x4-migration-FIX-M15.1/red.log` 6 fail / 2 pass；`green.log` 8/8；`consumers.log` 4 文件 17/17，exit 0。
- [x] T2: 主agent协调窗口后build。
  - 主 agent fresh build exit0：/tmp/x4-migration-FIX-M10.2-DETAILS/combined-build-final.log。

M15.1浏览器复验已由主agent另行派发：原9失败9/9、完整46/46、必要M7.1消费者2/2，全部exit0。BUG-001 Verified，交主agent审核。
