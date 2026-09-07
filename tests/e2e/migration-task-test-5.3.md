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

最终collection10。当前合成4满足/6失败：compact2+cancel1于test-owned-correction3/3；Reset于independent1/2。demo正常/placeholder/locked/duplicate失败未删除或skip，具体源码归属/权威及恢复见results/M5.3.md。原demo直接store方法的成功不作为真实UI通过。
