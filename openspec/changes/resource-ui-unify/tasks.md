# Resource UI Unify - 任务清单

## 实现任务

### 任务 1：创建/更新游戏数据文件

**目标**：确保 8.0 和 9.0 版本的 `res.json` 包含 `color_rgb` 字段

**步骤**：
1. 检查 `src/assets/x4_game_data/8.0-Diplomacy/data/res.json` 是否包含 `color_rgb` 字段
2. 检查 `src/assets/x4_game_data/9.0-Empire-beta/data/res.json` 是否包含 `color_rgb` 字段
3. 如缺失，为每个资源条目添加 `color_rgb` 字段

**验收**：两个版本的 `res.json` 都包含完整的 `color_rgb` 数据

---

### 任务 2：更新游戏数据加载器

**目标**：从 `res.json` 加载资源颜色数据

**步骤**：
1. 在 `src/store/useGameDataStore.ts` 中添加 `res` 数据加载
2. 在 `src/store/logic/useGameData.ts` 中添加 `res` 数据的预处理逻辑
3. 更新 `resourceColorByWare` 计算属性从 `res` 而非 `regionyields` 读取颜色

**验收**：资源颜色正确显示为 `color_rgb` 的值

---

### 任务 3：UI 布局重构

**目标**：调整搜索框和资源/空间站按钮位置

**步骤**：
1. 修改 `MapWorkbenchView.vue`：
   - 搜索框从 `right-6 top-5` 改为 `left-6 top-5`
   - 资源按钮从 `left-6 top-5` 改为 `left-6 bottom-5`（与空间站按钮并排）
   - 空间站按钮保持在 `left-6 bottom-5`（与资源按钮并排）
2. 移除按钮的 `v-if="!isXxxPanelOpen"` 条件，改为始终显示
3. 添加按钮 active 状态样式（金色高亮边框 + 半透明背景）

**验收**：
- 搜索框位于左上角
- 资源/空间站按钮位于左下角，水平并排
- 打开侧栏时按钮不消失
- 活动侧栏对应按钮高亮显示

---

### 任务 4：Yield 下拉框 5 等级改造

**目标**：将 yield 下拉框改为 5 等级，显示等级名称

**步骤**：
1. 在 `src/locales/en.json` 和 `src/locales/zh-CN.json` 中添加 5 等级的 i18n key（`map.yield_levels.low` 等）
2. 修改 `MapResourceFilterSimplePanel.vue` 和 `MapResourceFilterAdvancedPanel.vue`：
   - 更新 `formatYieldLabel` 函数返回等级名称（如「低」、「中低」）
3. 修改 `src/store/logic/mapResourceFilter.ts`：
   - 添加 `RATING_TO_YIELD_NAME` 和 `YIELD_NAME_TO_RATING` 映射常量
   - 更新 `isSectorMatchedBySelectedIds` 使用 `rating` 字段进行比较
   - 更新 `getContextReachableMaxYieldName` 使用 `rating` 字段
   - 更新 `buildResourceCandidates` 使用 `rating` 计算分数
   - 更新 `buildSectorResourceFill` 使用 `rating` 字段

**验收**：
- 下拉框显示 5 个等级选项：低、中低、中、中高、高
- 等级对应关系：rating 1=低，2=中低，3=中，4=中高，5=高
- 筛选逻辑基于 `maps.json` 中资源的 `rating` 字段

---

### 任务 5：Tooltip 数字格式化

**目标**：实现 tooltip 数字根据数量级格式化显示，数据源改为 respawn

**步骤**：
1. 创建 `src/utils/numberFormatter.ts` 工具函数
2. 修改 `MapSectorTooltip.vue`：
   - 导入数字格式化函数
   - 将资源数值从 `yield/level` 改为 `respawn`
   - 应用格式化函数到显示的数值

**验收**：
- < 1 的数值保留 2 位有效数字（如 `0.000045`）
- ≥ 1 且 < 10 保留 2 位小数
- ≥ 10 且 < 1,000 显示整数
- ≥ 1,000 显示带单位的格式（K/M/B/T/P）
- 数据源为 respawn 值

---

### 任务 6：构建验证

**目标**：确保代码编译通过

**步骤**：
1. 运行 `npm run build`
2. 如有编译错误，修复后重新运行

**验收**：`npm run build` 成功完成，无编译错误

---

## 任务依赖关系

```
任务 1 (res.json 数据) ──> 任务 2 (数据加载器)
任务 3 (UI 布局) ──────────┐
任务 4 (Yield 改造) ───────┼──> 任务 5 (Tooltip 格式化) ──> 任务 6 (构建验证)
```

---

## 完成标准

- [x] 所有 6 个任务完成
- [x] `npm run build` 通过
- [x] 验收标准（DoD）全部满足
