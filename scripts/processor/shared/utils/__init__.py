"""Shared Utils 模块 - X4 Map Data Processor."""

from processor.shared.utils.data_utils import (
    split_tags,
    coerce_attr_value,
    as_number,
)
from processor.shared.utils.math_utils import (
    as_float,
    distance_3d,
    round_significant,
    round_to_int,
    rgb_to_hex,
)
from processor.shared.utils.xml_utils import (
    parse_xml,
    parse_xml_attrs,
    parse_step_curve,
    piecewise_average,
)

__all__ = [
    "split_tags",
    "coerce_attr_value",
    "as_number",
    "as_float",
    "distance_3d",
    "round_significant",
    "round_to_int",
    "rgb_to_hex",
    "parse_xml",
    "parse_xml_attrs",
    "parse_step_curve",
    "piecewise_average",
]