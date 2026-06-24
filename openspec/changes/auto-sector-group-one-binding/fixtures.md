# E2E Fixtures

## 2 Shared Draft 生命周期

- [ ] 2.3 context 切换重置 draft：覆盖切换 active binding 或 selected archive 后旧 context 未提交内容不残留
  - fixture: context-switch-save.patch.json
  - target: save.json
  - data: 基于 save.json 构造不同 guid 的存档变体，供 test 在基础 fixture 载入后增量写入第二个 archive。测试第一次 `loadLiveBindingFixture` 后，应用此 patch 得到 variant save，再通过 store 增量加入 archive list 和 IndexedDB，产生两个不同 guid 的存档，然后分别激活 binding 验证 draft 重置。

## 5 回归风险

- [ ] 5.4 防止 `normalizeState()` 丢弃新增 SaveBindingPlan 字段
  - fixture: normalize-fields-db.patch.json
  - target: db.json
  - data: 在 active binding 上注入 `appliedAutoGroupArchiveTime`、`prefJumpRange`、`bridgeSearchJumpRange`、`prefThreshold` 四个新字段，验证 normalizeState 重载后字段值不丢失
  - reason: 基础 fixture 的 binding 不含这些字段（字段本身即本次 change 新增内容），无法通过常规 UI 操作形成有明显区分度的初始值。patch 负责注入预设值，用于验证存储重载的保留行为。
