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
    --maps-json src/assets/x4_game_data/8.0-Diplomacy/data/maps.json \
    --regions-json src/assets/x4_game_data/8.0-Diplomacy/data/regions.json \
    --all-sectors

  # 处理所有星区（9.0+ 版本）
  python scripts/x4_resource_processor.py \
    --version 9.0 \
    --maps-json src/assets/x4_game_data/9.0-Tides/data/maps.json \
    --regionyields-xml path/to/regionyields_final.xml \
    --mapdefaults-xml path/to/mapdefaults_final.xml \
    --all-sectors

  # 单星区增量更新
  python scripts/x4_resource_processor.py \
    --version 8.0 \
    --maps-json src/assets/x4_game_data/8.0-Diplomacy/data/maps.json \
    --regions-json src/assets/x4_game_data/8.0-Diplomacy/data/regions.json \
    --sector cluster_06_sector001_macro
"""

import argparse
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "scripts"))

from processor.step2_resource.service import process_resources_for_version


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
        required=True,
        help="maps.json 文件路径（输出目录由此推断）",
    )
    parser.add_argument(
        "--regions-json",
        help="regions.json 文件路径（8.0 版本需要）",
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
        help="单星区增量更新（sector_id）",
    )
    parser.add_argument(
        "--all-sectors",
        action="store_true",
        help="处理所有星区",
    )

    args = parser.parse_args()

    # 确定处理的星区
    sector_id = None if args.all_sectors else args.sector

    # 执行处理
    result = process_resources_for_version(
        version=args.version,
        maps_json_path=Path(args.maps_json),
        regionyields_xml_path=Path(args.regionyields_xml) if args.regionyields_xml else None,
        mapdefaults_xml_path=Path(args.mapdefaults_xml) if args.mapdefaults_xml else None,
        regions_json_path=Path(args.regions_json) if args.regions_json else None,
        sector_id=sector_id,
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