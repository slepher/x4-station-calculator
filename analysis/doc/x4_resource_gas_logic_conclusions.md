# X4 气体资源逻辑结论

本文单独整理气体资源部分。  
它与 [x4_resource_logic_conclusions.md](/home/slepher/project/x4-station-calculator/analysis/doc/x4_resource_logic_conclusions.md) 并列，但只保留 gas 相关结论。  
特殊样本另见 [x4_gas_special_case_summary.md](/home/slepher/project/x4-station-calculator/analysis/doc/x4_gas_special_case_summary.md)。

## 1. 证据强度约定

- `已确认`
  - 已有直接代码或稳定样本支撑。
- `高可信`
  - 多个样本和已有逆向共同支持，但未写成完全闭环的代码定理。
- `阶段性模型`
  - 适合当前估算与理解，但不应写成绝对最终结论。

## 2. 当前最稳的 gas 总结构

### 2.1 `resource_areas` 是按 `64k area` 逐格落盘

结论：`已确认`

- gas 不是“按整个 region 一次性写一个总量”。
- 当前最稳的理解仍然是：

```text
游戏先按 64k area 网格离散
-> 再对每个 area 写入该 ware 的 recharge.max
```

- 参考：
  - [x4_resource_algorithm_current.md](/home/slepher/project/x4-station-calculator/analysis/doc/x4_resource_algorithm_current.md)
  - [x4_resource_algorithm_summary.md](/home/slepher/project/x4-station-calculator/analysis/doc/x4_resource_algorithm_summary.md)
  - [x4_gas_special_case_summary.md](/home/slepher/project/x4-station-calculator/analysis/doc/x4_gas_special_case_summary.md)

### 2.2 gas 的 area 值主结构仍可写成 `K(ware) * S(area)`

结论：`高可信`

```text
recharge.max(area, gas)
= K(ware, yield)
 * S(area)
```

其中：

- `K(ware, yield)`
  - 由该 gas 的 `resourcedensity(yield)` 主导
- `S(area)`
  - 是当前 `64k area` 的局部空间因子
  - 主要来自 boundary / falloff / 边界裁切

这条结构仍然是当前最稳的 gas 主模型。

## 3. 当前可直接使用的 gas 经验公式

### 3.1 通用 gas 公式

结论：`高可信`

```text
recharge.max_gas(area)
≈ resourcedensity(yield)
 * lateral_avg
 * S(area)
```

说明：

- `resourcedensity(yield)` 来自 `regionyields`
- `lateral_avg` 是 lateral falloff 的平均值
- `S(area)` 是该 `64k area` 的局部空间因子

- 参考：
  - [x4_resource_algorithm_current.md](/home/slepher/project/x4-station-calculator/analysis/doc/x4_resource_algorithm_current.md)
  - [x4_resource_algorithm_summary.md](/home/slepher/project/x4-station-calculator/analysis/doc/x4_resource_algorithm_summary.md)

### 3.2 `S(area)` 当前更应理解成 tile-average，而不是单点中心值

结论：`高可信`

当前更稳的理解是：

```text
S(area)
= 当前 64k tile 内连续空间场的面积平均
```

而不是简单的：

```text
S(area) = 用 tile 中心点代入 radial 曲线
```

这在小 region、边缘 tile、被 boundary 裁切的场景下尤其重要。

- 参考：
  - [x4_resource_algorithm_current.md](/home/slepher/project/x4-station-calculator/analysis/doc/x4_resource_algorithm_current.md)

## 4. 当前可确认的数据来源

### 4.1 `resourcedensity(yield)` 的来源

结论：`已确认`

- 来源文件：
  [regionyields/final.xml](/home/slepher/project/x4-station-calculator/x4raw_assets/8.0-Diplomacy/libraries/regionyields/final.xml)

- 结构：

```xml
<regionyields>
  <resource ware="hydrogen">
    <yield name="medium" resourcedensity="49500" ... />
  </resource>
</regionyields>
```

因此 gas 资源的基础量级，当前仍然由：

```text
regionyields[ware][yield_tag].resourcedensity
```

给出。

## 5. 特殊案例与主模型的关系

### 5.1 `cluster_06_sector001` 的气体特殊样本不能直接推广成所有 gas 的硬规则

结论：`阶段性模型`

[x4_gas_special_case_summary.md](/home/slepher/project/x4-station-calculator/analysis/doc/x4_gas_special_case_summary.md) 记录了一个很强的样本：

- 同一气体在多个 area 上出现完全相同的 `max`
- 观感上很像“先决定单区标准值，再复制到所有命中的 area”

这个样本说明：

- gas 最终落盘结果可能带有很强的 area 级量化特征

但当前还不能把它提升成：

```text
所有 gas 都一定采用完全相同的整区填充规则
```

所以这里应当这样区分：

- `通用主模型`
  - 仍是 `recharge.max(area) = K * S(area)`
- `特殊样本启发`
  - 某些 gas 场景在最终落盘上，可能表现得比连续积分模型更离散

## 6. 当前不要写成定论的部分

### 6.1 “gas 内部完全没有连续场”

结论：`不保留`

- 当前最多只能说：某些样本的最终落盘结果看起来像 area 级量化。
- 不能直接推出：引擎内部从头到尾都没有连续场或局部空间因子。

### 6.2 “所有 gas 的最终落盘一定是单区标准值乘命中区数”

结论：`不保留`

- 这是特殊案例文档中的强启发，不是当前通用结论。
- 如果要对某个具体气体 region 下死结论，仍然需要结合该 region 的实际样本或更多逆向证据。
