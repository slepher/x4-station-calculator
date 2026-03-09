# Knowledge: abandon-selected-ship

## 1. 对齐范围（与 test_tasks.md 同步）
- Store 单测口径：`New` 后 `blueprint` 非空、`blueprint.shipId` 保留、`isDirty=false`。
- Toolbar 可达性口径：未选 ship 时 `New/Save/Save As/Load` 不可达；已选 ship 时可达。
- 关键 E2E 口径：`选船 -> 修改 -> New -> Discard & New` 后仍为 Odachi，且材料面板船体分组可见。
- 状态与迁移 ID：
  - `ship-build-selected-ship-dirty`
  - `ship-build-after-discard-new-same-ship`
  - `切换: ship-build-selected-ship-dirty -> ship-build-after-discard-new-same-ship`

## 2. 固定 ship-build 前置（确定值）
- 目标飞船：`Odachi / 大太刀`。
- 目标 shipId：`ship_ter_m_corvette_02_a`。
- 固定筛选顺序：
  - 先点 `data-testid="ship-build-filter-class-btn-ship_m"`
  - 再点 `data-testid="ship-build-filter-race-btn-terran"`
  - 再点包含 `Odachi|大太刀` 的 `.list-item`
  - 最后点 `data-testid="ship-build-confirm-ship"`
- 进入工作区判定：`data-testid="ship-build-panel-fit"` 可见。

## 3. 定位口径（稳定 locator）
- 语言切换：`select` 控件（文本包含 `简体中文|English`），执行 `selectOption('zh-CN')`。
- ship selector：
  - `data-testid="ship-build-filters"`
  - `data-testid="ship-build-filter-class-btn-ship_m"`
  - `data-testid="ship-build-filter-race-btn-terran"`
  - `data-testid="ship-build-confirm-ship"`
- fit 与候选：
  - `data-testid="ship-build-panel-fit"`
  - `data-testid="slot-ship_ter_m_corvette_02_a::engine::0::0"`
  - `data-testid="equipment-picker"`
  - `data-testid="candidate-engine_am"`
  - `data-testid="candidate-engine_pm"`
- 材料面板：
  - `data-testid="ship-build-panel-materials"`
  - `data-testid="ship-build-material-ship-group"`
- 工具栏按钮（无 data-testid，统一 role+name）：
  - `getByRole('button', { name: /New|新建/ })`
  - `getByRole('button', { name: /^Save$|^保存$/ })`
  - `getByRole('button', { name: /Save As|另存为/ })`
  - `getByRole('button', { name: /Load|载入/ })`
- SmartSaveDialog：
  - `getByRole('button', { name: /丢弃并新建|Discard & New/ })`

## 4. 操作顺序与次数口径（确定性）
- 状态 `ship-build-selected-ship-dirty` 的配装操作固定为 4 步：
  - 第 1 步：点击 `slot-type-engine`。
  - 第 2 步：点击首个 `slot-ship_ter_m_corvette_02_a::engine::*` 槽位。
  - 第 3 步：在 `equipment-picker` 选择非空候选。
  - 第 4 步：点击 `picker-confirm` 落地变更。
- dirty 的 UI 证据固定为 1 条：点击 `New|新建` 后必须出现 SmartSaveDialog 且出现 `丢弃并新建|Discard & New` 按钮。
- 迁移 `ship-build-selected-ship-dirty -> ship-build-after-discard-new-same-ship` 固定为 1 次点击：点击 `丢弃并新建|Discard & New`。

## 5. 断言口径（UI 可观测，禁用 window.store）
- 禁止在 E2E 主断言中使用 `window.shipBuildStore.*`。
- 状态断言：
  - `New|新建` 后 SmartSaveDialog 可见。
  - `丢弃并新建|Discard & New` 按钮可见。
- 迁移后断言：
  - workspace 可见（`ship-build-panel-fit`、`ship-build-panel-materials`）。
  - SmartSaveDialog 不可见。
  - `ship-build-material-ship-group` 主行可见且文本包含 `Odachi|大太刀`。

## 6. Bug 口径（对应 4.1）
- Bug 描述：`New` 后材料船体分组未展示。
- `4.1.4` 修复前断言：`ship-build-material-ship-group` 不可见。
- `4.1.5` 修复后断言：`ship-build-material-ship-group` 可见且主行文本包含 `Odachi|大太刀`。
- `4.1.6` 迁移口径：`ship-build-selected-ship-dirty -> ship-build-after-discard-new-same-ship`。
- `4.1.7` 迁移后 workspace 口径：`ship-build-panel-fit` 与 `ship-build-panel-materials` 均可见。
