# M10.5 船舶 DLC E2E 迁移

基线候选：`6d14c05dfbfea5042745c781342c5c12e0d152ac`（复用既有 dist，preview-only config）。

| 旧编号 | 当前行为与用户动作 | 独立 expected | 新用例 |
| --- | --- | --- | --- |
| 2.1 | fixture reload、语言 UI 选择、DLC 设置 UI 全选并关闭限制，进入 M/generic 舰船选择 | 当前 9.0 game data 中 generic M 舰船存在 DLC 实体，候选显示 DLC 标签 | 2.1 |
| 2.2 | 同上，点击候选舰船、确认、打开首个槽位类型 | 工作台和装备槽位可见 | 2.2 |
| 2.3 | DLC 设置 UI 全选、关闭限制，进入 generic M 选择 | 实体 `dlc_tag !== base` 的标签为 active class | 2.3 |
| 2.4 | DLC 设置 UI 清空、关闭限制，进入 generic M 选择 | 实体 `dlc_tag !== base` 的标签为 inactive class | 2.4 |
| 2.5 | DLC 设置 UI 清空、关闭限制，进入 generic M 选择 | 全部 4 个 generic M 实体保留，且 inactive 标签仍可见 | 2.5 |
| 2.6 | DLC 设置 UI 清空、开启限制，进入 generic M 选择 | 仅实体 `ship_gen_m_tugboat_01_a`（base）的 1 个候选保留，无 inactive 标签 | 2.6 |
| 3.1 | 清空 DLC、关闭限制，进入 generic M 选择 | base 实体无标签，未激活实体有 inactive 标签 | 3.1 |
| 3.2 | 清空 DLC、关闭限制，进入 generic M 选择 | 候选完整保留，race count 有数值 | 3.2 |
| 3.3 | 清空 DLC、开启限制，进入 generic M 选择 | 精确定位 `ship-build-filter-race-btn-generic`，显示 `generic(1)`；关闭限制显示 `generic(4)` | 3.3 |
| 3.1.8–3.1.9 | 仅激活 `ego_dlc_mini_02` 并开启限制，选择 `ship_gen_m_corvette_01`（Envoy），打开 engine slot picker；随后清空 active DLC 并保持限制开启 | `engine_arg_m_corvette_01_mk1` 显示 `Envoy Pack`；激活时 active、清空 DLC 后 inactive；selector/workbench 回退，reload 后 DLC modal 仍显示 mini02 未勾选且 enforce 已勾选 | 3.1.8–3.1.9 |

静态 oracle 集合为 `{ship_gen_m_corvette_01: Envoy, ship_gen_m_corvette_02: Cypher, ship_gen_m_tugboat_01_a: Manticore, ship_gen_m_yacht_01_a: Astrid}`；前两艘为 `ego_dlc_mini_02`，tug 为 base，yacht 为 pirate DLC。设置状态通过 `settings-button`、DLC 弹窗全选/清空/mini02 checkbox、限制 checkbox 和保存按钮产生；不从 `window.gameDataStore` 重建 expected。reload 后直接打开 DLC modal，断言 mini02 未勾选且 enforce 已勾选。
