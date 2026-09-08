# M9.1 真实文件导入与地图空间身份迁移

状态：**incomplete：6 个导入场景和 station 真实拖动/overlay 场景通过；sector 拖动及保存/reload 后完整空间身份 witness 仍未完成。**

普通场景注入 `db.json`（删除 `vsn`）、reload、通过 UI 设置语言；logic-flow 非空场景通过真实 storage import 文件上传产生可导入规划区；所有导入动作、策略入口、站点模块和地图拖动均由 UI 完成。地图恢复增加 map station presenter、blueprint/domain location facade、station panel 与 MapWorkbench 接线；未修改基础 fixture、shared helper 或 git。

## 原编号映射

| 原编号 | 当前用例 | 真实动作 | 静态 expected |
| --- | --- | --- | --- |
| 3.1 | `StationToolbar Import 打开 storage-import 向导` | UI 创建空 station，点击 StationToolbar Import，上传 `tests/fixtures/import-export/import-full.json` | storage wizard、Empire/Flow/Ship 模块选择和 overwrite/incremental 可见，旧 unified modal 不出现 |
| 3.2 | `ContextToolbar logic-flow 入口按当前页面自动判定导入目标` | 通过 UI 上传 `tests/fixtures/x4-export.json` 的 logic-flow 模块；分别从 station/empire context 打开 unified import modal 并切换 logic-flow | station context 显示 group list，empire context 显示 plan list，统一 modal 保持可见 |
| 3.3 | `游戏蓝图上传后展示模块数且在非空站点弹策略弹窗` | UI 添加能量电池模块，上传固定 XML（两个 entry），点击导入 | 模块数量静态为 `2`；统一策略 modal 与 cancel/overwrite/add/new 四按钮可见 |
| 3.4 | `x4-station 在帝国总览导入时新建默认命名空间站` | UI 从 overview 打开 x4-game 分享串并点击导入 | import modal 关闭；sidebar station 数量为导入前 `N + 1`；激活站点名含 `新建空间站`，overview 不再 active |
| 3.5 | `非空站点在 logic-flow tab 点击导入进入统一策略弹窗` | UI 添加模块；真实上传 `x4-export.json`，切到 logic-flow 后点击第一个可导入规划区的 direct-import | `blueprint-import-strategy-modal` 及 cancel/overwrite/add/new 四按钮可见 |
| 3.6 | `非空站点在 x4-station tab 点击导入进入统一策略弹窗` | UI 添加模块，输入固定 x4-game 分享串并点击导入 | `blueprint-import-strategy-modal` 及 cancel/overwrite/add/new 四按钮可见 |
| M9.1 placement | `station panel uses real pointer placement and renders persisted identity` | UI 添加模块，切换地图，打开 station panel，真实 mouse down/move/up（超过 4px）拖到 `cluster_01_sector001_macro` | station item 进入 placed 状态，并出现 blueprint placement overlay |

## 分类与限制

基线 6 项均因旧 setup 缺少 station、3.2/3.4 使用过时 store oracle、3.5 缺少可导入 logic-flow plan 或漏掉 direct-import action 而失败，均为 test-owned/stale。修复后导入 6/6、placement 1/1 通过；测试文件共 7 项。

M9.1 目标仍要求 sector 拖动，以及保存/reload 后核对 `station.location`/`sector.location` 的 cluster、sector、原始 `{x,z}`、sunlight、resources 与 dirty/save identity。当前新增场景已证明 station panel、真实 pointer gate、station location 和 overlay，但尚未构造包含 empire sector 的局部 fixture，也未把保存/reload 断言伪装成通过。后续应在当前 UI 可导入 sector fixture 后补齐该 witness。
