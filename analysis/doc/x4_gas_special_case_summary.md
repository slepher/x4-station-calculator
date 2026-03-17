# X4 气体资源特殊案例现状总结（cluster_06_sector001）

## 1. 案例范围

本案例针对同一组 40km 级气体/矿物 region 在 `cluster_06_sector001_macro_resources.xml` 中的落盘结果，重点只看：

- `helium`
- `hydrogen`
- `methane`

这里的目标**不是研究空间分布**，而是总结这个特殊案例对“总量公式”与“气体是否整区填充”两条判断的启发。

---

## 2. 观察到的核心现象

### 2.1 存档按 64k area 离散记录

该 sector 的 `resource_areas` 明确是按 `64k × 64k` area tile 记录的。当前样本中出现的 area 包括：

- `(64000, 0)`
- `(0, 0)`
- `(64000, -64000)`
- `(0, -64000)`

这再次支持：

> `resource_areas` 是 **per-area 落盘**，不是按整个 region 一次性写入总量。

---

### 2.2 三种气体的 area 数量不同，但单区数值极其整齐

从存档可直接读出：

- `helium`：1 个 area，`max = 34649`
- `hydrogen`：2 个 area，每个都是 `max = 173249`
- `methane`：4 个 area，每个都是 `max = 17324`

因此它们的总量为：

- `helium total = 34649`
- `hydrogen total = 173249 × 2 = 346498`
- `methane total = 17324 × 4 = 69296`

这一点非常关键：

- `hydrogen` 的两个区是同值
- `methane` 的四个区也是同值

所以在这个案例里，气体落盘结果**不像“每格各自算出不同积分值”**，而很像：

> 先决定单区标准值，再把它复制到所有被命中的 area。

---

## 3. 与 yield 密度的关系

对应的 `regionyields_final.xml` 中，相关密度为：

- `helium medhigh = 50000`
- `hydrogen medhigh = 250000`
- `methane medium = 25000`

于是单区数值与密度比对如下：

- helium 单区：`34649`
- methane 单区：`17324`，约为 helium 的 `1/2`
- hydrogen 单区：`173249`，约为 helium 的 `5 倍`

而密度关系正好也是：

- methane / helium = `25000 / 50000 = 1/2`
- hydrogen / helium = `250000 / 50000 = 5`

这说明：

> 在这个案例里，**单区标准值与 `resourcedensity(yield)` 基本按比例缩放**。

也就是说，至少对本案例：

\[
V_{unit}(ware) \propto resourcedensity(yield)
\]

---

## 4. 对当前经验公式的影响

## 4.1 旧思路：per-area 连续场 / tile-average

当前主总结文档中的主模型是：

\[
recharge.max(area, ware)=K(ware)\times S(area)
\]

其中 `S(area)` 由 radial 场在 64k tile 上做面积平均得到，即 tile-average 思路。

这个模型对：

- 固体资源
- 一般 area 局部分析
- 解释边缘格差异

仍然是当前最稳的通用框架。

---

## 4.2 本特殊案例显示：Gas 的落盘结果可能比主模型更离散

但在这个特殊案例里，gas 的实际落盘结果呈现出更强的 area 级量化特征：

- 不是同一资源在多个 area 上出现不同 `max`
- 而是同一资源在多个 area 上出现完全相同的 `max`

因此对 gas，至少在这个案例中，更像：

\[
Total_{gas} \approx V_{unit}(ware,yield) \times N_{filled\ areas}
\]

其中：

- `V_unit`：该气体的单区标准值
- `N_filled areas`：被填充的 area 数量

对应本例：

- helium：`N = 1`
- hydrogen：`N = 2`
- methane：`N = 4`

---

## 5. 对“falloff 是否符合经验公式”的现状判断

如果只看总量，而不看分布，那么本案例支持：

> falloff 仍然在起作用，但它未必以“每个 area 独立连续积分”的形式直接落盘。

更像的情况是：

1. 引擎内部仍然可能由 region 几何 / falloff 决定“命中多少个区”
2. 一旦命中某区，就给该区一个标准值
3. 最终总量由“单区值 × 命中区数”给出

所以，按总量视角，本案例更适合写成：

\[
Total_{gas} \approx V_{unit}(ware,yield) \times N_{filled\ areas}
\]

而不是继续强调：

\[
Total = \sum_i D\times L\times S_i
\]

后者在理论上仍可成立，但在这个特殊案例里，前者更贴近实际落盘表现。

---

## 6. 当前最合理的解释

截至目前，这个案例最合理的解释是：

### 6.1 不是 methane 专用特判

因为：

- `hydrogen` 也呈现“多区且每区同值”
- `methane` 不是唯一表现出这种结构的气体

所以它**不像“methane 被单独特判”**。

---

### 6.2 更像 Gas 的统一 area 级填充规则

当前最像的是：

> 对 gas，最终写入 `resource_areas` 的结果，可能采用了某种 **按区填充 / area 级量化 / 整块赋值** 的统一规则。

也就是说：

- 内部也许仍有连续场
- 但最终落盘成 `resource_areas` 时，被压成了“命中该区就填一个标准值”的形式

这正是本案例中最强的直观特征。

---

## 7. 当前不能下死结论的地方

虽然“整区填充”观感很强，但当前仍有几件事**还不能完全证明**：

### 7.1 不能证明 gas 内部完全没有连续场

现在能证明的是：

- **落盘结果**像整区填充

但还不能证明：

- 引擎内部从一开始就完全没有 radial / tile-average 计算

因此更稳妥的说法应当是：

> **Gas 的最终落盘结果，很可能经过了统一的 area 级离散化。**

而不是：

> **Gas 从内部逻辑上就完全没有连续积分。**

---

### 7.2 不能证明所有 gas region 都必定采用同一规则

本案例很强，但仍然只是一个高价值样本。

当前只能说：

- 本案例高度支持“gas 按区填充”的解释
- 但还需要更多样本验证其普遍性

---

## 8. 当前建议的临时结论

如果后续目标仍然是“只关心资源总量，不关心分布”，那么本案例下最适合采用的临时模型是：

\[
\boxed{
Total_{gas} \approx V_{unit}(ware,yield) \times N_{filled\ areas}
}
\]

其中：

- `V_unit` 与 `yield` 的 `resourcedensity` 成比例
- `N_filled areas` 由 region 几何 / falloff / area 离散化共同决定

本案例中：

- `helium`: `34649 × 1`
- `hydrogen`: `173249 × 2`
- `methane`: `17324 × 4`

这一写法比连续分布模型更贴近当前观察到的实际结果。

---

## 9. 一句话总结

这个特殊案例的现状可以概括为：

> **对 gas，当前样本更像“先决定单区标准值，再按命中的 64k area 数做整区填充”，而不像每个 area 都独立保留连续积分差异。**

因此：

- 它更像引擎统一的 **area 级离散化规则**
- 不像某一种气体（如 methane）的专门特判
- 对“只研究总量”的目标而言，这个模型比 tile-average 分布模型更实用

