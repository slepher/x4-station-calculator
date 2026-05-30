# icon.md — Research & Terraforming 图标转换记录

## 最终方案（方案 D：去环 + 规整圆环重绘）

**操作流程：**

1. 测量原始 alpha 通道中环的精确几何参数（中心、外半径、内半径、环厚）
2. 用**径向渐隐**替代硬截断：r ∈ [30, 38] 区间 alpha 线性衰减至 0，避免像素网格截断产生的锯齿被 potrace 拟合成波状轮廓（扩散的根源）
3. 渐隐后的 alpha → PGM (L mode) → potrace → 内圈 SVG path
4. SVG 中叠加 `<circle cx="640" cy="640" r="440" stroke-width="100"/>` 作为规整外环

**测量结果（720 角度采样，50% alpha 阈值）：**

| 参数 | tlt_research | tlt_terraforming |
|------|-------------|-----------------|
| 环外半径 | 49.0 px (std=0.29) | 49.0 px (std=0.50) |
| 环内半径 | 39.0 px (std=0.74) | 39.0 px (std=0.72) |
| 环厚 | 10.0 px (std=0.80) | 10.0 px (std=0.84) |

```bash
python3 << 'PYEOF'
from PIL import Image
import numpy as np, subprocess, os

FADE_START = 30          # full alpha preserved up to this radius
FADE_END   = 38          # alpha linearly fades to 0 between START and END
RING_MID = 440           # potrace coords: (49+39)/2 * 10
RING_SW  = 100           # potrace coords: (49-39) * 10
CX = CY = 640            # potrace coords: 64 * 10

for name in ['tlt_research', 'tlt_terraforming']:
    img = Image.open(f'src/components/icons/{name}.png').convert('RGBA')
    arr = np.array(img)
    alpha = arr[:,:,3].copy().astype(float)
    h, w = alpha.shape

    ys, xs = np.mgrid[0:h, 0:w]
    dists = np.sqrt((xs - w//2)**2 + (ys - h//2)**2)

    # Smooth radial fade instead of hard cut
    fade = np.clip((FADE_END - dists) / (FADE_END - FADE_START), 0, 1)
    alpha = alpha * fade

    bitmap = np.where(alpha > 128, 0, 255).astype(np.uint8)
    Image.fromarray(bitmap, 'L').save(f'{name}.pbm')

    subprocess.run(['potrace', '-s', '-o', f'src/components/icons/{name}.svg', f'{name}.pbm'], check=True)
    os.remove(f'{name}.pbm')

    with open(f'src/components/icons/{name}.svg') as fp:
        svg = fp.read()
    svg = svg.replace('fill="#000000"', 'fill="#ffffff"')
    ring = f'<circle cx="{CX}" cy="{CY}" r="{RING_MID}" fill="none" stroke="#ffffff" stroke-width="{RING_SW}"/>'
    svg = svg.replace('</g>', f'{ring}\n</g>')

    with open(f'src/components/icons/{name}.svg', 'w') as fp:
        fp.write(svg)
    print(f'{name}.svg done')
PYEOF
```

**原因分析：**

- 「浸染」不是 potrace bezier 优化合并，而是外环和内圈在 × 形对角线方向原本就连在一起（alpha 通道中无间隙），potrace 不可能将它们分开
- Plan A 看似无浸染是因为「拓印」副作用：`alpha_composite → convert('L')` 时半透明灰色像素 L<128 被判为背景，意外侵蚀了形状边缘，使间隙拉开
- Plan B 只用 alpha 阈值不侵蚀，保持了原始连接，自然「浸染」

## 历史方案

### 方案 A：L 转换法（废弃 — 拓印副作用伪装了问题）

与 `5dfe02b7` 相同。`alpha_composite + convert('L')` 生成过渡像素，内外边界自然分离。
**实际原理：**`.convert('L')` 使用亮度公式（0.299R+0.587G+0.514B），半透明灰色抗锯齿像素 L<128 被判为背景，等于意外侵蚀了形状边缘 1-2px，使间隙拉开。
**副作用：**暗色不透明元素也会被判为背景（拓印效果），且需要复杂的背景矩形裁剪和坐标修复。

```bash
python3 << 'PYEOF'
from PIL import Image
import numpy as np, subprocess, os, re

for name in ['tlt_research', 'tlt_terraforming']:
    img = Image.open(f'src/components/icons/{name}.png').convert('RGBA')

    # alpha_composite + L convert (original method)
    bg = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out = Image.alpha_composite(bg, img).convert('L').point(lambda x: 255 if x > 128 else 0, '1')
    out.save(f'{name}.pbm')

    subprocess.run(['potrace', '-s', '-o', f'src/components/icons/{name}.svg', f'{name}.pbm'], check=True)
    os.remove(f'{name}.pbm')

    with open(f'src/components/icons/{name}.svg') as fp:
        svg = fp.read()

    d_start = svg.index(' d="') + 4
    d_end = svg.index('"', d_start)
    d = svg[d_start:d_end]

    # 删除背景矩形子路径，保留 M0 640 上下文使后续 m 命令正确
    marker = ' -640z '
    cut = d.index(marker) + len(marker)
    d = d[cut:]
    d = re.sub(r'^\s*m(\d+)\s+(\d+)',
               lambda m: f'M{m.group(1)} {int(m.group(2)) + 640}', d, count=1)

    svg = svg[:d_start] + d + svg[d_end:]
    svg = svg.replace('fill="#000000"', 'fill="#ffffff"')

    with open(f'src/components/icons/{name}.svg', 'w') as fp:
        fp.write(svg)
    print(f'{name}.svg done')
PYEOF
```

### 方案 B：纯 alpha 阈值（已废弃 — 外环和内圈原本就连在一起）

仅用 alpha 通道 > 128 做阈值，无过渡像素。外环与内圈距离过近时路径合并。
**实际原理：**外环和内圈在 × 形对角线方向原本就连在一起（alpha 通道中的装饰线条同时跨内外），不是 potrace 合并效果。

```bash
python3 << 'PYEOF'
from PIL import Image
import numpy as np, subprocess, os

for name in ['tlt_research', 'tlt_terraforming']:
    img = Image.open(f'src/components/icons/{name}.png').convert('RGBA')
    alpha = np.array(img)[:,:,3]
    bitmap = np.where(alpha > 128, 0, 255).astype(np.uint8)
    Image.fromarray(bitmap, 'L').save(f'{name}.pbm')

    subprocess.run(['potrace', '-s', '-o', f'src/components/icons/{name}.svg', f'{name}.pbm'], check=True)
    os.remove(f'{name}.pbm')

    with open(f'src/components/icons/{name}.svg') as fp:
        svg = fp.read()
    svg = svg.replace('fill="#000000"', 'fill="#ffffff"')

    with open(f'src/components/icons/{name}.svg', 'w') as fp:
        fp.write(svg)
    print(f'{name}.svg done')
PYEOF
```

### 方案 C：alpha 侵蚀（废弃 — 侵蚀无法修复连接性问题）

将 PNG alpha 通道侵蚀 1px，扩宽内外圈间距。
**失败原因：**需要 5-9 次侵蚀才能断开环与内圈的连接，此时环本身（厚度仅 10px）已被完全侵蚀消失。

```bash
python3 << 'PYEOF'
from PIL import Image
import numpy as np, subprocess, os, re
from scipy.ndimage import binary_erosion

for name in ['tlt_research', 'tlt_terraforming']:
    img = Image.open(f'src/components/icons/{name}.png').convert('RGBA')
    arr = np.array(img)
    alpha = arr[:,:,3]
    mask = alpha > 128
    eroded = binary_erosion(mask, iterations=1)
    arr[~eroded, :3] = 0
    arr[:,:,3] = np.where(eroded, 255, 0).astype(np.uint8)
    thinned = Image.fromarray(arr, 'RGBA')
    thinned.save(f'src/components/icons/{name}.png')

    bg = Image.new('RGBA', thinned.size, (0, 0, 0, 0))
    out = Image.alpha_composite(bg, thinned).convert('L').point(lambda x: 255 if x > 128 else 0, '1')
    out.save(f'{name}.pbm')

    subprocess.run(['potrace', '-s', '-o', f'src/components/icons/{name}.svg', f'{name}.pbm'], check=True)
    os.remove(f'{name}.pbm')

    with open(f'src/components/icons/{name}.svg') as fp:
        svg = fp.read()
    d_start = svg.index(' d="') + 4; d_end = svg.index('"', d_start); d = svg[d_start:d_end]
    marker = ' -640z '; cut = d.index(marker) + len(marker); d = d[cut:]
    d = re.sub(r'^\s*m(\d+)\s+(\d+)', lambda m: f'M{m.group(1)} {int(m.group(2))+640}', d, count=1)
    svg = svg[:d_start] + d + svg[d_end:]
    svg = svg.replace('fill="#000000"', 'fill="#ffffff"')
    with open(f'src/components/icons/{name}.svg', 'w') as fp: fp.write(svg)
    print(f'{name}.svg done')
PYEOF
```

## 配色规则

- SVGs 使用 `fill="#ffffff"` / `stroke="#ffffff"`（白图形 + 透明背景，内部图形 fill、外环 stroke）
- 侧边栏 dark bg 上可见
- potrace 原始输出 `fill="#000000"`，需替换为 `"#ffffff"`
- 外环是纯 SVG `<circle>` 元素，不使用 fill，用 `stroke` + `stroke-width` 控制环厚
