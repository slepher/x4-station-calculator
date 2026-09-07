# BUG-001

Confirmed：M5.3正常drop与auto/isolate失败。根因:list污染filtered computed，当前drop读取错误重复状态。原browser证据保留于/tmp/x4-migration-M5.3/，最终矩阵以results/M5.3.md为准。未修复。

# BUG-002

Candidate：matching locked hover未进入B。尚须独立判断落点/事件或本根因影响，不把一次通过当解决，不预认产品缺陷。
