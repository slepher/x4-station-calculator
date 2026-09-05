# task-test-1.1 迁移映射与证据

## 场景映射

| 原场景 | 当前规则 | fixture / 稳定锚点 | 用户动作 | 精确 oracle |
| --- | --- | --- | --- | --- |
| 最新归档无效时，仍可使用有效归档 | 归档按 GUID 分组；无效归档不可选；有效归档按 GUID + `GAME_ARCHIVE_TIME` 选择 | `loadLiveBindingFixture`；`save.json` 改为无效；`save_old.json` 保持有效并复制为 `save_008_later`；`map-save-panel`、`.save-info`、`.save-item-active` | 打开 Maps → Save panel → 点击 `save_008_later` 的可见 filename；reload | `selectedArchive.meta.guid` 为 `CB8837FE-98C1-42F8-9D6A-ED0ADC539111`，time 为 `700000`，filename 为 `save_008_later`，`isValid` 为 `true`；reload 后相同；无效项显示 invalid badge |
| 不同 GUID 不应混入当前绑定 | 两个 GUID 独立分组，绑定 GUID 使用 `CB8837FE-98C1-42F8-9D6A-ED0ADC539111` | `save.json` GUID 为 `B41B8D56-C58D-4F66-8EAA-6F85BC614214`；按玩家名/filename 定位 | 观察归档分组并选择当前 GUID 的有效时间项 | 最终 selected archive GUID 与当前绑定 GUID 一致，且不是 `B41B8D56-C58D-4F66-8EAA-6F85BC614214` |

## fixture 副本字段

- 原始 `tests/fixtures/save/save.json`：GUID `B41B8D56-C58D-4F66-8EAA-6F85BC614214`，time `1345095.294`，filename `save_009`；测试变换 `parser_version: v4`，因此显示无效。
- 原始 `tests/fixtures/save/save_old.json`：GUID `CB8837FE-98C1-42F8-9D6A-ED0ADC539111`，time `667632.933`，filename `save_008`；测试副本改为 time `700000`、filename `save_008_later`，内容仍来自同一实际 save，避免依赖目录枚举顺序。
- helper 只对副本数组调用 `saveArchiveDB.saveArchiveToDB`；测试行为通过 UI 触发，`page.evaluate` 仅读取最终 `selectedArchive` 领域状态。

## 本轮执行证据

- Base / candidate：`da05d84514c90428fd4e51907df9b6424fa5ccff` / 同一 HEAD 的未提交候选工作树；当前 SHA `da05d84514c90428fd4e51907df9b6424fa5ccff`。
- 基线命令：`npm exec playwright test -- tests/e2e/live/live-archive-valid-select.spec.ts --project=chromium --workers=1 --retries=0 --trace=on`；exit `0`；2 passed，0 failed。
- 基线 trace：`test-results/live-live-archive-valid-se-ad59c-hive-valid-one-is-clickable-chromium/trace.zip`、`test-results/live-live-archive-valid-se-000b1-e-when-newer-one-is-invalid-chromium/trace.zip`。
- 候选 focused：`npm exec playwright test -- tests/e2e/live/live-archive-valid-select.spec.ts --project=chromium --workers=1 --retries=0 --trace=on`；exit `0`；2 passed，0 failed。
- 候选 collection：`npm exec playwright test -- tests/e2e/live/live-archive-valid-select.spec.ts --list --reporter=list`；exit `0`；列出 2 tests。
- 差异校验：`git diff --check`；exit `0`。
- helper cross-consumer：`npm exec playwright test -- tests/e2e/live tests/e2e/binding tests/e2e/auto-sector-group-one-binding tests/e2e/auto-sector-group-one-core tests/e2e/auto-sector-group-one-map --project=chromium --workers=1 --retries=0 --trace=on`；exit `1`；140 tests，138 passed，2 failed。失败均在未授权路径：`auto-sector-group-one-binding.spec.ts:394`（3.3 重置结果对象差异，trace `test-results/auto-sector-group-one-bind-0ea6c-e-binding-3-计算、重置与确认-3-3-重置-chromium/trace.zip`）；`auto-sector-group-one-core.spec.ts:903`（`.placement-preview--binding` 未出现，trace `test-results/auto-sector-group-one-core-4f1cc-m-写入-5-3-station-plan-归属重分配-chromium/trace.zip`）。分类候选：外部 test-owned / reviewer 裁决；不归因于本 helper。
- 本轮基线无失败；候选 focused 无失败；保留原任务编号和失败来源。
