# X4 资源区经验算法总结（当前版本）

## 1. 目标

本文总结当前对 `resource_areas` / `recharge.max` 的经验算法。

重点不是证明 `S(area)` 存在，而是给出**可计算**的近似算法，尤其适用于：

- 常见的小型 region
- 64k area tile 相对 region 不小
- 大量 area 都带明显边界效应的情况

---

## 2. 当前最稳的总结构

### 2.1 存档是按 64k area 逐格生成

`resource_areas` 里的坐标步长固定为 `64000`，因此当前最稳的理解是：

- 游戏先把区域切成 `64k × 64k` 的离散 area tile
- 再对每个 tile 单独计算 `recharge.max`

因此：

\[
recharge.max = \text{per-area value, not per-region one-shot total}
\]

---

### 2.2 同一 area 内，不同 ware 共用同一张空间图

对同一个 area，当前最像的统一形式是：

\[
recharge.max(area, ware)=K(ware)\times S(area)
\]

其中：

- `K(ware)`：该 ware 的倍率常数
- `S(area)`：该 64k tile 的局部空间因子

也就是说：

- 空间分布先由 region 几何决定
- 不同资源只是在同一张空间图上乘不同倍率

---

## 3. Gas 与 Solid 的经验公式

## 3.1 Gas

当前最稳的 gas 公式：

\[
recharge.max_{gas}(area)=resourcedensity(yield)\times lateral_{avg}\times S(area)
\]

若某 gas 的 `resourcedensity = D`，且 lateral 平均值为 `L`，则：

\[
G(area)=D\times L\times S(area)
\]

### 例：hydrogen medium

若：

- `hydrogen medium = 49500`
- lateral 平均值 `L = 0.9`

则：

\[
H(area)=49500\times 0.9\times S(area)=44550\times S(area)
\]

---

## 3.2 Solid

当前最稳的 solid 公式：

\[
recharge.max_{solid}(area)\approx resourcedensity(yield)\times 262144\times lateral_{avg}\times S(area)
\]

即：

\[
M(area)\approx D_{solid}\times 262144\times L\times S(area)
\]

其中：

- `262144 ≈ 64^3`
- 目前最像“满覆盖 tile 的离散采样容量常数”
- 但其物理含义还未最终锁死

---

## 4. `S(area)` 的主算法

这是当前最重要的结论。

## 4.1 不再把“格中心代 radial”当主算法

过去的简化写法是：

\[
S(area)\approx f\!\left(\frac{r_c}{R}\right)
\]

其中：

- `r_c` 是 area 中心点到 region 圆心的距离
- `R` 是 region 半径
- `f` 是 radial falloff

这在**大区中央格**通常很好用，但不适合常见小图。

---

## 4.2 当前主算法：tile-average

对常见小型 region，更稳的经验算法是：

### Step 1：先定义连续场

设 region 水平面上的连续场为：

\[
F(x,z)=f_r\!\left(\frac{\sqrt{(x-x_0)^2+(z-z_0)^2}}{R}\right)\cdot \mathbf{1}_{r\le R}
\]

其中：

- `(x_0, z_0)`：region 的有效圆心
- `R`：region 的有效半径
- `f_r`：radial falloff 的分段函数
- 圆外取 0

### Step 2：对 64k tile 求面积平均

对某个 area tile `T_i`：

\[
\boxed{
S_i=\frac{1}{64000^2}\int_{T_i}F(x,z)\,dA
}
\]

这就是当前最应当采用的 `S(area)` 定义。

换句话说：

> **`S(area)` 不是“格中心单点值”，而是“该 64k tile 内 radial 场的面积平均值”。**

---

## 4.3 数值实现方式

不需要手推闭式积分。

直接对子 tile 做数值采样即可，例如：

- `8×8`
- `16×16`
- `32×32`
- `64×64`

经验上 `32×32` 已经很够用。

采样版公式：

\[
S_i \approx \frac{1}{N}\sum_{k=1}^{N}F(x_k,z_k)
\]

其中 `(x_k, z_k)` 是 tile 内均匀采样点。

---

## 5. 为什么 tile-average 应是主算法

这来自实际使用场景：

- 最常见的是**不够大的图**
- `64k` tile 尺寸与 region 半径同量级
- 很多 tile 都被边界切到
- 因此边界效应不是例外，而是常态

所以应当把：

\[
\boxed{
S(area)=\text{tile-average}
}
\]

当成主模型。

相反：

\[
S(area)\approx f(r_c/R)
\]

只应视为**大图中央格**的简化近似。

---

## 6. 大图与小图的统一理解

### 6.1 小图

小图中：

- tile 相对很大
- 大部分格子都带边界裁切
- 应当认真做 tile-average

### 6.2 大图

大图中：

- 中央大量格子整块都处在近似同一 radial 值区间
- 可近似退化为格中心采样
- 平顶区甚至直接：

\[
S(area)\approx 1
\]

因此：

\[
\boxed{
\text{大图只是 tile-average 模型在小梯度区域的退化情形}
}
\]

---

## 7. 关于 Y / lateral 的处理

region 是 cylinder，且有 `linear` 参数，因此理论上完整分解应为：

\[
\text{resource} \propto f_r(u_r)\times f_l(u_y)
\]

其中：

- `u_r`：水平归一化半径
- `u_y`：纵向归一化位置
- `f_r`：radial falloff
- `f_l`：lateral falloff

但在当前样本里：

- 许多 area 的 `y` 落在 lateral 平台区
- 因此 `f_l(u_y)=1`

所以实际主要难点仍在**水平面的 `S(area)` 计算**，而不是 Y。

---

## 8. 当前可用的完整经验算法

对任意 area：

### Step A：建立几何基底

1. 取 region 的有效圆心 `(x_0,z_0)`
2. 取有效半径 `R`
3. 用 radial falloff 构造连续场 `F(x,z)`

### Step B：对 tile 求平均

对 area 对应的 64k tile：

\[
S_i=\frac{1}{64000^2}\int_{T_i}F(x,z)\,dA
\]

实际用采样近似：

\[
S_i \approx \frac{1}{N}\sum_k F(x_k,z_k)
\]

### Step C：乘倍率常数

#### Gas
\[
G_i = D_{gas}\times L\times S_i
\]

#### Solid
\[
M_i \approx D_{solid}\times 262144\times L\times S_i
\]

---

## 9. 当前最实用的工程结论

## 9.1 若只关心局部可采范围

如果矿船最多只覆盖 `3×3` 九格，则真正需要的是：

\[
Total_{local}=\sum_{\text{这 9 格}} recharge.max_i
\]

而不是整个 region 理论总量。

---

## 9.2 若遇到大图

对大图：

- 中央区直接近似 `S≈1` 或 `S≈f(r_c/R)`
- 只对边缘一两圈 tile 做 tile-average

---

## 9.3 若遇到小图

对小图：

- 全图都应使用 tile-average
- 不要把中心点采样当主算法

---

## 10. 当前尚未最终锁死的部分

以下几点仍待进一步拟合或验证：

### 10.1 有效圆心 `(x_0,z_0)`
实际最佳圆心可能与直观几何中心存在偏移。

### 10.2 有效半径 `R_eff`
经验拟合显示，小图上直接锁死 XML 的 `r` 不一定最优。

### 10.3 `262144` 的物理含义
数值上非常稳，但是否严格对应 `64^3` 体素采样，仍未最终证明。

### 10.4 小图残差项
即使使用 tile-average + 拟合几何参数，局部仍可能存在二维残差：

\[
S(area)\approx S_{base}(area)+\Delta(x,z)
\]

这说明小图可能不只是“理想圆柱裁切”。

---

## 11. 当前推荐的最终写法

把当前算法压缩成一句话：

\[
\boxed{
\text{先由 radial/lateral 定义连续资源场，再对每个 64k area tile 做面积平均，最后乘资源倍率常数。}
}
\]

更具体地：

### Gas
\[
\boxed{
recharge.max_{gas}(area)\approx resourcedensity\times lateral_{avg}\times S(area)
}
\]

### Solid
\[
\boxed{
recharge.max_{solid}(area)\approx resourcedensity\times 262144\times lateral_{avg}\times S(area)
}
\]

其中：

\[
\boxed{
S(area)=\text{该 64k tile 对连续 radial 场的面积平均值}
}
\]

这应当作为当前版本的主算法。

---

## 12. 一句话总结

当前最稳的经验模型是：

> **常见小图：按 tile-average 计算 `S(area)`；**
> **大图中央格：可退化为中心点 radial 近似；**
> **资源值 = 资源倍率常数 × `S(area)`。**
