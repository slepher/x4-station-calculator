# 地球化 Stat 标签过滤

## 目标

在所有模式下增加 stat 标签过滤功能。点击三处面板中任意 stat 名称，添加对应 stat 的过滤标签。TaskList 仅显示 effects 命中该 stat 的任务。子项目命中时其祖先项目一并显示。多标签为 OR 逻辑。

## 已确认方案

### 触发入口

三处 stat 名称可点击：
1. **TaskList / TaskNode** — 每个任务的 `TerraformingStatScale` stat 名称
2. **SectorPanel item 模式** — stats 区域 `TerraformingStatScale` stat 名称
3. **ResourcePanel 展开条目** — stat 变化行中的 stat 名称

### 交互

- 点击 stat 名称 → toggle 标签（新增/删除）
- tag 带 × 删除按钮，可单独删除
- 多 tag 之间为 OR 逻辑
- 所有模式生效（不限于编辑模式）

### 过滤逻辑

- `statFilter` 为空 → 显示全部任务
- 匹配规则：`taskNodeDisplays[projectId].statLines` 中任一 `line.statId` ∈ filter 且 `line.effectToValue !== null`（仅 effects，不含 conditions）
- 子项目命中 → 祖先链上溯全部标记为可见
- events 分组同样被过滤（无特殊排除）
- 过滤后为空的 group header 整体隐藏

### Tag Bar 位置

TaskList 的 `panel-header` 右侧，tag 以圆角药丸形式排列（`rounded-full bg-sky-500/20 text-sky-400`）

### 已完成项目效果文本

- 方块方向标记已隐藏（`hideBlockEffectPreview`）
- 效果文本 `effectLabel` 始终显示（`formatEffectLabel` 移到条件判断外）

## 边界

### In Scope

- `TerraformingStatScale.vue`：新增 `clickStat` emit，`.stat-name` 可点击
- `TerraformingTaskNode.vue`：转发 `clickStat` 事件
- `TerraformingTaskList.vue`：tag bar UI + 过滤逻辑（effectToValue 判断 + 祖先包含 + 空组隐藏）
- `TerraformingSectorPanel.vue`：转发 stat 点击
- `TerraformingResourcePanel.vue`：转发 stat 点击
- `LiveProductionWorkbenchView.vue`：管理 `statFilter: Set<string>`
- `useTerraformingPresenter.ts`：`formatEffectLabel` 移到 `hideBlockEffectPreview` 判断外

### Out of Scope

- 持久化过滤状态
- AND 逻辑过滤

## 验收标准

1. 点击任意面板的 stat 名称 → tag bar 新增对应标签
2. 再次点击同一 stat → 对应标签删除
3. 点击 tag × → 删除该标签
4. 有 tag 时 TaskList 仅显示 effects 命中该 stat 的任务
5. 子项目命中 → 祖先项目保持可见
6. 空 group 和空 events section 隐藏
7. 清空所有 tag → 恢复显示全部任务
8. 已完成项目效果文本可见
9. `npm run build` 无编译错误

## 未决项

无
