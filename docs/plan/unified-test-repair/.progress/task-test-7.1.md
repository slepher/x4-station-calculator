Goal: unified-test-repair generation-5 task-test-7.1
Generation: generation-5
Role: def_coding_worker

Completed: 在冻结 base da05d84514c90428fd4e51907df9b6424fa5ccff 完成 baseline；迁移两个 owned E2E spec 到 db fixture + reload + UI language 前置，替换当前 sidebar testid，恢复旧 skipped reorder 场景执行。
Current: 最终 focused 已结束；candidate 使用 PORT=21558，退出码 1，27 collected，21 passed、6 failed、0 skipped。已写入 owned migration 文档及逐用例结果。
Next: 由 task-test-7 reviewer 分类/决定后续重跑；本 worker 不再重复 focused。
Blocker: 6 个未决失败：5 个拖拽/旧 locator 行为项，1 个保存后 reload 恢复项；均已保留 trace 路径和分类证据。固定端口曾有 EPERM/端口占用，备用端口已可运行。
