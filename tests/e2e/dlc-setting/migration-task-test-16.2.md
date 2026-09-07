# M16.2 DLC settings and station tags

Base `d590ede41d41913ab18f5c5a18247bf956a4685a`; direct workspace candidate, no commit. Scope: direct-migration/tasks/M16.2.md and generation-5 task-test-16 §16.2. Only three owned spec files, this migration document and results/M16.2.md are editable; M16.1 is frozen.

## Authority and current data

Read canonical `dlc-tag`, `station-dlc-tag`, `map-dlc`, `ship-dlc` specs and archived `2026-03-20-dlc-setting/specs/dlc-setting/spec.md` (settings spec has no canonical counterpart). Current `versions.json`, both stable `dlcs.json` files, current module JSON/locales, DlcSettingsModal, game-data settings methods, StationPlanningPanel/Item, StationModulePicker presenter and common candidate components were inspected.

Both 8.0 and 9.0 ship seven available DLC records: split, terran, pirate, boron (6.0), timelines (7.0), mini_01 (7.5), mini_02 (8.0). There is no 9.0-dependent DLC record; tests do not fabricate one or derive expected candidates from runtime filtering. `dlc-setting.spec.ts` explicitly represents 8.0 stable with `x4-setting`; `dlc-settings.spec.ts` and tags represent 9.0 stable with `x4-setting_v9`. Every beforeEach clones db.json excluding vsn, sets its explicit version/missing current settings as fixture setup, reloads and selects zh-CN via UI. Source db.json is unchanged.

Station tag fixture starts clean empire v5 and adds a station through `sidebar-add-station`. Fixed static witnesses: `module_ter_prod_energycells_01` (dlc_terran, translated module name `Terran 能量电池产线`) and `module_gen_prod_energycells_01` (base). DLC `{1021,62}` translates to `人类的摇篮`. Search, module creation, settings, restrictions, deletion, and save/reload occur through actual UI. No store writes or DOM event simulation. No Live/Logic Flow helper needed.

## Original → current mapping

### dlc-setting/dlc-setting.spec.ts (all 30 IDs retained)

| Original IDs | Current action and independent expected |
|---|---|
| 2.1, 3.1 | Missing current setting fixture; setting entry/red indicator visible |
| 2.2, 2.3 | Open modal; list, actions, strategy, hint and close available |
| 2.4, 2.5 | Close button/backdrop; modal hidden |
| 2.6, 3.5 | Clear then select all; exactly seven actual candidates checked |
| 2.7, 3.7 | Clear all; zero checked |
| 2.8, 3.9 | Toggle single checkbox; inverse state |
| 2.9, 3.17 | Policy toggle; true→false transition explicit |
| 2.10, 3.2 | Save and close; red indicator absent (save helper also reloads) |
| 3.3 | Seven DLC candidates, no base option, Terran exact translated label |
| 3.4 | Explicit 8.0 fixture; dependency metadata from 6.0/7.0/7.5/8.0, no higher version; Chinese UI metadata |
| 3.6, 3.8, 3.10 | Select all/clear/toggle, save and reload, reopen with exact checked state retained |
| 3.11 | Save selection; exact seven-id activeDlcs persisted |
| 3.12, 3.14 | Change draft then close/backdrop; original checked state restored; current settings storage remains absent |
| 3.13, 3.15 | Close unchanged draft; current settings storage remains absent |
| 3.16 | Policy true, save/reload/reopen; UI checked and stored boolean true |
| 3.18 | Hint explicitly mentions search list and existing inactive items not taking effect |
| 3.19 | Missing setting defaults all seven active without automatic storage write |
| 3.20 | Save empty array, reload; no setup indicator and persisted [] |

### dlc-settings/dlc-settings.spec.ts (all 14 original names retained)

| Original name/group | Migrated action / expected |
|---|---|
| 打开 DLC 设置 modal | UI open and exact Chinese heading |
| 关闭…关闭按钮/遮罩/取消按钮 (3) | Change Terran checkbox, close by named action; no persistence and default restored |
| DLC 列表显示 | All seven exact ids visible, no base |
| 全选/全不选功能 | Seven→zero→seven checked |
| 单个 DLC 勾选/取消 | Terran true→false→true without conditional branch |
| 限制策略开关 | Actual input checkbox false→true→false |
| 保存设置 | Save only Terran + policy true; exact JSON under v9 key, original 8.0 setting unchanged, reload and UI confirms one checked |
| 取消保存 - 设置不持久化 | Save initial state, change draft, cancel; stored bytes unchanged, reload confirms saved checks/policy |
| 未设置 DLC 时显示红点 | Missing current setting and visible indicator |
| 已设置 DLC 后红点消失 | Save [], reload; absent indicator and exact empty-array/false JSON |
| DLC 名称使用游戏 i18n 翻译 | Terran label exactly 人类的摇篮 |
| 需要版本显示 | Exact translated 6.0 and 8.0 metadata |

### dlc-settings/dlc-tag-display.spec.ts (all 7 original names retained)

| Original name | Current action / independent expected |
|---|---|
| 搜索候选模块显示 DLC 标签 | Search energy cells; exact Terran translated tag; base candidate visible without tag |
| DLC 标签样式 - 激活状态 | Activate all through UI; fixed Terran candidate and added row have active tag style |
| 已添加模块显示 DLC 标签 | Add fixed Terran module; visible tag must use translated DLC name per station-dlc-tag spec |
| DLC 标签 - 未激活状态样式 | Add while active, then disable DLC and enforce; row remains, opacity .5, inactive tag, count disabled, delete enabled and works; replaces old runtime skip |
| 关闭限制策略时显示全部模块 | Disable DLC with policy off; Terran still visible with inactive tag, base visible |
| 开启限制策略时隐藏未激活 DLC 模块 | Positive Terran candidate witness first; enable restriction; Terran absent, base remains; exact Terran query yields no groups; after reload restriction still filters |
| DLC 设置保存后触发重算 | Add Terran energy cells; positive UI flow before; disable/enforce removes energy flow while keeping module row; policy off restores identical UI value |

## Baseline and migration findings

- Minimal initial-state baseline: 7/7 passed, exit 0, `/tmp/x4-migration-M16.2/baseline.log`. Old modal entry is valid; no speculative locator replacement needed.
- Representative old failures: 2 passed / 2 failed, exit 1, `baseline-failures.log`. `需要版本显示` reads Requires 6.0 because fixture never set UI language (test-owned). `未激活状态样式` never establishes an existing module before disabling/filtering DLC, then waits for nonexistent module row (test-owned). Its conditional scan/skip cannot prove the required behavior.
- Removed fixed delays, direct settings deletion from test bodies, conditional checkbox/label assertions, and runtime skip. Fixture-only missing-setting initialization remains explicit. No arbitrary timeout increase.
- Remaining focused classifications, commands, counts and trace paths are recorded in results/M16.2.md. Product/spec differences must remain visible failures until parent resolution; current code alone cannot supersede explicit translated-label requirements.

## Product candidate boundary and independent controls

The first complete migration run collected 51, passed 47, failed 4, exit 1 (`focused.log`). One test-owned failure came from the legacy test body calling `goto` again after beforeEach's UI language action, losing initialized game-text locale; redundant navigation was removed. Parent confirmed the canonical station-dlc-tag requirements remain authoritative and no accepted override for the following three failures was found:

1. Added module's visible tag is literal `DLC`; only its title is `人类的摇篮`. Exact translated visible-text assertion remains.
2. After disabling all DLC and enabling policy, Terran row darkens to .5 with red/inactive tag, but its number input remains enabled. StationPlanningPanel's isModuleCountEditable only checks habitation type. Disabled-input assertion remains; delete is independently exercised.
3. The sole Terran energy module still produces `+3,000.0` after restriction. Exact zero production is asserted against read-only `blueprintStore.stationState.productionFlows`; UI must no longer display nonzero flow. The oracle permits either absence or a displayed zero row, since the spec requires excluded production rather than a particular empty-row rendering.

Soft assertions record real failures while continuing independent controls: the base added module has no DLC tag, inactive module deletion still works, and turning policy back off restores the prior UI value. Soft failures keep the test and run failed; no condition suppresses any expected. No further duplicate product-failure retries are warranted before a separately authorized product fix and rebuilt preview.
