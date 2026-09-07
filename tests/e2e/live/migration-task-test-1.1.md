# task-test-1.1 迁移映射与证据

## 场景映射

| 原场景 | 当前规则 | fixture / 稳定锚点 | 用户动作 | 精确 oracle |
| --- | --- | --- | --- | --- |
| 最新归档无效时，仍可使用有效归档 | 归档按 GUID 分组；无效归档不可选；有效归档按 GUID + `GAME_ARCHIVE_TIME` 选择 | `loadLiveBindingFixture`；`save.json` 改为无效；`save_old.json` 保持有效并复制为 `save_008_later`，fixture 初始 active 固定为该项；`map-save-panel`、`.save-info`、`.save-item-active` | 打开 Maps → Save panel → 确认 `save_008_later` 初始 active；点击 `save_008`，再点击 `save_008_later`；reload | `save_008`：GUID `CB8837FE-98C1-42F8-9D6A-ED0ADC539111`、time `667632.933`、filename `save_008`、`isValid/isCompatible` 均为 `true`；`save_008_later`：time `700000`、filename `save_008_later`；reload 后保持后者身份；无效项 `save_009` 显示 invalid/disabled |
| 不同 GUID 不应混入当前绑定 | 两个 GUID 独立分组，绑定 GUID 使用 `CB8837FE-98C1-42F8-9D6A-ED0ADC539111` | `save.json` GUID 为 `B41B8D56-C58D-4F66-8EAA-6F85BC614214`，唯一无效项 filename 为 `save_009`；`liveStore.playerStationRecords` | 第二用例在同一 browser context 中进入 station UI | selected archive identity 为 `CB8837FE-98C1-42F8-9D6A-ED0ADC539111` / `700000` / `save_008_later`，`isValid/isCompatible` 为 `true`，`playerStationRecords` 含 `KXN-018` |

## fixture 副本字段

- 原始 `tests/fixtures/save/save.json`：GUID `B41B8D56-C58D-4F66-8EAA-6F85BC614214`，time `1345095.294`，filename `save_009`；测试变换 `parser_version: v4`，因此显示无效。
- 原始 `tests/fixtures/save/save_old.json`：GUID `CB8837FE-98C1-42F8-9D6A-ED0ADC539111`，time `667632.933`，filename `save_008`；测试副本改为 time `700000`、filename `save_008_later`，内容仍来自同一实际 save，避免依赖目录枚举顺序。
- helper 只对副本数组调用 `saveArchiveDB.saveArchiveToDB`；测试行为通过 UI 触发，`page.evaluate` 仅读取最终 `selectedArchive` 领域状态。

## 历史执行证据（保留，不作为当前通过依据）

- CWD：`/home/slepher/project/x4-station-calculator/.worktree/integrate`；browser：Chromium `Google Chrome for Testing 143.0.7499.4`；Playwright `1.57.0`。
- 真实冻结 base：`97194f1a4ef2c8f971545a3f2e32a921ebd3a0d4`；本 correction candidate 为该 base 上的未提交工作树，待 dispatcher 提交/冻结新 candidate，不宣称当前 candidate SHA。
- 弱 witness 复现（reviewed base）：`npm exec playwright test -- tests/e2e/live/live-archive-valid-select.spec.ts --project=chromium --workers=1 --retries=0 --trace=on`；exit `0`；用例 1、2 均 passed；reviewer trace 的 `save_008_later` click 前已为 active：`test-results/live-live-archive-valid-se-ad59c-hive-valid-one-is-clickable-chromium/trace.zip`。
- correction focused 第一次：同上命令；exit `1`；用例 1 failed（`save_008` locator count 0），用例 2 passed；trace `test-results/live-live-archive-valid-se-ad59c-hive-valid-one-is-clickable-chromium/trace.zip`。
- correction focused 第二次：同上命令；exit `1`；两用例均在 `loadLiveBindingFixture` 的 `page.goto('/')` 前失败，`ERR_CONNECTION_REFUSED`，并有 localStorage `SecurityError`；trace `test-results/live-live-archive-valid-se-ad59c-hive-valid-one-is-clickable-chromium/trace.zip`、`test-results/live-live-archive-valid-se-000b1-e-when-newer-one-is-invalid-chromium/trace.zip`。
- collection：`npm exec playwright test -- tests/e2e/live/live-archive-valid-select.spec.ts --list --reporter=list`；exit `0`；列出 2 tests。
- 差异校验：`git diff --check`；exit `0`。
- helper cross-consumer：`npm exec playwright test -- tests/e2e/live tests/e2e/binding tests/e2e/auto-sector-group-one-binding tests/e2e/auto-sector-group-one-core tests/e2e/auto-sector-group-one-map --project=chromium --workers=1 --retries=0 --trace=on`；exit `1`；140 tests，138 passed，2 failed。失败均在未授权路径：`auto-sector-group-one-binding.spec.ts:394`（3.3 重置结果对象差异，trace `test-results/auto-sector-group-one-bind-0ea6c-e-binding-3-计算、重置与确认-3-3-重置-chromium/trace.zip`）；`auto-sector-group-one-core.spec.ts:903`（`.placement-preview--binding` 未出现，trace `test-results/auto-sector-group-one-core-4f1cc-m-写入-5-3-station-plan-归属重分配-chromium/trace.zip`）。分类候选：外部 test-owned / reviewer 裁决；不归因于本 helper。
- focused correction 的最终行为证据因 webServer 连续不可用而 unavailable；保留初始弱 witness、测试-owned locator 失败和 runner 失败，不计为通过。

## M1.1 当前迁移证据（2026-09-07）

- 当前工作目录为仓库根，基线 `d590ede41d41913ab18f5c5a18247bf956a4685a`，运行依赖 ENV 的 preview 就绪修复及已验证构建。helper 本轮无修改，接口已交接主 agent，消费者独立验证。
- 原 1.1 / 第一个用例：保留 invalid/disabled 标记、两项有效归档的 GUID/time/filename/valid/compatible 和 reload 断言；补充两个点击目标事前非 active，及 KXN-018 记录的 `archiveId` 随 UI 操作从 `CB8837FE-98C1-42F8-9D6A-ED0ADC539111_700000` 变为 `_667632.933` 再变回 `_700000`。独立 expected 为 fixture 身份常量，未调用被测选择算法。
- 原 1.1 / 第二个用例：保持展开星区、点击 KXN-018、显示 dashboard 的 UI witness，补充该站记录 `archiveId` 精确等于上述 `_700000`，明确站点来源。每个用例使用独立 browser context；原映射表的“同一 browser context”只适用于各用例内部动作。
- 读取实际链路：MapSaveArchiveList → MapSavePanel → useSaveStore.selectArchive → scoped IndexedDB restore；Live 的 selectedArchive watcher 按 GUID/time 重新载入 playerStationRecords。该 Map UI 目前直接使用 store 属历史代码，本任务不改产品层。
- 本人基线 focused：exit 0，2 passed / 0 failed / 0 skipped（12.3s）。增强后 focused：exit 0，2 passed / 0 failed / 0 skipped（12.0s）。collection：exit 0，2 tests / 1 file。完整命令与 trace 见 `docs/plan/unified-test-repair/direct-migration/results/M1.1.md`。
- 历史弱 witness 由当前双向转变排除，历史 runner failure 由 ENV 修复后两次 focused 排除；本轮未发现产品候选。未运行 helper consumers 或额外 build，分别交主 agent 派发与 ENV 负责；未将历史 138/140 当成本轮证据。
