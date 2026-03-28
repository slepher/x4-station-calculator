"""Map 处理常量定义 - X4 Map Data Processor."""

# 截断限制（单位：米）
SOLID_XZ_LIMIT = 256_000       # 256 km
SOLID_Y_LIMIT = 96_000         # 96 km (总高度 192km)
GAS_XZ_LIMIT = 256_000         # 256 km
GAS_Y_LIMIT = 64_000           # 64 km (总高度 128km)
GAS_BLOCK_SIZE = 64_000        # 64 km 立方体网格
GAS_MIN_HEIGHT = 64_000        # 气体最小高度 64km
TOTAL_BLOCK_NEG_LIMIT = 960_000    # total_blocks 固定总窗口：-15 格
TOTAL_BLOCK_POS_LIMIT = 1_024_000  # total_blocks 固定总窗口：+16 格
TOTAL_BLOCK_Y_NEG_LIMIT = 256_000  # total_blocks 固定总窗口：-4 格
TOTAL_BLOCK_Y_POS_LIMIT = 256_000  # total_blocks 固定总窗口：+4 格

# 气体资源 ware 列表
GAS_WARES = {"helium", "hydrogen", "methane", "bogas"}

# 体积上限限制
CYLINDER_RADIUS_LIMIT = 200_000   # 200 km
CYLINDER_HEIGHT_LIMIT = 80_000    # 80 km
SPLINETUBE_LENGTH_LIMIT = 1_000_000  # 1000 km
