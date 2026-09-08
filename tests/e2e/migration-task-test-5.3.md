# M5.3 migration

Owned compact2 + demo20旧项合并成当前10事务。正式LogicFlow与独立demo分开评估，源不改；共享helper冻结。

| 原编号/目的 | 当前行为、用户动作与独立oracle | 新用例 |
|---|---|---|
| Compact start/end | Energy Cells为T0禁拖，改hullparts真实鼠标开始→离开释放取消→新建落地；idle且组空/唯一手动Hull Parts | Compact view toggles |
| Compact existing | 创建Hull Parts锁定组再拖Claytronics；显式locked反馈、同groupId且仅1组 | independent ware |
| A.1/B.1/C.1/ST.1/ST.2/E.1 | 旧dispatch负例和store模拟不再当真实事务；mouse A→B，A明确4ID、B唯一item1、start/enter/drop/end和DOM唯一 | real mouse moves |
| C.2/S.1/H.1/H.2/H.3/E.2/E.3 | 真鼠标开始→进入B高亮→离开→释放，5个ID成员保持、B空、enter/leave/end且无drop | hover, leave and cancel |
| S.3 | UI Add Auto→拖item1，Auto→Manual，落地唯一且isAuto=false | Auto placeholder |
| S.4 | UI Add Isolated→拖item2，Isolate→Connect，落地唯一且isIsolated=false | Isolate placeholder |
| S.5 | UI lock→拖Terran item4，amber且B唯一item4 | locked permits Terran |
| S.6 | UI lock→拖Argon item5，rejected红色且A保留/B空 | locked rejects Argon |
| S.2/ST.4 | 先真实移动，再B内拖同项，Duplicated红色且B唯一 | same-zone duplicate |
| ST.3 | UI两个placeholder后Reset，A初始5ID、B空、events空 | Reset restores |

普通db fixture（去vsn）→reload→language-select UI；demo随后经query view=drag-test进入，所有业务setup按钮/真实mouse，evaluate只注入fixture和读取。原7条console诊断均保留，新增历史推荐已被真实鼠标替代的说明，未删除诊断。

基线3项1fail/2pass，T0旧expect失败。迁移中expect错误从test-setup导入及JSON缺attribute导致两次collection错误（没有browser验收count）；修正后完整8项失败，两个compact locator/status错误及cancel过强顺序oracle已修。取消可以改变列表顺序但仍保持原区成员，旧目的未要求禁排序；采用完整ID集合，未降成只看count。

最终collection10。当前完整复验为 **6满足/4失败**：compact2、normal、Auto、Argon reject、Reset通过；cancel、Isolate、Terran accept、duplicate失败。失败未删除或skip，具体源码归属/权威及恢复见results/M5.3.md。原demo直接store方法的成功不作为真实UI通过。

## 2026-09-08 fresh dist 复验

PORT=22753、preview-only、workers=1、retries=0、trace=on；命令输出和 trace 保留在 `/tmp/x4-test-repair-M5.3/`。当前 10 项 collection 成功，单次结果 **4 passed / 6 failed / 0 skipped，exit 1，44.5s**。未发现可在 owned spec 内修复的 stale locator 或 fixture schema；失败动作和独立 expected 继续保留。未执行 build、Unit、Rust 或 full suite。

## 独立 demo 产品修复复验

授权范围内修复了独立 demo 的受控 `model-value`/authoritative `items`、normal move、Auto promote、dragover 事件、locked accept/reject 和稳定 item key；正式 Logic Flow/helper 未改。`npm run build` exit 0（`/tmp/x4-test-repair-M5.3/product-fix-build-latest2.log`）。最新完整单次为 **6 passed / 4 failed / 0 skipped**，详见 results/M5.3.md。

Sol follow-up：新增独立 demo presenter，store 改为完整 ordered snapshot 与事务式 nextItems 提交，并将鼠标目标锚定实际 draggable-area 空白。build exit 0（`/tmp/x4-test-repair-M5.3/product-fix2/build-final2.log`）；最新完整单次 **7 passed / 3 failed / 0 skipped，exit 1**，证据位于 `/tmp/x4-test-repair-M5.3/product-fix2/`。剩余失败逐项保留。

Current-source final build exit 0（`/tmp/x4-test-repair-M5.3/product-fix2/build-current-final.log`）；最终完整单次 **8 passed / 2 failed / 0 skipped，exit 1，46.1s**，日志 `/tmp/x4-test-repair-M5.3/product-fix2/final-current2.log`。剩余仅 Argon reject 与 Terran accept hover，合同保持 incomplete。
