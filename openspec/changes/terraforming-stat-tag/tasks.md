# Terraforming Stat Tag — 实现任务

### 1. TerraformingStatScale.vue

- [x] 新增 emit `clickStat(statId)`
- [x] `.stat-name` 加 `@click.stop` + cursor-pointer + hover 样式

### 2. TerraformingTaskNode.vue

- [x] 新增 emit `clickStat(statId)`
- [x] TerraformingStatScale 上转发 `@click-stat`

### 3. TerraformingTaskList.vue

- [x] 新增 props: `statFilter: Set<string>`, `isEditing: boolean`, `statDisplayNames: Map<string,string>`
- [x] 新增 emit `clickStat(statId)`
- [x] Tag bar UI（panel-header 右侧，所有模式生效）
- [x] `filteredTaskIds` computed：effectToValue !== null + parentMap 祖先包含
- [x] 任务/事件渲染加过滤
- [x] 空 group header 和 events section 隐藏

### 4. TerraformingSectorPanel.vue

- [x] Stats 区域 TerraformingStatScale 转发 `@click-stat`

### 5. TerraformingResourcePanel.vue

- [x] 展开条目/draft 中 TerraformingStatScale 转发 `@click-stat`

### 6. useTerraformingPresenter.ts

- [x] `formatEffectLabel` 移到 `hideBlockEffectPreview` 判断外

### 7. LiveProductionWorkbenchView.vue

- [x] 新增 `statFilter: ref<Set<string>>`
- [x] 新增 `toggleStatFilter(statId)` 方法
- [x] 传递 props/events 给三面板

### 8. 构建验证

- [x] `npm run build` 无编译错误
