# Bugs

## 2026-05-20 auxiliary-reference-quota-not-applied

- 症状：
  - 自动基础设施和 habitation 已经接入了 reference candidate 优先，但多个 archive/building 参考模块不会像生产模块那样按参考配额依次消耗。
  - 结果是 UI 会把参考池里的多种辅助模块折叠成单一模块类型，例如 archive 里同时存在 Argon 与 Terran 仓储时，auto 区可能全部显示为同一种仓储。
- 根因：
  - 当前实现只做了“reference 池优先选首个候选”，没有像 `findBestProducerWithRef` 那样继续区分“配额内参考模块”与“超出配额后的 fallback”。
- 修复方向：
  - 为 habitation / storage / pier 引入基于能力指标的参考配额分摊：
    - habitation 按 `workforce.capacity`
    - storage 按 `cargo.capacity`
    - pier 按 `dockingCount`
