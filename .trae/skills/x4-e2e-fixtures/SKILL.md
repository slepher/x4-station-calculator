---
name: x4-e2e-fixtures
description: "Use when x4-e2e-test-doc-details needs fixture patch rules or helper guidance for X4 E2E test data."
---

# X4 E2E Fixtures

## 目的

为 `x4-e2e-test-doc-details` 提供 fixture patch 规则和 helper 使用约定。本 skill 不作为完整 E2E 流程中的独立阶段运行。

## 流程位置

在完整 E2E 流程中，fixture 规划由 `x4-e2e-test-doc-details` 执行。本 skill 是该阶段的规则参考：

```text
x4-e2e-test-doc
x4-e2e-test-doc-details
x4-e2e-test-doc-viewer
x4-e2e-test-impl
x4-e2e-test-run
```

不要把本 skill 当成单独运行入口。测试实现阶段消费 `x4-e2e-test-doc-details` 产出的 `fixtures.md` 和 `*.patch.json`。

## 产物边界

- 测试流程资产：
  - `tests/e2e/<change-name>/fixtures/<scenario>-save.patch.json`
  - `tests/e2e/<change-name>/fixtures/<scenario>-db.patch.json`（少数例外）
- Change 侧 fixture 计划：
  - `openspec/changes/<change-name>/fixtures.md`
- 生成工具资产：
  - `openspec/changes/<change-name>/fixtures/generate-<scenario>-save-patch.ts`
  - `openspec/changes/<change-name>/fixtures/generate-<scenario>-db-patch.ts`（少数例外）

`*.patch.json` 属于测试流程，测试直接 import。`fixtures.md` 说明每个 E2E 测试任务是否需要 fixture 数据以及数据性质。`generate-*.ts` 只是生成工具，不参与测试运行。

## 输入

- `openspec/changes/<change-name>/e2e_tests.md`
- `openspec/changes/<change-name>/e2e_test_tasks.md`
- `openspec/changes/<change-name>/knowledge.md`
- 相关基础 fixture：优先 `tests/fixtures/save.json`，少数必要场景使用 `tests/fixtures/db.json`
- 相关现有 E2E 测试与 helper

## 基础文件发现

按顺序确认基础文件：

1. 主要数据来源：`tests/fixtures/save.json`
2. 只有必要时才使用：`tests/fixtures/db.json`
3. 参考同类测试：`tests/e2e/**/fixtures/`、`tests/unified-e2e/**`
4. 需要构造数据时再查：`tests/seeds/*.yaml`

找不到可复用基础文件时停止并说明 blocker，不凭空创建完整 fixture。

## 数据准备优先级

主要 patch 内容应针对 `save.json`。`db.json` 和 localStorage 状态优先通过 UI 操作自然形成。

使用 `db.json` patch 只允许少数必要场景：

- 故意构造 UI 无法产生的错误 localStorage 数据。
- 构造迁移、兼容、损坏状态等边界输入。
- 预置成本极高且与被测行为无关的状态，但必须在 `fixtures.md` 中说明理由。

普通配置、视图切换、筛选条件、绑定选择、用户可操作状态，应在测试中通过 UI 操作完成，而不是写入 `db.json` patch。

## fixtures.md

每个使用本 skill 的 change 都必须维护：

```text
openspec/changes/<change-name>/fixtures.md
```

`fixtures.md` 的职责是只记录 `e2e_tests.md` 中少数需要额外 fixture patch 的主要任务，以及这些任务需要什么性质的数据。大部分 E2E 任务应直接使用基础 fixture 或测试内自然操作，不需要写入 `fixtures.md`。

推荐格式：

```markdown
# E2E Fixtures

## 1 分组入口
- [ ] 1.2 自动分组结果可被确认
  - fixture: group-entry-save.patch.json
  - target: save.json
  - data: 增加包含多玩家站点的 save 片段，用于触发自动分组候选

## 2 地图联动
- [ ] 2.1 地图显示分组后的虚拟站点
  - fixture: map-virtual-station-save.patch.json
  - target: save.json
  - data: 增加玩家站点坐标、关联星区和地图实体
```

规则：

- 只记录需要额外 fixture patch 的任务。
- 不需要 patch 的任务不要写入 `fixtures.md`。
- 不写 `fixture: none`。
- 已记录任务的顶层编号和描述必须来自 `e2e_tests.md`。
- `fixture: <name>.patch.json` 表示该任务需要对应 patch。
- 一个任务可以列多个 patch，按测试载入顺序书写。
- `data:` 描述数据性质，不写完整 JSON 明细。
- `fixtures.md` 不替代 `knowledge.md`；locator、UI 操作经验仍写入 `knowledge.md`。
- patch 文件只为需要额外数据的任务创建。
- `target: db.json` 必须额外写明 `reason:`，说明为什么不能通过 UI 操作形成该 localStorage 状态。

## Patch 命名

每个 patch 必须有具体业务名，一个测试方案可以 import 多个 patch。

推荐：

```text
tests/e2e/<change-name>/fixtures/
  live-binding-save.patch.json
  group-entry-save.patch.json
  corrupt-binding-db.patch.json
```

## Patch 格式

字段：

- `$target`: 必填，优先 `"save.json"`；`"db.json"` 仅用于必要例外
- `$delete`: 可选，dot path 数组
- `$merge`: 可选，要深度合并到基础 JSON 的对象片段
- `$append`: 可选，`dot path -> array items`

至少存在 `$delete`、`$merge`、`$append` 之一。

示例：

```json
{
  "$target": "db.json",
  "$delete": [
    "x4_empire_data.activeEmpire.obsoleteFlag"
  ],
  "$merge": {
    "x4_empire_data": {
      "activeId": "empire-auto-group"
    }
  },
  "$append": {
    "x4_empire_data.activeEmpire.stations": [
      {
        "id": "station-auto-group-alpha",
        "name": "Auto Group Alpha"
      }
    ]
  }
}
```

执行顺序固定：

1. `$delete`
2. `$merge`
3. `$append`

数组在 `$merge` 中默认整体替换；需要追加数组项时使用 `$append`。

## Patch 创建顺序

必须按下面顺序创建 fixture 产物：

1. 先写或更新 `fixtures.md`，列出需要 patch 的 E2E 任务、patch 文件名、target 和数据性质。
2. 对 `fixtures.md` 中每个计划中的 patch 判断来源：
   - 如果 patch 是从基础文件筛选、抽取、转换、排序或计算出来的，必须先创建生成脚本。
   - 如果 patch 只是少量固定字段，且人工维护更清楚，可以直接创建 `*.patch.json`。
3. 对需要生成脚本的 patch：
   - 先创建 `openspec/changes/<change-name>/fixtures/generate-<scenario>-<target>-patch.ts`。
   - 运行生成脚本。
   - 由脚本写出 `tests/e2e/<change-name>/fixtures/<scenario>-<target>.patch.json`。
4. 对不需要生成脚本的 patch：
   - 直接创建 `tests/e2e/<change-name>/fixtures/<scenario>-<target>.patch.json`。
5. 最后统一运行 `validate_e2e_fixture_patch.py` 校验所有 patch。

生成脚本命名：

```text
openspec/changes/<change-name>/fixtures/generate-<scenario>-<target>-patch.ts
```

脚本职责：

1. 默认读取基础 `save.json`；仅必要例外读取 `db.json`。
2. 构造最小 `$delete/$merge/$append` patch。
3. 写入 `tests/e2e/<change-name>/fixtures/<scenario>-<target>.patch.json`。
4. 输出变更摘要。

生成脚本不得修改基础 fixture，不得被测试运行依赖。
不要先手写一个本应由生成脚本产出的 patch，再补生成脚本；这会导致 patch 与生成逻辑漂移。

## 校验

每个 patch 写出后运行 `x4-e2e-test-doc-details` 所属脚本：

```bash
python3 .trae/skills/x4-e2e-test-doc-details/scripts/validate_e2e_fixture_patch.py \
  tests/e2e/<change-name>/fixtures/<scenario>-save.patch.json --json
```

校验脚本只在内存中应用 patch，不生成临时文件，不修改基础文件，不修改 patch。

## 测试载入

测试直接 import 基础文件和 patch 文件，使用 `tests/helper/e2eFixturePatch.ts`。`save.json` patch 主要用于 save/live 数据；localStorage 状态尽量通过 UI 操作形成。

```ts
import dbFixture from '../../fixtures/db.json' with { type: 'json' }
import corruptBindingPatch from './fixtures/corrupt-binding-db.patch.json' with { type: 'json' }
import { loadDbFixtureWithPatches } from '../../helper/e2eFixturePatch'

test.beforeEach(async ({ page }) => {
  await loadDbFixtureWithPatches(page, {
    base: dbFixture,
    patches: [corruptBindingPatch],
    locale: 'zh-CN',
  })
})
```

多个 patch 按数组顺序应用，后面的 patch 可以覆盖前面的 `$merge` 结果。

## 禁止事项

- 不直接修改 `tests/fixtures/db.json` 或 `tests/fixtures/save.json`。
- 不复制完整基础 fixture 到 change 目录。
- 不让测试运行依赖 `generate-*.ts`。
- 不先手写应由生成脚本产出的 patch 再补生成脚本。
- 不为普通用户可操作状态创建 `db.json` patch；应通过 UI 操作形成。
- 不在测试中手写大段 localStorage 对象。
- 不使用 `localStorage.clear()`。
- 不绕过 AGENTS.md 的 E2E beforeEach 规则。
- 不直接改语言 Cookie；语言切换必须通过 UI selector。

## 输出

- patch 文件路径。
- 生成脚本路径，如有。
- `x4-e2e-test-doc-details/scripts/validate_e2e_fixture_patch.py` 结果。
- 测试应 import 的 helper 与 patch 路径。
