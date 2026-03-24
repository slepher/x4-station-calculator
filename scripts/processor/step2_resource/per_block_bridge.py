"""Per-block 计算桥接模块。

从 regions.json 读取 field definitions，构建计算所需的状态对象。
不再依赖 XML 文件。
"""

from __future__ import annotations

from typing import Dict, List, Optional

from processor.step2_resource.per_block.common import (
    FalloffProfiles,
    ProfilePoint,
    SplineControlPoint,
    QUERY_RADIUS,
)
from processor.step2_resource.per_block.solid import (
    SolidFieldState,
    SolidRegionState,
    RegionYieldPayload,
    replay_region_solid_sum_weights_and_areas,
)
from processor.step2_resource.per_block.gas import (
    NebulaFieldState,
    GasResourceEntry,
    replay_gas_area_values_for_field,
)
from processor.step2_resource.estimator import is_gas_ware


def build_solid_region_state(
    sector_id: str,
    field_ref: str,
    area_data: dict,
    region_json: dict,
) -> SolidRegionState:
    """构建 SolidRegionState。

    Args:
        sector_id: 星区 ID
        field_ref: region ref
        area_data: resourceareas.json 中的 area 数据
        region_json: regions.json 中的 region 定义（已包含 density 和 fields）

    Returns:
        SolidRegionState 对象
    """
    position = area_data.get("position", {})
    boundary = region_json.get("boundary", {})
    size = boundary.get("size", {})
    falloff = region_json.get("falloff", {})

    # 解析 spline
    spline = []
    if boundary.get("class") == "splinetube":
        for row in boundary.get("spline", []):
            spline.append(SplineControlPoint(
                x=float(row.get("x", 0)) + float(position.get("x", 0)),
                y=float(row.get("y", 0)) + float(position.get("y", 0)),
                z=float(row.get("z", 0)) + float(position.get("z", 0)),
                tx=float(row.get("tx", 0)),
                ty=float(row.get("ty", 0)),
                tz=float(row.get("tz", 0)),
                inlength=float(row.get("inlength", 0)),
                outlength=float(row.get("outlength", 0)),
            ))

    # 从 regions.json 读取 density 和 fields
    region_density = region_json.get("density", 1.0)
    fields_defs = region_json.get("fields", [])

    # 构建 fields（asteroid 和 debris 类型都作为固体资源处理）
    # 直接从 field_def 读取 resource/yield/yieldvariation（Step 1 已合并）
    fields = []
    for field_def in fields_defs:
        tag = field_def.get("tag")
        if tag not in ("asteroid", "debris"):
            continue

        groupref = field_def.get("groupref", "")
        resource = field_def.get("resource", "")

        if not resource:
            continue

        state = SolidFieldState(
            name=groupref,
            ware_key=resource,
            yield_value=float(field_def.get("yield", "1.0")),
            yieldvariation=float(field_def.get("yieldvariation", "0.0")),
            densityfactor=field_def.get("densityfactor", 1.0),
            region_density=region_density,
            field_0x1150_density_base_scaled=field_def.get("densityfactor", 1.0) * region_density,
            noisescale=field_def.get("noisescale", 15000.0),
            seed=field_def.get("seed", ""),
            minnoisevalue=field_def.get("minnoisevalue", 0.0),
            maxnoisevalue=field_def.get("maxnoisevalue", 1.0),
        )
        fields.append(state)

    # 构建 falloff profiles
    falloff_profiles = FalloffProfiles(
        lateral=[ProfilePoint(float(p.get("position", 0)), float(p.get("value", 1)))
                  for p in falloff.get("lateral", [])],
        radial=[ProfilePoint(float(p.get("position", 0)), float(p.get("value", 1)))
                 for p in falloff.get("radial", [])],
    )

    # 创建一个占位 payload（实际值在计算时根据 field.ware_key 确定）
    placeholder_payload = RegionYieldPayload(
        ware="",  # 占位，实际值从 field 获取
        yield_name="lowest",
        resourcedensity=1.0,  # 占位
        replenishtime=60.0,
        gatherspeedfactor=1.0,
    )

    return SolidRegionState(
        sector_id=sector_id,
        field_ref=field_ref,
        boundary_class=str(boundary.get("class", "cylinder")),
        position_x=float(position.get("x", 0)),
        position_y=float(position.get("y", 0)),
        position_z=float(position.get("z", 0)),
        radius=float(size.get("r", 0)),
        linear=float(size.get("linear", 0)),
        region_density=region_density,
        falloff=falloff_profiles,
        payload=placeholder_payload,
        fields=fields,
        spline=spline,
        # box 专用尺寸
        box_size_x=float(size.get("x", 0)),
        box_size_y=float(size.get("y", 0)),
        box_size_z=float(size.get("z", 0)),
    )


def calculate_field_per_block(
    sector_id: str,
    field_ref: str,
    area_data: dict,
    region_json: dict,
    ware: str,
    resourcedensity: float,
) -> dict:
    """执行单个 field 的逐格计算。

    Args:
        sector_id: 星区 ID
        field_ref: region ref
        area_data: resourceareas.json 中的 area 数据
        region_json: regions.json 中的 region 定义
        ware: 要计算的资源类型
        resourcedensity: 资源密度
        groups: regionobjectgroups 字典，默认从缓存获取

    Returns:
        逐格计算结果
    """
    region_state = build_solid_region_state(
        sector_id, field_ref, area_data, region_json
    )

    # 设置 payload 为当前 ware
    region_state.payload.ware = ware
    region_state.payload.resourcedensity = resourcedensity

    # 过滤 matching fields
    original_fields = region_state.fields
    region_state.fields = [f for f in original_fields if f.ware_key == ware]

    if not region_state.fields:
        raise ValueError(f"No matching fields for ware={ware} in sector={sector_id}, field={field_ref}")

    result = replay_region_solid_sum_weights_and_areas(region_state)
    # 恢复原始 fields
    region_state.fields = original_fields
    return result


__all__ = [
    "build_solid_region_state",
    "calculate_resource_per_block",
    "calculate_field_per_block",
    "calculate_gas_field_per_block",
]


def calculate_resource_per_block(
    sector_id: str,
    field_ref: str,
    area_data: dict,
    region_json: dict,
    ware: str,
    resourcedensity: float,
) -> dict:
    """统一接口：根据资源类型自动选择计算方法。

    Args:
        sector_id: 星区 ID
        field_ref: region ref
        area_data: resourceareas.json 中的 area 数据
        region_json: regions.json 中的 region 定义
        ware: 要计算的资源类型
        resourcedensity: 资源密度

    Returns:
        逐格计算结果
    """
    if is_gas_ware(ware):
        return calculate_gas_field_per_block(
            sector_id=sector_id,
            field_ref=field_ref,
            area_data=area_data,
            region_json=region_json,
            ware=ware,
            resourcedensity=resourcedensity,
        )
    else:
        return calculate_field_per_block(
            sector_id=sector_id,
            field_ref=field_ref,
            area_data=area_data,
            region_json=region_json,
            ware=ware,
            resourcedensity=resourcedensity,
        )


def calculate_gas_field_per_block(
    sector_id: str,
    field_ref: str,
    area_data: dict,
    region_json: dict,
    ware: str,
    resourcedensity: float,
) -> dict:
    """执行气体资源的逐格计算。

    Args:
        sector_id: 星区 ID
        field_ref: region ref
        area_data: resourceareas.json 中的 area 数据（position 和 size 可能被覆盖）
        region_json: regions.json 中的 region 定义（boundary/spline 来源）
        ware: 要计算的资源类型
        resourcedensity: 资源密度

    Returns:
        逐格计算结果
    """
    position = area_data.get("position", {})
    # boundary 从 region_json 读取（包含完整的 spline 数据）
    boundary = region_json.get("boundary", {})
    falloff = region_json.get("falloff", {})

    boundary_class = boundary.get("class", "cylinder")
    size = boundary.get("size", {})

    # 构建 falloff profiles
    falloff_profiles = FalloffProfiles(
        lateral=[ProfilePoint(float(p.get("position", 0)), float(p.get("value", 1)))
                  for p in falloff.get("lateral", [])],
        radial=[ProfilePoint(float(p.get("position", 0)), float(p.get("value", 1)))
                 for p in falloff.get("radial", [])],
    )

    # 构建资源条目
    resource_entry = GasResourceEntry(
        ware_key=ware,
        resourcedensity=resourcedensity,
        recharge_time_seconds=area_data.get("resources", [{}])[0].get("delay", 60.0) * 60.0,
        gather_speed_factor=1.0,
        yield_name="",
    )

    # 构建 spline（如果是 splinetube）
    spline = []
    if boundary_class == "splinetube":
        for row in boundary.get("spline", []):
            spline.append(SplineControlPoint(
                x=float(row.get("x", 0)) + float(position.get("x", 0)),
                y=float(row.get("y", 0)) + float(position.get("y", 0)),
                z=float(row.get("z", 0)) + float(position.get("z", 0)),
                tx=float(row.get("tx", 0)),
                ty=float(row.get("ty", 0)),
                tz=float(row.get("tz", 0)),
                inlength=float(row.get("inlength", 0)),
                outlength=float(row.get("outlength", 0)),
            ))

    field = NebulaFieldState(
        name=field_ref,
        boundary_class=boundary_class,
        position_x=float(position.get("x", 0)),
        position_y=float(position.get("y", 0)),
        position_z=float(position.get("z", 0)),
        radius=float(size.get("r", 0)),
        linear=float(size.get("linear", 0)),
        falloff=falloff_profiles,
        resources=[resource_entry],
        spline=spline,
        size_x=float(size.get("x", 0)),
        size_y=float(size.get("y", 0)),
        size_z=float(size.get("z", 0)),
    )

    return replay_gas_area_values_for_field(field)