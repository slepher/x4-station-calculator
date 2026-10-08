"""Orchestrate distillation and publish a complete version directory."""
import shutil
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4
from lxml import etree

from .aggregate import AssetAggregator
from .index import process_index_file
from .xml_merge import XMLMerger

MAP_FILES = ('galaxy.xml', 'clusters.xml', 'sectors.xml', 'zones.xml', 'zonehighways.xml', 'sechighways.xml')
LIBRARY_FILES = ('wares', 'waregroups', 'colors', 'mapdefaults', 'god', 'factions',
                 'region_definitions', 'regionyields', 'regionobjectgroups', 'ships',
                 'shipgroups', 'loadouts', 'defaults', 'terraforming')
MD_FILES = ('terraforming', 'factionlogic', 'khaak_activity')


def build_assets(source, destination, dlc_order, xml_diff):
    if (source / 't').is_dir():
        shutil.copytree(source / 't', destination / 't')
        print('✅ 语言包已拷贝。')
    index_dir = destination / 'index'
    index_dir.mkdir()
    parser = etree.XMLParser(remove_blank_text=True)
    warnings = []
    for name in ('macros', 'components'):
        _, index_warnings = process_index_file(source, f'{name}.xml', name, dlc_order, index_dir, parser)
        warnings.extend(index_warnings)
    merger = XMLMerger(source, destination, dlc_order, xml_diff)
    merger.distill_targeted_map_xml('maps/xu_ep2_universe', MAP_FILES)
    (destination / 'libraries').mkdir()
    files = [Path('libraries') / f'{name}.xml' for name in LIBRARY_FILES]
    files += [Path('md') / f'{name}.xml' for name in MD_FILES]
    for relative in files:
        print(f'   🔨 处理 {relative} ...')
        overlays = {dlc: source / 'extensions' / dlc / relative for dlc in dlc_order
                    if (source / 'extensions' / dlc / relative).is_file()}
        merger.build_dlc_stack_xml(relative, overlays)
    aggregator = AssetAggregator(source, destination)
    return warnings + merger.warnings + aggregator.run()


def publish_assets(staged, destination):
    """Restore the previous directory if publishing fails; keep it on rollback failure."""
    backup = destination.with_name(f'.{destination.name}.previous-{uuid4().hex}')
    had_previous = destination.exists()
    if had_previous:
        destination.rename(backup)
    try:
        staged.rename(destination)
    except BaseException:
        if had_previous:
            try:
                backup.rename(destination)
            except OSError as rollback_error:
                raise RuntimeError(f'发布和恢复均失败，旧产物保留在 {backup}') from rollback_error
        raise
    if had_previous:
        shutil.rmtree(backup)


def run_distillation_for_version(m_config, v_config, config_dir, xml_diff):
    source = (Path(config_dir) / m_config['X4_PATHS']['SOURCE'] / v_config['folder_name']).resolve()
    output_base = (Path(config_dir) / v_config['raw_assets_dir']).resolve()
    output_path = output_base / v_config['folder_name']
    if output_path.is_symlink():
        raise ValueError(f'输出目录不能是符号链接: {output_path}')
    destination = output_path.resolve()
    if not destination.is_relative_to(output_base) or destination == output_base:
        raise ValueError(f'版本目录必须位于 raw_assets_dir 内: {destination}')
    if source == destination or source.is_relative_to(destination) or destination.is_relative_to(source):
        raise ValueError('SOURCE 与 DEST 目录不能相同或互相包含')
    if not source.is_dir():
        raise FileNotFoundError(f'SOURCE 不存在: {source}')
    if destination.exists() and not destination.is_dir():
        raise NotADirectoryError(f'DEST 不是目录: {destination}')
    print(f"🧪 开始资产蒸馏流: {v_config['folder_name']}")
    print(f'   📁 SOURCE: {source}')
    print(f'   📁 DEST:   {destination}')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix=f'.{destination.name}.distill-', dir=destination.parent) as temporary:
        staged = Path(temporary) / 'assets'
        staged.mkdir()
        warnings = build_assets(source, staged, v_config.get('dlc_order', []), xml_diff)
        publish_assets(staged, destination)
    if warnings:
        print(f'⚠️ 蒸馏完成，含 {len(warnings)} 项警告；请检查上方详情: {destination}')
    else:
        print(f'✨ 全流程结束！资产已蒸馏至 {destination}')
