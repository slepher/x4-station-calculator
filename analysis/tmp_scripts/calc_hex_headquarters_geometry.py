import math


OUTER = [
    (16.0, 64.0),
    (40.0, 22.4307806183),
    (88.0, 22.4307806183),
    (112.0, 64.0),
    (88.0, 105.5692193817),
    (40.0, 105.5692193817),
]

CENTER = (64.0, 64.0)
OUTER_RADIUS = 48.0
OUTER_APOTHEM = OUTER_RADIUS * math.sqrt(3) / 2
BORDER = 8.0
INNER_APOTHEM = OUTER_APOTHEM - BORDER
INNER_RADIUS = 2 * INNER_APOTHEM / math.sqrt(3)
NOTCH_LENGTH = 18.0
NOTCH_DEPTH = 4.0


def fmt(point):
    return tuple(round(v, 3) for v in point)


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def mul(v, s):
    return (v[0] * s, v[1] * s)


def norm(v):
    length = math.hypot(v[0], v[1])
    return (v[0] / length, v[1] / length)


def inner_vertices():
    scale = INNER_RADIUS / OUTER_RADIUS
    result = []
    for vertex in OUTER:
        offset = sub(vertex, CENTER)
        result.append(add(CENTER, mul(offset, scale)))
    return result


def notch_polygon(a, b):
    tangent = norm(sub(b, a))
    inward = (-tangent[1], tangent[0])
    midpoint = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    half = NOTCH_LENGTH / 2
    p1 = add(midpoint, mul(tangent, -half))
    p2 = add(midpoint, mul(tangent, half))
    p3 = add(p2, mul(inward, NOTCH_DEPTH))
    p4 = add(p1, mul(inward, NOTCH_DEPTH))
    return [p1, p2, p3, p4]


print("inner")
for point in inner_vertices():
    print(fmt(point))

print("notches")
for i in range(len(OUTER)):
    polygon = notch_polygon(OUTER[i], OUTER[(i + 1) % len(OUTER)])
    print([fmt(point) for point in polygon])
