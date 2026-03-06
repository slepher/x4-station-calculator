# 需求说明：vsn2one

## 目标
收敛系统版本治理路径，形成“四类版本定义各司其职”的单一治理模型：
- empire module vsn
- logic-flow module vsn
- blueprint module vsn
- db fixture 管理 vsn（仅测试）

并统一 migration 核心位置，要求 blueprint migration 入口迁入 `stateMigrations`，store 与 import-export 均调用同一迁移路径。

## 已确认方案（审核重点）
1. 版本治理模型
- 系统应存在唯一四类版本语义：`empire`、`logic-flow`、`blueprint`、`dbfixture`。
- 前三者属于运行时模块 schema version。
- `dbfixture` 仅用于测试夹具版本管理，不参与运行时迁移语义。

2. migration 路径
- 所有历史版本均通过 migration 路径升级，不引入最小支持版本裁剪策略。
- blueprint migration 核心实现迁入 `stateMigrations`，即使当前为 no-op 也要有标准入口。
- store 与 import-export 的 blueprint 路径必须调用该统一入口。

3. 版本定义收敛
- `blueprint` 模块增加与 empire/flow 同级的当前版本常量定义。
- 消除 ship blueprint 版本硬编码散点，改为统一常量引用。

4. fixture 脚本策略
- `scripts/db_fixture.tsx` 直接 import 版本常量，不保留脚本侧硬编码版本。
- `db.json.vsn` 继续作为 fixture 管理版本，按现有 bump 规则维护。

## In Scope
- 版本常量集中化改造（含 blueprint）。
- blueprint migration 入口迁移到 `stateMigrations`。
- store/import-export 对 blueprint 统一迁移调用。
- db fixture 脚本改为直接 import 版本常量。
- 文档与实现语义对齐（模块 version vs fixture vsn）。

## Out of Scope
- blueprint v2/v3 具体字段演进规则设计。
- ship build UI 行为改造。
- 非版本治理相关的功能改造。

## 验收标准（DoD）
1. 运行时模块版本定义可追溯到单一常量源：empire/logic-flow/blueprint 各一个。
2. `stateMigrations` 提供 blueprint 迁移入口，且 store/import-export 复用同一实现。
3. blueprint 版本不再出现分散硬编码。
4. `scripts/db_fixture.tsx` 对模块版本采用直接 import，不再写死数字。
5. `db.json.vsn` 仅作为 fixture 管理版本保留，不与模块 schema version 混用。

## 未决项
无。
