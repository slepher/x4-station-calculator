import math


CENTER = (64.0, 64.0)
OUTER_RADIUS = 55.0
BORDER = 8.0
NOTCH_LENGTH = 18.0
NOTCH_DEPTH = 4.0
NOTCH_TANGENT_BLEED = 1.0


def flat_top_hex_vertices(center, radius):
    cx, cy = center
    apothem = radius * math.sqrt(3) / 2
    return [
        (cx - radius, cy),
        (cx - radius / 2, cy - apothem),
        (cx + radius / 2, cy - apothem),
        (cx + radius, cy),
        (cx + radius / 2, cy + apothem),
        (cx - radius / 2, cy + apothem),
    ]


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def mul(v, s):
    return (v[0] * s, v[1] * s)


def norm(v):
    length = math.hypot(v[0], v[1])
    return (v[0] / length, v[1] / length)


def fmt(point):
    return tuple(round(v, 3) for v in point)


def notch_polygon(a, b):
    tangent = norm(sub(b, a))
    inward = (-tangent[1], tangent[0])
    midpoint = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    half = NOTCH_LENGTH / 2 + NOTCH_TANGENT_BLEED
    p1 = add(midpoint, mul(tangent, -half))
    p2 = add(midpoint, mul(tangent, half))
    p3 = add(p2, mul(inward, NOTCH_DEPTH))
    p4 = add(p1, mul(inward, NOTCH_DEPTH))
    return [p1, p2, p3, p4]


outer = flat_top_hex_vertices(CENTER, OUTER_RADIUS)
print("outer", [fmt(point) for point in outer])
print("notches")
for i in range(len(outer)):
    print([fmt(point) for point in notch_polygon(outer[i], outer[(i + 1) % len(outer)])])
