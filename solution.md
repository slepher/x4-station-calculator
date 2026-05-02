针对你的新需求，我们需要放弃通用的 Manhattan 路由，转而实现一个**自定义的正交路由算法**。

核心逻辑在于判断 $End.x$ 与 $Start.x$ 的相对位置。为了防止重叠，我们依然引入 **`slotIndex`（轨道索引）** 来为每一条路径分配唯一的垂直和水平偏移。

### 1. 算法逻辑模型

我们将路径拆分为两种模式：

#### **模式 A：终点在右侧 ($End.x > Start.x$) —— 3段线（2个折点）**
1.  **横向伸出**：从起点向右延伸至 `Fixed_X_Offset`。
2.  **纵向过渡**：直接垂直移动到终点的高度。
3.  **横向接入**：水平接入终点。

#### **模式 B：终点在左侧 ($End.x \le Start.x$) —— 5段线（4个折点）**
因为不能直接穿过起点背部，且必须横向进出，需要绕路：
1.  **初始伸出**：从起点向右延伸。
2.  **向上/下绕行**：垂直移动到避障轨道高度（绕过当前 Card）。
3.  **向左跨越**：水平移动到终点左侧。
4.  **二次纵向**：垂直移动到终点高度。
5.  **横向接入**：水平接入终点。

---

### 2. AntV X6 代码实现

你可以通过 `Graph.registerRouter` 注册这个自定义算法：

```typescript
import { Graph, Path, Point } from '@antv/x6'

Graph.registerRouter('industrySmartRouter', (vertices, args, view) => {
  const { sourceAnchor, targetAnchor, index = 0 } = args
  const start = sourceAnchor
  const end = targetAnchor

  // 配置参数
  const GAP = 10 // 路径间的间距，防止重叠
  const OFFSET = 30 + (index * GAP) // 根据索引分配唯一轨道偏移
  const points: Point.PointLike[] = []

  points.push(start)

  if (end.x > start.x + OFFSET * 2) {
    /** * 模式 A: 3段线 (2个折点) 
     * [Start] -> [P1] -> [P2] -> [End]
     */
    const midX = start.x + OFFSET
    points.push({ x: midX, y: start.y })
    points.push({ x: midX, y: end.y })
  } else {
    /** * 模式 B: 5段线 (4个折点) 
     * [Start] -> [P1] -> [P2] -> [P3] -> [P4] -> [End]
     */
    const p1X = start.x + OFFSET
    const p2Y = start.y - OFFSET // 也可以根据障碍物计算向上还是向下绕行
    const p3X = end.x - OFFSET
    
    points.push({ x: p1X, y: start.y }) // 横向出
    points.push({ x: p1X, y: p2Y })    // 纵向绕线
    points.push({ x: p3X, y: p2Y })    // 横向跨越
    points.push({ x: p3X, y: end.y })   // 纵向对齐
  }

  points.push(end)

  // 将点序列转换为 SVG Path
  return Path.normalize(Path.arrayToPathData(points.map(p => [p.x, p.y])))
})
```

---

### 3. 应用到边 (Edge) 并在画布中限制边界

为了确保不超出画板，我们在计算坐标时加入 `Math.max` 和 `Math.min`。

```typescript
const canvasWidth = 800
const canvasHeight = 600

edge.setRouter({
  name: 'industrySmartRouter',
  args: {
    // 这里的 index 应该根据你当前渲染的线缆顺序动态传入
    index: edgeIndex, 
    // 强制限制在画布内的计算逻辑
    padding: 10,
  }
})

// 在自定义路由函数内部完善边界保护：
const clampX = (x: number) => Math.max(10, Math.min(canvasWidth - 10, x));
const clampY = (y: number) => Math.max(10, Math.min(canvasHeight - 10, y));

// 修改 points 推入逻辑示例：
// points.push({ x: clampX(midX), y: clampY(start.y) })
```

---

### 4. 关键点：如何彻底消除“重叠”？

即便终点在左边走四条折线，如果多条线使用同一个 `p2Y` 坐标，它们依然会重叠。

**解决方案：**
1.  **全局索引管理**：为每个 Edge 维护一个 `order`。
2.  **唯一 Y 轴轨道**：
    * 在模式 B 中，`p2Y` 的计算公式应为：`const p2Y = (isTopSide ? Card.minY - 20 : Card.maxY + 20) - (index * GAP)`。
    * 这样每一条线都会在不同的高度进行“向左跨越”，在视觉上就会形成平行的线缆带，允许交叉但绝不重叠。

### 总结
* **右侧模式**：`X(伸出) -> Y(对齐) -> X(接入)`。
* **左侧模式**：`X(伸出) -> Y(绕行) -> X(反向跨越) -> Y(对齐) -> X(接入)`。
* **防重叠**：所有偏移量均乘以 `index` 权重。
