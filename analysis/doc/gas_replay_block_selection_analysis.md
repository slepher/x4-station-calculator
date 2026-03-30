# Gas Replay Block 选择分析

## 问题

gas replay 枚举的 blocks 与存档实际保存的 blocks 不一致：
- replay 只枚举 Y=0 平面，找到 26 个 blocks，total helium = 310,780
- 存档有 Y=-64000, 0, 64000 三层，共 44 个 blocks，total = 381,363
- 存档误差约 -18.5%

## 调查结论

### 1. Nebula 类边界检查机制

经逆向确认：
- Nebula 类 (vtable @ 0x142d07a08) 没有重载边界检查函数
- 边界检查委托给 `+0x2b0` 偏移处的 BoundaryList 对象
- BoundaryList 包含 SplineTubeBoundary 等子对象
- SplineTubeBoundary (vtable @ 0x142bde590) 有自己的边界函数：
  - `+0x38` = `FUN_14093eb60` (2D XZ 检查，忽略 Y)
  - `+0x58` = `FUN_14093ed40` (lateral interval，通过 spline 参数 t)
  - `+0x70` = `FUN_14093ee10` (radial interval)

### 2. 2D XZ 检查的设计意图

`FUN_14093eb60` 只做 2D XZ 检查是正确的设计：
- 径向距离：XZ 平面上的点到 spline 中心线的距离
- 轴向位置：通过 spline 参数 t 隐式编码 Y 坐标
- lateral profile 决定 Y 方向的 falloff

### 3. Y 层枚举问题

存档数据显示游戏枚举了 Y 层：
- Y=0: 21 blocks (nebula_2), total = 214,089
- Y=64000: 16 blocks (nebula_2), total = 140,785
- Y=-64000: 7 blocks (nebula_2), total = 26,489

这些 Y=±64000 的 blocks 在 tube 的 Y 范围之外，但它们的 query box 与 tube 有 overlap。

## 关键发现：六边形网格 vs 方格网格

经逆向确认，`FUN_14093eb60` 使用**六边形网格 (Hexagonal Grid)** 坐标：

```c
// 六边形网格坐标计算 (尖顶六边形 Pointy-topped Hex)
fVar4 = (float)(int)param_3 * 1.5 * param_5;     // X = col * 1.5 * size
fVar3 = (float)param_4 * param_5 * 1.5;          // Z 基础值
if ((param_3 & 1) != 0) {
    fVar3 = fVar3 + param_5 * 0.8660254;         // 奇数列 Z 偏移 = √3/2 * size
}
```

关键常量验证：
- `DAT_142d80234 = 1.5`
- `DAT_142d80300 = 1.5`
- `DAT_142d80044 = 0.8660254 ≈ √3/2`

### param_5 (网格大小) 来源追踪

经逆向 `FUN_14070f330` 确认，`param_5` (六边形网格大小) 从全局对象读取：

```asm
; FUN_14070f330 开头的六边形网格计算
14070f45e: MOVSS XMM6, dword ptr [R15 + 0x47d4]   ; XMM6 = hex_grid_size
14070f467: MOVD XMM2, ESI                          ; col
14070f46b: CVTDQ2PS XMM2, XMM2                     ; (float)col
14070f46e: MULSS XMM2, dword ptr [0x142d80234]    ; col * 1.5
14070f476: MULSS XMM2, XMM6                        ; X = col * 1.5 * hex_size
14070f47a: MOVD XMM1, R14D                          ; row
14070f47f: CVTDQ2PS XMM1, XMM1                     ; (float)row
14070f482: MULSS XMM1, XMM6                        ; row * hex_size
14070f486: MULSS XMM1, dword ptr [0x142d80300]    ; Z = row * hex_size * 1.5
14070f48e: TEST SIL, 0x1                            ; col & 1 ?
14070f492: JZ 0x14070f4a3
14070f494: MOVAPS XMM0, XMM6                        ; hex_size
14070f497: MULSS XMM0, dword ptr [0x142d80044]    ; hex_size * sqrt(3)/2
14070f49f: ADDSS XMM1, XMM0                         ; Z += offset (奇数列)
```

### 关键常量表 (地址 0x142d80990)

| 地址 | 值 (float) | 十六进制 | 用途 |
|------|-----------|----------|------|
| DAT_142d80990 | 55425.625 | 0x476a6000 | query_radius |
| DAT_142d80994 | 64000.0 | 0x477a0000 | **hex_grid_size** |
| DAT_142d80998 | 100000.0 | 0x477d5c00 | ? |
| DAT_142d8099c | 262144.0 | 0x477fe000 | ? |
| DAT_142d809f8 | 262144.0 | - | 最大搜索距离 |

### 六边形网格枚举流程

```
FUN_14070f330 (col, row) → FUN_14093b8b0 (BoundaryList) → +0x38 slot (FUN_14093eb60)
```

1. **FUN_14070f330**: 顶层枚举函数
   - 接收 (col, row) 六边形网格坐标
   - 计算世界坐标 X, Z
   - 调用 `FUN_14093b8b0` 检查边界

2. **FUN_14093b8b0**: 边界列表遍历
   - 遍历 BoundaryList 中所有边界对象
   - 对每个对象调用 `+0x38` vtable slot
   - 传递 `param_3=col, param_4=row, param_5=hex_grid_size`

3. **FUN_14093eb60**: 六边形网格边界检查
   - 计算世界坐标: X = col * 1.5 * size, Z = row * 1.5 * size + 奇数列偏移
   - 进行 2D XZ 距离检查

### Python 脚本的问题

当前 Python 脚本使用 **64km 方格网格**：
```python
# 方格网格枚举
x = start_x
while x <= end_x:
    z = start_z
    while z <= end_z:
        coords.append((x, 0, z))
        z += 64000
    x += 64000
```

而游戏使用**六边形网格**，这导致边缘地带的 Block 选取不一致。

### 其他差异

| 特性 | C++ 原型 | Python 实现 |
|------|----------|-------------|
| 网格类型 | 六边形网格 | 64k 方格 |
| 坐标变换 | 支持矩阵旋转/缩放 | 仅世界坐标平移 |
| 维度检查 | 2D XZ 投影 | 2D XZ 预选 + 3D falloff |
| 判定阈值 | (R_tube + R_query)² | (R_tube + R_query) |