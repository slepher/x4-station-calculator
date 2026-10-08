import os
import json
import sys
import argparse
from copy import deepcopy

if __package__:
    from .distiller.service import run_distillation_for_version
else:
    from distiller.service import run_distillation_for_version


def load_all_configs():
    config_file = 'x4-game.config.json'
    version_file = 'x4-station-calculator.config.json'
    config_dir = os.path.dirname(os.path.abspath(config_file))
    if not os.path.exists(config_file) or not os.path.exists(version_file):
        raise FileNotFoundError("❌ 错误: 配置文件 x4-game.config.json 或 x4-station-calculator.config.json 缺失。")
    with open(config_file, 'r', encoding='utf-8') as f:
        m_config = json.load(f)
    with open(version_file, 'r', encoding='utf-8') as f:
        v_config = json.load(f)
    validate_version_config(v_config)
    return m_config, v_config, config_dir


def validate_version_config(config):
    """Use processor/shared-ts/config.ts's input validation at the Python boundary."""
    if not isinstance(config, dict):
        raise ValueError('无效版本配置')
    versions = config.get('versions')
    if not isinstance(versions, list) or not versions:
        raise ValueError('配置缺少 versions')
    for item in versions:
        if (not isinstance(item, dict)
                or not isinstance(item.get('version'), str)
                or not isinstance(item.get('folder_name'), str)
                or not item['folder_name']):
            raise ValueError('无效版本配置')
        if 'beta' in item and not isinstance(item['beta'], bool):
            raise ValueError('版本 beta 必须为 boolean')
    for key in ('current_version', 'raw_assets_dir', 'processed_assets_dir'):
        if not isinstance(config.get(key), str) or not config[key]:
            raise ValueError(f'配置缺少 {key}')
    if (not isinstance(config.get('beta'), bool)
            or not isinstance(config.get('dlc_order'), list)
            or any(not isinstance(dlc, str) for dlc in config['dlc_order'])):
        raise ValueError('无效 beta/dlc_order 配置')


def parse_args():
    arg_parser = argparse.ArgumentParser(description="X4 资产蒸馏脚本")
    mode_group = arg_parser.add_mutually_exclusive_group()
    mode_group.add_argument("--all-versions", action="store_true", help="蒸馏配置中的所有版本")
    mode_group.add_argument("--version", type=str, help="蒸馏指定版本号，例如 8.0 或 9.0")
    flavor_group = arg_parser.add_mutually_exclusive_group()
    flavor_group.add_argument("--beta", action="store_true", help="选择 beta 版本")
    flavor_group.add_argument("--stable", action="store_true", help="选择 stable 版本")
    return arg_parser.parse_args()

def get_target_versions(v_config, args):
    versions = v_config.get('versions', [])
    if not versions:
        raise ValueError("❌ 错误: 配置中缺少 versions 数组。")

    if args.all_versions:
        return versions

    def matches_flavor(version_item):
        if args.beta:
            return bool(version_item.get('beta', False)) is True
        if args.stable:
            return bool(version_item.get('beta', False)) is False
        return True

    if args.version:
        candidates = [v for v in versions if str(v.get('version')) == str(args.version) and matches_flavor(v)]
        if not candidates:
            raise ValueError(f"❌ 错误: 未找到版本 {args.version}（请检查 beta/stable 选项）。")
        if len(candidates) > 1:
            raise ValueError(f"❌ 错误: 版本 {args.version} 同时存在多个候选，请显式指定 --beta 或 --stable。")
        return candidates

    current_version = v_config.get('current_version')
    current_beta = bool(v_config.get('beta', False))
    if args.beta:
        current_beta = True
    elif args.stable:
        current_beta = False

    candidates = [version_item for version_item in versions
                  if str(version_item.get('version')) == str(current_version)
                  and bool(version_item.get('beta', False)) == current_beta]
    if len(candidates) > 1:
        raise ValueError(f"❌ 错误: 版本 {current_version} 存在多个候选，请检查 versions 配置。")
    if candidates:
        return candidates

    beta_str = "beta" if current_beta else "stable"
    raise ValueError(f"❌ 错误: 未找到版本 {current_version} ({beta_str}) 的配置。")

def merge_version_config(v_config, version_item):
    merged = deepcopy(v_config)
    merged.update(version_item)
    return merged

def setup_customizer(m_config):
    paths = m_config.get('X4_PATHS', {})
    customizer_path = paths.get('CUSTOMIZER_PATH')
    game_dir = paths.get('GAME_DIR')
    if not customizer_path or not os.path.exists(customizer_path):
        raise NotADirectoryError(f"❌ 错误: CUSTOMIZER_PATH 无效: {customizer_path}")
    if customizer_path not in sys.path:
        sys.path.append(customizer_path)
    try:
        from Framework import File_Manager, Settings # type: ignore
        if game_dir:
            # 强制使用项目配置中的 GAME_DIR，避免读取 Customizer settings.json 里的旧路径。
            Settings(path_to_x4_folder=game_dir, allow_path_error=True)
        return File_Manager.XML_Diff
    except ImportError:
        raise ImportError("❌ 错误: 无法加载 Customizer 框架逻辑。")

def main():
    args = parse_args()
    m_config, v_config, config_dir = load_all_configs()
    target_versions = get_target_versions(v_config, args)
    xml_diff = setup_customizer(m_config)

    print(f"🧭 计划蒸馏 {len(target_versions)} 个版本。")
    for version_item in target_versions:
        effective_v_config = merge_version_config(v_config, version_item)
        version_label = str(effective_v_config.get('version'))
        flavor = "beta" if effective_v_config.get('beta', False) else "stable"
        folder_name = effective_v_config.get('folder_name', '')
        print(f"\n🚀 版本开始: {version_label} ({flavor}) -> {folder_name}")
        run_distillation_for_version(m_config, effective_v_config, config_dir, xml_diff)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n程序终止: {e}")
        sys.exit(1)


