#!/usr/bin/env python3
"""X4 Resource Processor - Step 2 资源计算入口脚本。

读取已生成的地图 JSON，执行资源计算并回填产量字段。

输出目录自动从输入路径推断：
- resourceareas.json、maps.json（更新）→ maps_json 所在目录
- resourcearea_blocks.json → 固定 analysis/resources/

用法:
  # 处理所有星区（8.0 版本）
  python scripts/x4_resource_processor.py \
    --version 8.0 \
    --all-sectors

  # 处理所有星区（9.0+ 版本）
  python scripts/x4_resource_processor.py \
    --version 9.0 \
    --regionyields-xml path/to/regionyields_final.xml \
    --mapdefaults-xml path/to/mapdefaults_final.xml \
    --all-sectors

  # 单星区增量更新
  python scripts/x4_resource_processor.py \
    --version 8.0 \
    --sector cluster_06_sector001_macro
"""

import argparse
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "scripts"))

from processor.path_utils import build_output_paths
from processor.step2_resource.service import process_resources_for_version
from processor.versioning import load_version_config, merge_version_config


# 处理后的资源根目录（JSON 输出目录）
PROCESSED_ASSETS_DIR = "src/assets/x4_game_data"


def get_folder_name(version: str) -> str:
    """从配置文件获取 folder_name。"""
    config = load_version_config()
    for v in config.get("versions", []):
        if str(v.get("version")) == version:
            return str(v.get("folder_name", version))
    return version


def main():
    parser = argparse.ArgumentParser(
        description="X4 Resource Processor - Step 2 资源计算"
    )
    parser.add_argument(
        "--version",
        default="8.0",
        help="版本号（默认 8.0）",
    )
    parser.add_argument(
        "--maps-json",
        help="maps.json 文件路径（默认使用统一入口）",
    )
    parser.add_argument(
        "--regions-json",
        help="regions.json 文件路径（默认使用统一入口）",
    )
    parser.add_argument(
        "--regionyields-xml",
        help="regionyields_final.xml 文件路径（9.0+ 版本需要）",
    )
    parser.add_argument(
        "--mapdefaults-xml",
        help="mapdefaults_final.xml 文件路径（9.0+ 版本需要）",
    )
    parser.add_argument(
        "--sector",
        help="单星区增量更新（sector_id），不传则处理所有星区",
    )
    parser.add_argument(
        "--force-recalc-per-block",
        action="store_true",
        help="强制重新计算逐格数据（默认从 analysis/resources/resourcearea_blocks.json 读取）",
    )
    parser.add_argument(
        "--save-sample-dir",
        default="save_sample_data",
        help="存档数据目录路径（默认 save_sample_data/）",
    )

    args = parser.parse_args()

    # 使用统一入口构建默认路径
    version = args.version
    folder_name = get_folder_name(version)
    default_paths = build_output_paths(PROCESSED_ASSETS_DIR, folder_name)

    maps_json_path = Path(args.maps_json) if args.maps_json else Path(default_paths["maps"])
    regions_json_path = Path(args.regions_json) if args.regions_json else Path(default_paths["regions"])

    # 确定处理的星区：指定 sector 则处理单个，否则处理所有
    sector_id = args.sector if args.sector else None

    # 执行处理
    save_sample_dir_path = Path(args.save_sample_dir) if args.save_sample_dir else None

    result = process_resources_for_version(
        version=version,
        maps_json_path=maps_json_path,
        regionyields_xml_path=Path(args.regionyields_xml) if args.regionyields_xml else None,
        mapdefaults_xml_path=Path(args.mapdefaults_xml) if args.mapdefaults_xml else None,
        regions_json_path=regions_json_path,
        sector_id=sector_id,
        force_recalc_per_block=getattr(args, 'force_recalc_per_block', False),
        save_sample_dir=save_sample_dir_path,
    )

    if result.get("status") == "error":
        print(f"\n❌ 处理失败: {result.get('message', 'Unknown error')}")
        sys.exit(1)

    print(f"\n✅ 处理完成:")
    print(f"   资源模型: {result.get('resource_model', 'unknown')}")
    print(f"   处理星区数: {result.get('sectors_processed', 0)}")
    if result.get("output_files"):
        print(f"   输出文件:")
        for f in result["output_files"]:
            print(f"     - {f}")


if __name__ == "__main__":
    main()