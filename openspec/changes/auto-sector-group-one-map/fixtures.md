# auto-sector-group-one-map E2E Fixtures

## 概述

大部分 E2E 测试任务使用标准的 `loadLiveBindingFixture(page)` 即可，无需额外 fixture patch。

标准 fixture 提供：
- Active binding with 5 groups (gameGuid: `CB8837FE-98C1-42F8-9D6A-ED0ADC539111`)
- 1 virtual station draft (无 saveStationCode 的 station plan)
- autoGroupResult 已初始化

## 需要额外 Fixture Patch 的任务

暂无。所有任务可通过 UI 操作从标准 fixture 形成所需状态：

- **进入编辑态**: 点击"编辑"按钮
- **创建 virtual station draft**: 通过 UI 从 blueprint station 拖拽或通过 store 操作 (page.evaluate)
- **设置 virtual trade station**: 在 Trade Station tab 选择 virtual 选项
- **分配颜色**: 点击"计算"触发自动颜色分配

如需为特定子任务添加 patch，在 `tests/e2e/auto-sector-group-one-map/fixtures/` 下创建 `*.patch.json`，并更新本文档。

## Patch 创建规则

参考 `x4-e2e-fixtures` skill 中的规则：
1. 先在本文件记录 patch 需求
2. 判断是否需要生成脚本
3. 需要脚本时创建 `openspec/changes/auto-sector-group-one-map/fixtures/generate-*-patch.ts` 并运行
4. 不需要脚本时直接创建 `*.patch.json`
5. 最后运行 `validate_e2e_fixture_patch.py`

## Patch 存放位置

- `tests/e2e/auto-sector-group-one-map/fixtures/*.patch.json`
- Patch target: `$target: 'db.json'` 或 `$target: 'save.json'`

### db.json patch 使用条件

仅当需要构造以下 UI 无法产生的状态时才使用：
- 故意构造错误数据
- 迁移边界
- 损坏状态
- UI 无法通过正常操作产生的必要状态

必须在 `reason:` 中说明原因。
