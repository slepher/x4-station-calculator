"""工具函数子包."""

from processor.utils.math_utils import *
from processor.utils.xml_utils import *
from processor.utils.data_utils import *
from processor.utils.noise import *

__all__ = [
    # math_utils
    "as_float",
    "as_number",
    "round_significant",
    "round_to_int",
    "pos_from",
    "pos3d_from",
    "vec_add",
    "vec_add_3d",
    "cluster_world_to_axial",
    "axial_to_pixel_flat",
    "distance_3d",
    "unit_vec",
    "rgb_to_hex",
    # xml_utils
    "parse_xml",
    "parse_xml_group",
    "parse_xml_attrs",
    "parse_step_curve",
    "piecewise_average",
    # data_utils
    "split_tags",
    "parse_select_tags",
    "coerce_attr_value",
    "classify_density_tier",
    "normalize_noise_bound",
    # noise
    "PerlinNoise3D",
    "build_noise_cdf",
    "noise_probability",
]
