# X4 资源区 `recharge.max` 生成算法总结（当前版本）

## 一、目前最稳的总结构

### 1）存档不是按整个 region 一次性算总量

而是先把 region 切成固定步长的 **64k × 64k area 网格**，然后**逐格生成** `resource_areas`。

所以本质上：

\[
recharge.max = \text{per-area value, not per-region total}
\]

---

### 2）同一个 area 内，不同 ware 共用同一张空间分布图

也就是同一格里：

- hydrogen
- ore
- nividium

会一起涨跌，只是倍率不同。

所以最像的统一形式是：

\[
recharge.max(area, ware)=K(ware)\times S(area)
\]

其中：

- `K(ware)` = ware 自己的常数项
- `S(area)` = 这个 64k area 的局部空间因子

---

## 二、这个 `S(area)` 是什么

### 当前最稳的理解

`S(area)` 主要由 region 的：

- boundary
- falloff（尤其 radial）
- 可能再加上边缘裁切 / 格内平均

共同决定。

对 gas 来说，现阶段样本显示它非常接近：

\[
S(area)\approx f\!\left(\frac{r}{R}\right)
\]

其中：

- \(r=\sqrt{x^2+z^2}\)
- \(R=\) region 半径
- \(f\) 是 radial 分段函数

但更稳妥的说法仍然是：

\[
S(area)=\text{该 64k area 的局部空间因子}
\]

因为它未必总是“纯格心 radial 值”，边缘格可能更像**格内平均**。

---

## 三、Gas 的算法

这是目前最稳的一部分。

### 1）单格公式

对 gas：

\[
recharge.max_{gas}(area)
=
resourcedensity(yield)\times \overline{L}\times S(area)
\]

其中：

- `resourcedensity(yield)` 来自 `regionyields_final.xml`
- `\overline{L}` 是 lateral 的平均值
- `S(area)` 是局部空间因子

---

### 2）样本中的 hydrogen

对于 `region_cluster_26_sector_001`：

- `resource ware="hydrogen" yield="medium"`
- `hydrogen medium resourcedensity = 49500`

其 lateral 为标准梯形：

- `0 → 0.1` 线性升
- `0.1 → 0.9` 恒 1
- `0.9 → 1` 线性降

所以 lateral 平均值：

\[
\overline{L}=0.9
\]

因此 hydrogen 的单格公式就是：

\[
H(area)=49500\times 0.9\times S(area)=44550\times S(area)
\]

---

### 3）如果 area 不在边缘裁切区，中间段可直接代 radial

该 region 的 radial 可写成：

\[
f(u)=
\begin{cases}
1, & 0\le u\le 0.3\\
1.15-0.5u, & 0.3<u\le 0.5\\
1.525-1.25u, & 0.5<u\le 0.9\\
4(1-u), & 0.9<u\le 1\\
0, & u>1
\end{cases}
\quad,\quad u=r/R
\]

所以在“普通中间格”上，当前最像：

\[
H(x,z)\approx 44550\times f\!\left(\frac{\sqrt{x^2+z^2}}{750000}\right)
\]

---

## 四、已验证的中间点样例

取离散点：

\[
(x,z)=(448000,320000)
\]

### 1）计算半径

\[
r=\sqrt{448000^2+320000^2}\approx 550548.817
\]

\[
u=\frac{r}{750000}\approx 0.734065
\]

因为 \(0.5<u<0.9\)，落在第三段：

\[
f(u)=1.525-1.25u
\]

代入得：

\[
f(0.734065)\approx 0.607419
\]

### 2）理论值

\[
H(area)=49500\times 0.9\times 0.607419
\]

\[
49500\times 0.9=44550
\]

\[
H(area)=44550\times 0.607419\approx 27060.5
\]

### 3）存档实际值

该点在存档中的 hydrogen `recharge max` 为：

\[
27062
\]

差值仅约：

\[
1.5
\]

相对误差约：

\[
0.0055\%
\]

这说明对中间区的 gas 点位，当前公式非常贴合。

---

## 五、Solid 的算法

这部分已经很强，但还没 gas 那么“锁死”。

### 1）当前最像的单格公式

\[
recharge.max_{solid}(area)
=
resourcedensity(yield)\times C_{solid}\times \overline{L}\times S(area)
\]

其中：

\[
C_{solid}\approx 262144
\]

于是可写成：

\[
recharge.max_{solid}(area)
\approx
resourcedensity(yield)\times 262144\times 0.9\times S(area)
\]

---

### 2）为什么会出现 262144

目前最强的候选解释是：

\[
262144 = 64^3
\]

也就是：

> **一个 64k area 内部，solid 可能用 64×64×64 的离散采样体素计数**

这样就能把 solid 写成：

\[
recharge.max_{solid}(area)
\approx
resourcedensity(yield)\times 0.9\times V(area)
\]

其中：

- \(V(area)\) = 该 area 内有效体素数
- 满覆盖时：
  \[
  V(area)\approx 64^3=262144
  \]

这比“凭空多了一个常数”更像真实实现。

---

### 3）但这点还没最后证明

目前只能说：

- 数值上非常像
- 工程直觉上也很合理
- 但还不能 100% 断言游戏内部一定就是 `64^3 voxel`

所以更稳的写法仍然是：

\[
C_{solid}\approx 262144
\]

至于它的物理含义，当前最可能是“满覆盖离散采样数”。

---

## 六、`densityfactor` 目前看不像参与 `recharge.max`

你前面通过 ore / nividium 的对比基本说明：

- asteroid group 的 `densityfactor` 不同
- 但 area 的 `recharge.max` 空间图仍主要按 `resourcedensity` 成比例缩放

所以目前更像：

\[
densityfactor \text{ affects asteroid object density / visuals, not recharge.max}
\]

也就是它更像影响：

- 可见小行星对象数量
- 场景密度
- 采矿对象分布

而不是存档里的 `resource_areas.recharge.max`。

---

## 七、总量怎么理解

这里要严格分成两种。

### 1）机制本体：离散求和

更贴近游戏生成逻辑的是：

#### Gas
\[
Total_{gas}
=
resourcedensity\times \overline{L}\times \sum_{\text{all 64k areas}} S_i
\]

#### Solid
\[
Total_{solid}
\approx
resourcedensity\times 262144\times \overline{L}\times \sum_{\text{all 64k areas}} S_i
\]

也就是说：

> 先逐格生成，再把格子加总。

---

### 2）连续近似：只是一种估算工具

如果 region 很大、格子很多，可以用连续积分近似离散求和：

\[
\sum_i S_i \approx \frac{1}{64000^2}\int_{\text{disk}} f(r)\,dA
\]

于是才会得到：

\[
Total_{gas}
\approx
resourcedensity\times \overline{L}\times
\frac{\pi R^2}{64000^2}
\times
\left(2\int_0^1 u f(u)\,du\right)
\]

这里那个 \(u\) 权重不是说“falloff 本身会随面积增大”，而只是：

> **外圈有更多 area tile，离散求和在大尺度上的统计近似**

---

## 八、如果只关心矿船实际可采范围

那就根本没必要算整个 region。

如果矿船实际最多只会覆盖比如 **3×3 九格**，那么你真正该算的是：

### Gas 局部可采总量
\[
H_{local}=44550\times \sum_{\text{采矿范围内格子}} S_i
\]

如果九格都在中心平顶区：

\[
S_i\approx 1
\]

则：

\[
H_{3\times 3}\approx 9\times 44550=400950
\]

这比“整个 region 总量”对实际采矿更有意义。

---

## 九、目前最像真的完整算法（伪代码）

### Gas

```text
for each 64k area tile:
    compute local spatial factor S(area)
    recharge_max(area, gas) =
        resourcedensity(yield) * lateral_avg * S(area)
```

### Solid

```text
for each 64k area tile:
    compute local spatial factor S(area)
    recharge_max(area, solid) ≈
        resourcedensity(yield) * 262144 * lateral_avg * S(area)
```

然后把这些 area 写进存档里的 `resource_areas`。

---

## 十、当前最稳的结论清单

### 基本可以当成成立的

\[
\text{存档资源是按 64k area 逐格生成的}
\]

\[
\text{同一 area 内不同 ware 共用同一张空间分布图}
\]

\[
Gas = resourcedensity \times lateral_{avg} \times S(area)
\]

\[
\text{这份样本里 hydrogen = 49500 \times 0.9 \times S(area)=44550\times S(area)}
\]

\[
\text{Solid 比 gas 多一个 } \approx 262144 \text{ 的尺度因子}
\]

\[
densityfactor \text{ 目前看不像参与 } recharge.max
\]

---

### 还没彻底锁死的

\[
S(area)\text{ 到底是格心采样，还是 tile 面积平均？}
\]

\[
262144\text{ 是否就是 }64^3\text{ 体素采样数？}
\]

\[
\text{边缘格是否还包含额外的裁切 / 量化规则？}
\]

---

## 十一、一句话总总结

目前最像真实存档生成逻辑的是：

> **游戏先把 region 切成 64k area 网格，对每个格子按局部 falloff 生成 `recharge.max`。**
>
> **Gas：**
> \[
> recharge.max = resourcedensity \times lateral_{avg} \times S(area)
> \]
>
> **Solid：**
> \[
> recharge.max \approx resourcedensity \times 262144 \times lateral_{avg} \times S(area)
> \]
>
> 其中 `S(area)` 是该格的局部空间因子；不同 ware 共用同一张空间图，只是倍率不同。
