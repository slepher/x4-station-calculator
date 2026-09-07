# task-test-1.2 当前 CRUD 迁移

基线：`d590ede41d41913ab18f5c5a18247bf956a4685a`；当前工作目录为仓库根。依赖已接受的 M1.1 helper 和 ENV preview 就绪修复，本任务未修改 helper。

| 原编号 / 目的 | 当前行为 | 用户动作 | 独立 expected / 当前用例 |
| --- | --- | --- | --- |
| 1.2 / Live 入口 | 统一 fixture 载入 active binding | fixture reload、UI 语言设置 | 原用例 `live production view is active after fixture load` 保留，sidebar-overview 可见 |
| 1.2 / overview | 绑定 overview 展示 | 点击 sidebar-overview | 原 `overview tab shows empire wareflow dashboard` 保留，dashboard 可见 |
| 1.2 / 创建与命名 | 从当前有效 archive GUID 建立默认命名 binding | Maps → Save → `莱布·哈利肯 bind` | 新 CRUD 事务：独立 GUID `B41B8D56-C58D-4F66-8EAA-6F85BC614214`、名称 `莱布·哈利肯`；原 `slepher` binding 保留；不是从 store 方法创建 |
| 1.2 / 保存边界 | 编辑 station plan 仅进入 draft，显式保存才写独立 binding key | 展开 cluster_100_sector001_macro → 点击 KXN-018 → UI 名称改为 `M1.2 保存站点` → blur → toolbar Save | 新 explicit-save 用例：dirty true 且持久化 bindings 完全不变；Save 后 dirty false、KXN-018 name 等于固定字面值；reload 输入恢复；empire 原始存储字符串不变 |
| 1.2 / 切换 | 从载入列表激活完整 binding 上下文 | 载入莱布·哈利肯，再载入 slepher，再 reload | CRUD 事务：activeViewStore.activeBinding、draft.gameGuid、selectedArchive.meta.guid 同时精确等于目标 GUID；两份 binding 均持久化 |
| 1.2 / 删除 | 删除非当前 binding 不破坏当前 binding 与 empire | 载入列表点击莱布·哈利肯行删除，接受真实确认框，再 reload | CRUD 事务：目标行消失；剩余原 binding 等于创建后当前版本快照；empire 与初始字符串相同；当前 GUID 三处均为原 GUID |

规范来源：`save-binding` 的 Standalone Binding Storage、Binding Explicit Save、Binding Station Plans；`active-binding` 的 Active Binding Synchronization 与 Load Binding From List Must Activate。命名按主 agent 澄清采用创建时默认命名，不额外要求独立 rename 入口。

实际链路：MapSaveArchiveList → MapSavePanel → saveBindingStore.createOrOpenBinding；LoadLivePlanModal → liveStore.activateBinding；LiveStationToolbar → useProductionToolbarPresenter → liveStore.updateStationName；StationToolbar → useToolbarWorkflowController → liveStore.saveBinding → 独立版本化 save_bindings key。Map/Load modal 的历史直接 store 访问只读，不在本任务修产品分层。

## 运行与失败保留

- 原文件仅有 2 项冒烟。本人 baseline exit 0，2 passed（8.0s）；该证据不证明 CRUD 完成。
- 首次新增 CRUD 小范围 exit 1，0 passed / 1 failed，动作已走到删除后持久化比较。断言拿原始 db fixture 与当前版本持久化对象比较，命中旧 group UUID → sectorMacro、默认 station settings 填充。分类 test-owned/stale。日志 `/tmp/x4-migration-M1.2/lifecycle.log` 及对应 trace 保留。
- 修正比较边界为创建后已经规范化的持久化快照；删除后仍完整深比较原 binding，不按字段裁剪。expected 的创建 GUID/name、切换身份、站点保存值均为独立常量，没有调用被测算法生成 expected。
- 完整 focused exit 0，4 passed / 0 failed / 0 skipped（18.1s）；collection exit 0，4 tests / 1 file。详情与命令见 `docs/plan/unified-test-repair/direct-migration/results/M1.2.md`。
- 无产品候选；未新增 skip/fixme/only 或条件通过；没有业务 store 写入来替代 UI。
