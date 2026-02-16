---
name: x4-drag-test
description: Vue drag testing with Playwright Mouse API for vuedraggable/Sortable.js components.
metadata:
  version: "1.0"
---

# Vue Drag Testing

This skill handles drag-and-drop testing for Vue applications using `vuedraggable` (based on Sortable.js).

---

## Design Principle: Signal-Based Drag (MANDATORY)

**Core Principle**: 拖拽只负责发送信号，Store 负责生成节点，Vue 负责渲染。

```
拖拽 → 发送 wareId → Store 生成节点 → Vue 渲染 UI
```

**Why This Matters**:
`vuedraggable` (based on Sortable.js) defaults to **Move** behavior. Even with `pull: 'clone'`, if the target container's DOM structure changes dramatically during drag (e.g., `v-show` toggling views), it may degrade to "move" behavior, causing source nodes to disappear from the candidate zone.

---

## Implementation Guidelines

### 1. Remove Manual DOM Operations
Never use `removeChild` or `setTimeout` to manipulate DOM. Let Vue handle UI updates based on data changes.

### 2. Use Empty List for Drop Zone
Bind the drop zone's `list` to an **empty array**. This prevents `vuedraggable` from trying to insert cloned nodes, ensuring it only triggers the `@add` event:
```vue
<draggable 
  :list="[]"
  :group="{ name: 'wares', pull: false, put: true }"
  @add="handleDropSignal"
  item-key="id"
/>
```

### 3. Clean Clone Function
Return a clean copy in the candidate zone's `clone` function to prevent reference pollution:
```typescript
:clone="(ware) => ({ ...ware, instanceId: Math.random() })"
```

---

## Anti-Patterns to Avoid

- ❌ Manual `item.parentNode.removeChild(item)` in drop handlers
- ❌ Using `setTimeout` to delay DOM operations
- ❌ Mixing direct DOM manipulation with Vue's reactive data flow

---

## Why Standard Drag Events Don't Work

`vuedraggable` is based on Sortable.js, which doesn't listen to native HTML5 Drag Events. Dispatching `dragstart`/`drop` events won't trigger its internal logic.

---

## Recommended Approach: Playwright Mouse API

```typescript
test('drag item from candidate to planning zone', async ({ page }) => {
  const sourceItem = page.locator('.candidate-zone .ware-card').first();
  const targetZone = page.locator('.planning-zone');
  
  const sourceBox = await sourceItem.boundingBox();
  const targetBox = await targetZone.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('Box not found');
  
  // 1. Move to source and press down
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2, 
    sourceBox.y + sourceBox.height / 2
  );
  await page.mouse.down();
  
  // 2. Small movement to trigger drag start
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2 + 10, 
    sourceBox.y + sourceBox.height / 2 + 10
  );
  
  // 3. Drag to target with steps (important for vuedraggable)
  await page.mouse.move(
    targetBox.x + targetBox.width / 2, 
    targetBox.y + targetBox.height / 2, 
    { steps: 20 }
  );
  
  // 4. Assert hover state BEFORE mouse.up()
  await expect(targetZone).toHaveClass(/border-blue-500/);
  
  // 5. Release
  await page.mouse.up();
  
  // 6. Verify data change
  await expect(page.locator('.planning-zone .flow-node')).toBeVisible();
});
```

---

## Key Points for Drag Testing

1. **Use `steps` parameter**: `page.mouse.move(x, y, { steps: 20 })` ensures vuedraggable receives move events
2. **Assert before `mouse.up()`**: Test hover/highlight states while dragging
3. **Wait after drop**: `await page.waitForTimeout(300)` for data updates

---

## dragleave 子元素抖动问题

当拖拽元素从父元素移动到子元素时，父元素会收到 `dragleave` 事件，导致高亮闪烁。Vue 本身不做特殊处理，需要自行实现计数器逻辑：

```typescript
const dragCounters = ref({ A: 0, B: 0 });

const handleDragEnter = (zoneId: 'A' | 'B') => {
  dragCounters.value[zoneId]++;
  if (dragCounters.value[zoneId] === 1) {
    store.enterZone(zoneId); // 真正的进入逻辑
  }
}

const handleDragLeave = (zoneId: 'A' | 'B') => {
  dragCounters.value[zoneId]--;
  if (dragCounters.value[zoneId] === 0) {
    store.leaveZone(zoneId); // 真正的离开逻辑
  }
}

const handleDragEnd = () => {
  store.stopDragging();
  dragCounters.value = { A: 0, B: 0 }; // 重置计数器，防止状态错乱
}
```

---

## Drag Status Classification

| Status | Description | Visual Indicator |
|--------|-------------|------------------|
| Normal | 拖拽到空区域 | `border-blue-500` |
| Duplicated | 拖拽已存在的项目 | `border-red-500` + "Duplicated" 标签 |
| Auto | 拖拽到自动占位符 | 悬停时 "Manual"，非悬停时 "Auto" |
| Isolate | 拖拽到隔离占位符 | 悬停时 "Connect"，非悬停时 "Isolate" |
| Locked | 拖拽匹配阵营的项目 | `border-amber-500` |
| Rejected | 拖拽不匹配阵营的项目 | `border-red-600` + "Rejected" 标签 |

---

## Event Sequence Verification

| Scenario | Event Sequence |
|----------|----------------|
| 成功投放 | `dragstart` → `dragenter` → `drop` → `dragend` |
| 取消拖拽 | `dragstart` → `dragend` (无 `drop`) |
| 悬停后离开 | `dragstart` → `dragenter` → `dragleave` → `dragend` |

---

## Guardrails

- **NEVER** dispatch native HTML5 drag events (`dragstart`, `drop`, etc.)
- **NEVER** use `page.evaluate` to simulate drag behavior
- **NEVER** skip the `steps` parameter in `mouse.move()`
- **NEVER** forget to assert hover states before `mouse.up()`
