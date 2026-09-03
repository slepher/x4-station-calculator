# Coding Task Contract

- Task: `task-coding-1`
- Bundle generation: `1`
- Phase artifact: `task-coding-1.md`
- Plan: `plan-1.md`
- Lane manifest: `lanes-1.md`
- Context: `context-1.md`
- Evidence target: `b62034868643b9d2a9af48ab0f634b067e80880d`
- Task kind: `coding`
- Mode: `normal`
- Mode basis: Sidebar 行为/锚点与相邻规范文档有清晰、无重叠的 owned paths，可串行交付。
- Execution strategy: `split-def`
- Worker role: `def_coding_worker`
- Lane: `coding`
- Worktree: `/home/slepher/project/x4-station-calculator/.worktree/coding`
- Branch: `codex/unified-test-repair-g1-coding`
- Base: `b62034868643b9d2a9af48ab0f634b067e80880d`
- Depends on: `none`
- Covers: `none`

## Bounded goal

把 TabBar 到 Sidebar 的表现变化落实为稳定的行为接口：保留现有导航和菜单语义，补齐测试所需的最小 test-id，并恢复 blueprint station reorder 的 presenter 链路。随后把 station-tabs 主规范、guide 和 sitemap 改写为 Sidebar 表述，禁止通过恢复旧组件/class 兼容测试。

## Normative objectives

- Blueprint/live 的概览、station、Transit、固定工作区、创建、重命名、复制、删除、跳转绑定与折叠行为保持现状。
- Blueprint 多 station 可在 Sidebar 内拖拽重排；唯一领域写入 owner 是 `useEmpireDataStore.reorderStationsInEmpire()`，active station ID 不变，非法集合被拒绝。
- Live 只保留当前星区/空间站顺序语义；没有明确持久化 owner 时不得发明跨星区重排。
- 新 UI 调用链严格为 store -> presenter -> vue；Vue 不得新增直接 store 调用。
- test-id 使用 `context-1.md` 的角色型契约；实体身份使用 `data-station-id`、`data-sector-id`，不得编码名称、翻译或序号。

## Owned paths

产品 subtask 只允许写：

- `src/components/empire/ProductionSidebar.vue`
- `src/components/empire/presenters/useProductionSidebarPresenter.ts`
- `src/components/empire/BlueprintProductionWorkbenchView.vue`
- `src/components/empire/LiveProductionWorkbenchView.vue`
- `src/store/useBlueprintProductionStore.ts`
- `src/store/useLiveProductionStore.ts`

文档 subtask 只允许写：

- `openspec/specs/station-tabs/spec.md`
- `openspec/changes/tab-2-sidebar/specs/sidebar-navigation/spec.md`（仅在消除与主规范矛盾所必需时）
- `guide/empire/tabbar/`
- `guide/empire/index.md`
- `guide/index.md`
- `sitemap.md`

不得写测试、fixture、配置、持久化 schema 或 workflow artifacts。`src/store/useEmpireDataStore.ts` 是只读 owner；若其现有 API 不足，停止并返回 exact reason，不复制逻辑。

## Implementation simplicity

- Standard: `audit-implementation-simplicity`
- Task-specific requirements: 复用现有 `vuedraggable` 与 `reorderStationsInEmpire()`；不新增导航 store、view-model/facade、selector adapter、旧 class shim 或兼容 fallback；test-id 只覆盖真实交互边界；删除重复的 Sidebar 分支逻辑优于添加映射层。
- Required evidence: presenter/store 调用链、所有 `reorderStationsInEmpire` caller、旧 TabBar class 无新增、stable test-id 清单、owned diff、focused commands 与 exit。

## Subtask task-coding-1.1

- Worker role: `def_coding_worker`
- Lane: `coding`
- Depends on sibling subtasks: `none`
- Owned paths: 六个产品路径。
- Observable objective: Sidebar 具备冻结 test-id；blueprint reorder 通过 presenter 到现有领域 owner；所有既有导航/菜单行为不回退。

### Required work

1. 追踪 `ProductionSidebar -> useProductionSidebarPresenter -> blueprint/live store -> useEmpireDataStore` 的当前调用链。
2. 增加根、折叠、星区、星区折叠、station list、上下文菜单动作、删除确认的稳定 test-id；保留现有固定入口 ID。
3. 以最小 `vuedraggable` 接线实现 blueprint station reorder，并使 presenter/store facade 精确拒绝非法输入；不改变 live 持久化模型。
4. 检查键盘可达性和现有 context-menu/collapse 事件，避免 test-id 改动改变行为。

### Focused self-run

```bash
npm run build
npm run test:unit -- tests/unified-unit/production/reorder-stations.spec.ts tests/unified-unit/production/empire-store.spec.ts
git diff --check
```

### Done when

产品路径内行为完成，focused commands 通过，test-id 与 context 契约一致；由 dispatcher 创建 immutable checkpoint 并完成轻量 semantic/simplicity review。

### Stop conditions

需要修改持久化 schema、在 Vue 直连 store、为 live 发明新排序语义、修改测试才能证明产品行为，或需要新增依赖。

## Subtask task-coding-1.2

- Worker role: `def_coding_worker`
- Lane: `coding`
- Depends on sibling subtasks: `task-coding-1.1` reviewed checkpoint
- Owned paths: 本合同列出的文档路径。
- Observable objective: 规范和 guide 明确“Sidebar 是原导航行为的新表现”，不再把旧 TabBar DOM 当行为权威，并记录稳定 test-id。

### Required work

1. 把 station-tabs 的 UI 名称/anchor 改为 Sidebar，同时保留概览、station、菜单与 blueprint reorder 语义。
2. 同步 `tab-2-sidebar` delta 与主规范的冲突，不重写已归档历史。
3. 更新 guide anchor/functions/index 与 sitemap，指向实际组件、presenter、store owner 和 stable test-id。
4. 保持测试目录权威结论不变：unified current，unit/e2e legacy migration source。

### Focused self-run

```bash
npx openspec validate --all
rg -n "overview-tab|station-tab|StationTabBar|SectorStationTabBar" guide/empire openspec/specs/station-tabs sitemap.md
git diff --check
```

保留的历史名称必须有明确迁移语境；当前 anchor/behavior 不得依赖旧 class/component。

### Done when

产品 checkpoint 上的实际行为与文档一致，文档 focused validation 通过，owned paths 外无改动。

### Stop conditions

文档同步需要新增产品语义、删除仍有效的 reorder/menu 需求，或与用户确认“仅表现变化”冲突。

## Blocking self-validation

- Commands: `npm run build`; focused reorder/store unit specs; `npx openspec validate --all`; bounded old-component/test-id audits; `git diff --check`

## Deferred downstream validation

- Commands: 完整 canonical unit suite、Sidebar Playwright 导航/菜单/拖拽链与完整 canonical E2E。
- Owner: `task-test-2`
- Expected transitional failures: coding-1 不修改旧 unified locator/import，因此现有 unit/E2E 失败在相应 test task 完成前仍可能存在；不得把这些失败记为接受。
- Closure gate: test tasks 必须覆盖 coding-1 candidate，在 target-visible integrate revision 上通过对应完整门；产品修正必须回 coding lane。

## Handoff

返回 exact base/candidate、changed paths、store-presenter-vue trace、test-id 清单、reorder observable、命令/exit、文档同步和 deferred evidence。worker 不得 stage/commit/merge 或修改 tests/workflow。
