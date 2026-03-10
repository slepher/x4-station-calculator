# Test Tasks: sector-link

## 1. 纯函数单测（已迁移）

- [x] 1.1 纯函数计算流量相关测试迁移到 `openspec/changes/sector-link-calc/test_tasks.md`

## 2. 星区管理面板单测

- [x] 2.1 星区创建重名自动编号（`2` 起）
- [x] 2.2 星区创建后输入不清空
- [x] 2.3 未分配创建重名自动编号（`2` 起）
- [x] 2.4 未分配创建后输入不清空
- [x] 2.5 未分配创建不自动切页
- [x] 2.6 星区内空间站 `x` 按钮移回未分配
- [x] 2.7 未分配删除：无模块直删
- [x] 2.8 未分配删除：有模块确认后删除

## 3. Tab 与 Store 行为单测

- [x] 3.1 空星区 tab 不显示
- [x] 3.2 空星区分割线不显示
- [x] 3.3 `isEmptyForSave`：仅当星区与空间站都为空时返回 true

## 4. 回归执行

- [x] 4.1 `tests/unit/station-tab-drag/station-tab-bar-empty-sector.spec.ts`
- [x] 4.2 `tests/unit/multi-station-empire/empire-store.spec.ts -t isEmptyForSave`
