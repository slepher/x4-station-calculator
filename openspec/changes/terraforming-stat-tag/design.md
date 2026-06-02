# 地球化 Stat 标签过滤 — 设计

## 架构

```
LiveProductionWorkbenchView
  statFilter: ref<Set<string>>
  toggleStatFilter(statId: string)
    ├→ TerraformingSectorPanel
    │     └ TerraformingStatScale @click-stat → toggleStatFilter
    ├→ TerraformingTaskList
    │     ├ statFilter (prop)
    │     ├ isEditing (prop)
    │     ├ tag bar UI (header 右侧)
    │     ├ 过滤逻辑 (v-if on task)
    │     └ TerraformingStatScale @click-stat → emit
    └→ TerraformingResourcePanel
          └ TerraformingStatScale @click-stat → toggleStatFilter
```

## 组件改动

### 1. TerraformingStatScale.vue

新增 emit:
```typescript
(e: 'clickStat', statId: string): void
```

模板改 `.stat-name`：
```html
<span class="stat-name" @click.stop="emit('clickStat', model.statId)"
      :class="{ 'cursor-pointer hover:text-sky-400': model.statId }">
  {{ model.statName }}
</span>
```

### 2. TerraformingTaskNode.vue

新增 emit，转发：
```typescript
(e: 'clickStat', statId: string): void
```

TerraformingStatScale 上绑 `@click-stat="emit('clickStat', $event)"`

### 3. TerraformingTaskList.vue

**新 Props**:
- `statFilter: Set<string>`
- `isEditing: boolean`

**新 Emit**:
- `clickStat(statId: string)` → 转发给父组件

**Tag Bar**: panel-header 内右侧
```html
<div v-if="isEditing && statFilter.size > 0" class="stat-tag-bar">
  <span v-for="statId in [...statFilter]" class="stat-tag">
    {{ statDisplayNames.get(statId) || statId }}
    <button @click="emit('clickStat', statId)">×</button>
  </span>
</div>
```

**过滤逻辑** (computed):
```typescript
const filteredTaskIds = computed(() => {
  if (!isEditing || statFilter.size === 0) return null // no filter
  const ids = new Set<string>()
  for (const [projectId, display] of taskNodeDisplays) {
    if (display.statLines.some(line => statFilter.has(line.statId))) {
      ids.add(projectId)
    }
  }
  return ids
})
```

模板中 task 渲染加 `v-if="!filteredTaskIds || filteredTaskIds.has(node.id)"`

### 4. LiveProductionWorkbenchView.vue

```typescript
const statFilter = ref(new Set<string>())

function toggleStatFilter(statId: string) {
  const next = new Set(statFilter.value)
  if (next.has(statId)) next.delete(statId)
  else next.add(statId)
  statFilter.value = next
}
```

传递给子组件:
- SectorPanel: 不需要 statFilter prop，只需 emit `@click-stat="toggleStatFilter"`
- TaskList: `:stat-filter="statFilter" :is-editing="isQueueEditing" @click-stat="toggleStatFilter"`
- ResourcePanel: `@click-stat="toggleStatFilter"`

### 5. TerraformingResourcePanel.vue

展开条目中的 TerraformingStatScale 加 `@click-stat` → emit 向上。

### 6. TerraformingSectorPanel.vue

Stats 区域的 TerraformingStatScale 加 `@click-stat` → emit 向上。
