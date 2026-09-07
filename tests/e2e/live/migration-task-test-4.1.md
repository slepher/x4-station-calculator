# M4.1 Live overview/dashboard迁移

状态：implemented，待主agent审核。原7case全部保留，当前完整7/7通过；未删case、未增skip、未改helper/src/基础fixture、未删debug、未build或git写。

共享beforeEach继续loadLiveBindingFixture：db当前storage/IndexedDB archive、reload、UI中文。删除固定waitForTimeout，改用当前UI状态断言。基线7/7说明没有待修旧locator失败，但原多为容器可见，不足以证明归档/规划来源。

| 原文件/用例编号（按文件内顺序） | 原目的→当前动作 | 独立expected |
|---|---|---|
| overview 1 dashboard | 点击overview，检查dashboard与实际wareflow行 | 非空可见flow，而非仅外壳 |
| overview 2 save sync name | overview bound archive组与所选行 | playerName=slepher，文件save_008，selectedArchive.time=667632.933；原标题称binding name，实际save-list展示archive playerName，未把同名当成另有rename功能 |
| overview 3 upload/list | overview检查上传区、file input、存档行 | 三者分别存在，非只检查父容器 |
| overview 4 transit tab | 实际点HUB sector，再显示mode与KXN站tab | sectorMacro=cluster_100_sector001_macro、KXN-018存在 |
| dashboard 1 station dashboard | HUB→KXN，检查dashboard/toolbar | planning、名称地球人、六stats；不误选另一站 |
| dashboard 2 live cost | planning→live，cost、归档module、工人tab，再回planning | A电子基质8（save_old modules及constructions），只读；Live auto checked+disabled，planning enabled |
| dashboard 3 planning editable | HUB→KXN，race与规划module、切volume/time/workers | race enabled、db规划电子基质10；六stats跨视图完整innerText保持 |

来源oracle为两个独立fixture：db.json KXN计划computronicsubstrate10；A save_old KXN已建8。没有从被测计算器生成expected。仅验证本合同原七项，未声称完整成本算法数值/所有劳动力种族消耗已验证。

本轮唯一迁移失败：stats初值用innerText，toHaveText默认textContent合并元素无换行，导致文本格式差异；实际数值一致。改useInnerText:true后完整7/7，属于test-owned。失败log/trace不删除。

证据：/tmp/x4-migration-M4.1/，baseline exit0/7pass（27.1s），migrated exit1/6pass1fail（28.8s），full exit0/7pass（22.8s），collection exit0/7tests。PORT22241、preview-only、workers1/retries0/trace，正常Chromium sandbox窄escalation。详情results/M4.1.md。
