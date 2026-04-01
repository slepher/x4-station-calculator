# Tasks: User Save Detail

## Task List

### T1: i18n 文本新增

**Scope**: 添加 Tab 和标记相关的中英文文本

**Files**:
- `src/locales/zh-CN.json`
- `src/locales/en.json`

**Steps**:
1. 添加 Tab 名称：`tab_player_stations`, `tab_npc_stations`, `tab_abandoned_ships`, `tab_datavaults`, `tab_erlking_vaults`
2. 添加标记文本：`hq_badge`, `has_blueprints`, `has_wares`, `has_signalleak`
3. 添加空提示：`empty_tab`

---

### T2: SaveDetailPanel 重构

**Scope**: 重构组件，实现 5 Tab 结构

**Files**:
- `src/components/save/SaveDetailPanel.vue`

**Steps**:
1. 导入 ViewTabUI 组件
2. 定义 activeTab ref 状态
3. 定义 tabs computed 数组
4. 实现数据过滤函数：
   - `getPlayerStations()` - owner === 'player'
   - `getNpcStations()` - owner !== 'player' && is_headquarter
   - `getAbandonedShips()`
   - `getDatavaults()`
   - `getErlkingVaults()`
5. 实现 `groupBySector()` 分组函数
6. 实现 `tabData` computed 属性
7. 重构 template：
   - 添加 ViewTabUI 到 detail-header
   - 添加 tab-content 区域
   - 实现按 Sector 分组显示
   - 实现各 Tab 的条目显示字段
8. 更新样式：
   - `.tab-content`
   - `.sector-group`
   - `.item-marks`
   - `.mark-badge`

---

### T3: 构建验证

**Scope**: 确保构建成功

**Steps**:
1. 运行 `npm run build`
2. 修复所有编译错误
3. 重新运行 build 直到成功

---

## Task Dependencies

```
T1 (i18n) → T2
T2 (refactor) → T3
```

## Progress Tracking

| Task | Status | Notes |
|------|--------|-------|
| T1 | done | i18n 文本已添加 |
| T2 | done | SaveDetailPanel 已重构 |
| T3 | done | 构建成功 |