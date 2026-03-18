"""Perlin 噪声工具 - X4 Map Data Processor."""

import bisect
import math
from typing import List, Optional


class PerlinNoise3D:
    """3D Perlin 噪声生成器。"""

    def __init__(self, seed: int = 1337):
        import random

        permutation = list(range(256))
        random.Random(seed).shuffle(permutation)
        self.p = permutation * 2

    @staticmethod
    def fade(t: float) -> float:
        return t * t * t * (t * (t * 6 - 15) + 10)

    @staticmethod
    def lerp(a: float, b: float, t: float) -> float:
        return a + t * (b - a)

    @staticmethod
    def grad(hash_value: int, x: float, y: float, z: float) -> float:
        h = hash_value & 15
        u = x if h < 8 else y
        v = y if h < 4 else (x if h in (12, 14) else z)
        return ((u if (h & 1) == 0 else -u) + (v if (h & 2) == 0 else -v))

    def sample(self, x: float, y: float, z: float) -> float:
        xi = math.floor(x) & 255
        yi = math.floor(y) & 255
        zi = math.floor(z) & 255
        xf = x - math.floor(x)
        yf = y - math.floor(y)
        zf = z - math.floor(z)
        u = self.fade(xf)
        v = self.fade(yf)
        w = self.fade(zf)

        p = self.p
        aaa = p[p[p[xi] + yi] + zi]
        aba = p[p[p[xi] + yi + 1] + zi]
        aab = p[p[p[xi] + yi] + zi + 1]
        abb = p[p[p[xi] + yi + 1] + zi + 1]
        baa = p[p[p[xi + 1] + yi] + zi]
        bba = p[p[p[xi + 1] + yi + 1] + zi]
        bab = p[p[p[xi + 1] + yi] + zi + 1]
        bbb = p[p[p[xi + 1] + yi + 1] + zi + 1]

        x1 = self.lerp(
            self.grad(aaa, xf, yf, zf),
            self.grad(baa, xf - 1, yf, zf),
            u,
        )
        x2 = self.lerp(
            self.grad(aba, xf, yf - 1, zf),
            self.grad(bba, xf - 1, yf - 1, zf),
            u,
        )
        y1 = self.lerp(x1, x2, v)

        x3 = self.lerp(
            self.grad(aab, xf, yf, zf - 1),
            self.grad(bab, xf - 1, yf, zf - 1),
            u,
        )
        x4 = self.lerp(
            self.grad(abb, xf, yf - 1, zf - 1),
            self.grad(bbb, xf - 1, yf - 1, zf - 1),
            u,
        )
        y2 = self.lerp(x3, x4, v)
        return self.lerp(y1, y2, w)


def build_noise_cdf(sample_count: int = 32768) -> List[float]:
    """构建噪声累积分布函数。"""
    noise = PerlinNoise3D(1337)
    values: List[float] = []
    grid = round(sample_count ** (1.0 / 3.0))
    inv = 1.0 / max(1, grid)
    for xi in range(grid):
        for yi in range(grid):
            for zi in range(grid):
                raw = noise.sample((xi + 0.5) * inv * 7.13, (yi + 0.5) * inv * 5.71, (zi + 0.5) * inv * 6.37)
                values.append((raw + 1.0) * 0.5)
    values.sort()
    return values


NOISE_CDF_SAMPLES = build_noise_cdf()


def noise_probability(min_value: Optional[float], max_value: Optional[float]) -> float:
    """计算噪声概率。"""
    lo = max(0.0, min(1.0, min_value if min_value is not None else 0.0))
    hi = max(0.0, min(1.0, max_value if max_value is not None else 1.0))
    if hi <= lo:
        return 0.0
    samples = NOISE_CDF_SAMPLES
    left = bisect.bisect_left(samples, lo)
    right = bisect.bisect_right(samples, hi)
    return max(0.0, min(1.0, (right - left) / len(samples)))
