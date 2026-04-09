import os
import shutil
import glob
import json
import sys
import argparse
from copy import deepcopy
from pathlib import Path
from lxml import etree

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
    return m_config, v_config, config_dir

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

    for version_item in versions:
        if str(version_item.get('version')) == str(current_version) and bool(version_item.get('beta', False)) == current_beta:
            return [version_item]

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

def run_distillation_for_version(m_config, v_config, config_dir, xml_diff):

    paths = m_config['X4_PATHS']
    src = os.path.normpath(os.path.join(config_dir, paths['SOURCE'], v_config['folder_name']))
    dest_root = os.path.normpath(os.path.join(config_dir, v_config['raw_assets_dir'], v_config['folder_name']))

    print(f"🧪 开始资产蒸馏流: {v_config['folder_name']}")
    print(f"   📁 SOURCE: {src}")
    print(f"   📁 DEST:   {dest_root}")

    if os.path.exists(dest_root):
        shutil.rmtree(dest_root)
    os.makedirs(dest_root, exist_ok=True)

    parser = etree.XMLParser(remove_blank_text=True)
    dlc_order = v_config.get('dlc_order', [])

    def normalize_dlc_name(dlc_id):
        return dlc_id[4:] if dlc_id.startswith("ego_") else dlc_id

    # 辅助函数：计算节点签名（用于去重）
    def node_signature(node):
        # 忽略纯空白 text/tail，避免 <entry></entry> 与 <entry/> 被视为不同。
        attrs = tuple(sorted((k, v) for k, v in node.attrib.items()))
        text = (node.text or '').strip()
        children = tuple(node_signature(child) for child in list(node))
        return (node.tag, attrs, text, children)

    # 通用函数：处理 index 文件（macros.xml / components.xml）
    def process_index_file(src, index_name, root_element_name, dlc_order, dest_dir, parser):
        """
        处理 index 文件：读取 base、叠加 DLC、去重、写出
        :param src: 源数据根目录
        :param index_name: index 文件名（如 "macros.xml"）
        :param root_element_name: 根元素名（如 "macros" / "components"）
        :param dlc_order: DLC 顺序列表
        :param dest_dir: 输出目录
        :param parser: XML 解析器
        :return: 输出文件路径
        """
        base_path = os.path.join(src, "index", index_name)
        output_path = os.path.join(dest_dir, index_name)

        tree = None
        if os.path.exists(base_path):
            tree = etree.parse(base_path, parser)
        else:
            print(f"      ⚠️ Base 文件不存在: {base_path}")
            tree = etree.ElementTree(etree.Element(root_element_name))

        root = tree.getroot()

        # 构建所有来源：先处理 base
        all_entry_sources = {}
        for node in root:
            name = node.get("name")
            value = node.get("value") or ""
            if name:
                if name not in all_entry_sources:
                    all_entry_sources[name] = []
                all_entry_sources[name].append(('base', value))

        # 叠加 DLC，并在 all_entry_sources 中记录来源
        for dlc_id in dlc_order:
            patch_path = os.path.join(src, "extensions", dlc_id, "index", index_name)
            if not os.path.exists(patch_path):
                continue
            print(f"      [+] 叠加节点 ({dlc_id})")
            try:
                patch_tree = etree.parse(patch_path, parser)
                patch_root = patch_tree.getroot()
                for node in patch_root:
                    name = node.get("name")
                    value = node.get("value") or ""
                    # 记录 DLC 来源
                    if name:
                        if name not in all_entry_sources:
                            all_entry_sources[name] = []
                        all_entry_sources[name].append((dlc_id, value))
                    root.append(deepcopy(node))
            except Exception as e:
                print(f"      ⚠️ 警告: 叠加失败 {dlc_id}: {e}")

        # 规范 value 中的双反斜杠（始终执行，避免路径格式差异导致去重失败）
        normalized_double_slash = 0
        for entry in root.findall(".//entry[@value]"):
            value = entry.get("value") or ""
            normalized = value
            while "\\\\" in normalized:
                normalized = normalized.replace("\\\\", "\\")
            if normalized != value:
                entry.set("value", normalized)
                normalized_double_slash += 1
        if normalized_double_slash:
            print(f"   🔧 已规范 {normalized_double_slash} 个 entry.value 双反斜杠。")

        # name 相同且内容完全一致的节点自动去重合并
        merged_same_content = 0
        seen_name_and_content = set()
        for node in list(root):
            name = node.get("name")
            if not name:
                continue
            signature = node_signature(node)
            key = (name, signature)
            if key in seen_name_and_content:
                root.remove(node)
                merged_same_content += 1
            else:
                seen_name_and_content.add(key)
        if merged_same_content:
            print(f"   ♻️ 已合并 {merged_same_content} 个同名同内容节点。")

        # 处理重复 name（不同内容）：保留最后一条，警告并列出历史路径
        from collections import OrderedDict
        name_to_entries = OrderedDict()
        for node in list(root):
            name = node.get("name")
            if not name:
                continue
            if name not in name_to_entries:
                name_to_entries[name] = []
            name_to_entries[name].append(node)

        dup_entries = []
        for name, entries in name_to_entries.items():
            if len(entries) <= 1:
                continue
            # 有重复，保留最后一个，删除前面的
            # 使用 all_entry_sources 显示所有冲突来源
            sources = all_entry_sources.get(name, [])

            for old_node in entries[:-1]:
                root.remove(old_node)
            # 记录重复信息用于表格输出（显示所有来源）
            dup_entries.append((name, sources))

        if dup_entries:
            print(f"   ⚠️ 发现 {len(dup_entries)} 个同名不同内容节点，已保留最后一条:")
            # 计算列宽
            name_width = max(len(name) for name, _ in dup_entries)
            src_width = max(len(src) for _, srcs in dup_entries for src, _ in srcs) if any(srcs for _, srcs in dup_entries) else 6
            # 表头
            print(f"      {'Name':<{name_width}} | {'Source':<{src_width}} | Value")
            print(f"      {'-' * name_width}-+-{'-' * src_width}-+--------------------------------")
            # 表格内容
            for name, sources in dup_entries:
                for i, (dlc_id, val) in enumerate(sources):
                    name_col = name if i == 0 else ""
                    print(f"      {name_col:<{name_width}} | {dlc_id:<{src_width}} | {val}")

        # 写出文件
        tree.write(output_path, encoding='utf-8', xml_declaration=True, pretty_print=True)

        # 最终统计
        final_names = [node.get("name") for node in root if node.get("name")]
        print(f"   ✨ 生成: index/{index_name}")
        print(f"   ✅ {root_element_name} 处理完成，共 {len(final_names)} 个具名元素。")

        return output_path

    def clone_tree(tree):
        return etree.ElementTree(deepcopy(tree.getroot()))

    namespaces = {'xsi': 'http://www.w3.org/2001/XMLSchema-instance'}

    def ns_xpath(node, xpath_expr):
        return node.xpath(xpath_expr, namespaces=namespaces)

    def patch_has_if(root):
        if root.tag != 'diff':
            return False
        return any(node.get('if') for node in root if isinstance(node.tag, str))

    def evaluate_patch_condition(temp_tree, op_node):
        condition = op_node.get('if')
        if not condition:
            return True
        attempts = [condition]
        if condition.startswith('/'):
            attempts.append('.' + condition)
        elif condition.startswith('('):
            attempts.append(condition.replace('(', '(.', 1))

        result = None
        last_error = None
        for expr in attempts:
            try:
                result = ns_xpath(temp_tree, expr)
                last_error = None
                break
            except Exception as e:
                last_error = e
        if last_error is not None:
            print(f"      ⚠️ 条件解析失败 line={op_node.sourceline}: {condition} ({last_error})")
            return False

        if isinstance(result, list):
            return bool(result)
        return bool(result)

    def resolve_patch_targets(temp_tree, op_node):
        xpath_expr = op_node.get('sel')
        if not xpath_expr:
            raise ValueError('missing sel')

        optype = 'node'
        base_xpath = xpath_expr
        for suffix in ['/text()[1]', '/text()']:
            if base_xpath.endswith(suffix):
                optype = 'text'
                base_xpath = base_xpath[: -len(suffix)]
                break

        try:
            if base_xpath.startswith('('):
                rel_xpath = base_xpath.replace('(', '(.', 1)
            else:
                rel_xpath = '.' + base_xpath
            matched = ns_xpath(temp_tree, rel_xpath)
        except Exception as e:
            raise ValueError(f'xpath exception: {e}') from e

        if not matched:
            raise ValueError('no xpath match found')
        if len(matched) > 1:
            raise ValueError('multiple xpath matches found')

        target = matched[0]
        if isinstance(target, (str, etree._ElementUnicodeResult)):
            target = target.getparent()
            optype = 'attrib'

        if op_node.get('type'):
            optype = 'attrib'

        return target, optype

    def extract_attrib_name(op_node):
        if op_node.tag == 'add':
            attrib_name = op_node.get('type')
            if not attrib_name:
                raise ValueError('attribute add missing type')
            return attrib_name.replace('@', '')

        xpath_expr = op_node.get('sel') or ''
        if '/@' not in xpath_expr:
            raise ValueError('attribute op missing /@ in sel')
        attrib_name = xpath_expr.rsplit('/@', 1)[1]
        if '[' in attrib_name:
            attrib_name = attrib_name.split('[', 1)[0]
        return attrib_name

    def apply_custom_patch_op(op_node, target_node, optype):
        if optype == 'text':
            if op_node.tag == 'add':
                raise ValueError('text add not supported')
            if op_node.tag == 'remove':
                target_node.text = None
                return
            if op_node.tag == 'replace':
                target_node.text = op_node.text
                return

        if optype == 'attrib':
            attrib_name = extract_attrib_name(op_node)
            if op_node.tag in ('add', 'replace'):
                target_node.set(attrib_name, op_node.text or '')
                return
            if op_node.tag == 'remove':
                if attrib_name in target_node.attrib:
                    target_node.attrib.pop(attrib_name)
                return

        parent = target_node.getparent()
        if parent is None:
            raise ValueError('target node has no parent')

        if op_node.tag == 'add':
            pos = op_node.get('pos')
            children = deepcopy(op_node.getchildren())
            if pos is None:
                target_node.extend(children)
                return
            if pos == 'prepend':
                for child in reversed(children):
                    target_node.insert(0, child)
                return
            if pos == 'before':
                for child in children:
                    target_node.addprevious(child)
                return
            if pos == 'after':
                for child in reversed(children):
                    target_tail = target_node.tail
                    child_tail = child.tail
                    target_node.addnext(child)
                    target_node.tail = target_tail
                    child.tail = child_tail
                return
            raise ValueError(f'pos {pos} not understood')

        if op_node.tag == 'remove':
            parent.remove(target_node)
            return

        if op_node.tag == 'replace':
            children = deepcopy(op_node.getchildren())
            for child in children:
                target_node.addprevious(child)
            parent.remove(target_node)
            return

        raise ValueError(f'unsupported op {op_node.tag}')

    def apply_custom_patch(target_tree, patch_root, source_path):
        target_root = target_tree.getroot()
        if patch_root.tag != 'diff':
            if patch_root.tag != target_root.tag:
                raise ValueError(f'root tags differ: {target_root.tag} vs {patch_root.tag}')
            target_root.extend(deepcopy(patch_root.getchildren()))
            return

        temp_root = etree.Element('root')
        temp_root.append(target_root)
        temp_tree = etree.ElementTree(temp_root)

        for op_node in patch_root:
            if not isinstance(op_node.tag, str):
                continue
            if op_node.tag not in {'add', 'replace', 'remove'}:
                print(f"      ⚠️ 跳过不支持的 patch 指令 {op_node.tag} ({source_path}:{op_node.sourceline})")
                continue
            if not evaluate_patch_condition(temp_tree, op_node):
                continue
            try:
                target_node, optype = resolve_patch_targets(temp_tree, op_node)
                apply_custom_patch_op(op_node, target_node, optype)
            except Exception as e:
                if op_node.get('silent') in {'1', 'true'}:
                    continue
                print(
                    f"      ⚠️ 自定义补丁失败 {source_path}:{op_node.sourceline} "
                    f"{op_node.tag} sel={op_node.get('sel')} err={e}"
                )

        if not len(temp_root):
            raise ValueError('XML base node was deleted')
        target_tree._setroot(temp_root[0])

    def apply_overlay_to_tree(base_tree, source_path):
        if base_tree is None:
            print(f"      ⚠️ 缺少基础树，无法应用补丁: {source_path}")
            return None, 'failed'

        try:
            source_tree = etree.parse(source_path, parser)
        except Exception as e:
            print(f"      ⚠️ 读取失败 {source_path}: {e}")
            return None, 'failed'

        source_root = source_tree.getroot()
        try:
            target_tree = clone_tree(base_tree)
            if patch_has_if(source_root):
                apply_custom_patch(target_tree, source_root, source_path)
                return target_tree, 'patched-custom'
            xml_diff.Apply_Patch(target_tree.getroot(), source_root)
            return target_tree, 'patched'
        except Exception as e:
            print(f"      ⚠️ 补丁失败 {source_path}: {e}")
            return None, 'failed'

    def get_xml_slot_paths(relative_path):
        rel = Path(os.path.normpath(relative_path))
        slot_dir = os.path.join(dest_root, str(rel.parent), rel.stem)
        return slot_dir, os.path.join(slot_dir, "base.xml"), os.path.join(slot_dir, "final.xml")

    def copy_related_xsd(relative_path, slot_dir):
        rel_path = Path(relative_path)
        xsd_name = f"{rel_path.stem}.xsd"
        base_xsd = os.path.join(src, str(rel_path.parent), xsd_name)
        if os.path.exists(base_xsd):
            shutil.copy2(base_xsd, os.path.join(slot_dir, xsd_name))
            return True

        for dlc_id in dlc_order:
            dlc_xsd = os.path.join(src, "extensions", dlc_id, str(rel_path.parent), xsd_name)
            if os.path.exists(dlc_xsd):
                shutil.copy2(dlc_xsd, os.path.join(slot_dir, xsd_name))
                return True
        return False

    def build_dlc_stack_xml(relative_path, overlay_sources_by_dlc):
        slot_dir, base_output_path, final_output_path = get_xml_slot_paths(relative_path)
        os.makedirs(slot_dir, exist_ok=True)

        base_src = os.path.join(src, relative_path)
        base_tree = None
        if os.path.exists(base_src):
            try:
                base_tree = etree.parse(base_src, parser)
                base_tree.write(base_output_path, encoding='utf-8', xml_declaration=True, pretty_print=True)
            except Exception as e:
                print(f"      ⚠️ Base 解析失败 {base_src}: {e}")
                return {'base': False, 'final': False, 'dlc_written': 0, 'xsd': False}
        else:
            print(f"      ⚠️ Base 文件不存在: {base_src}")

        copied_xsd = copy_related_xsd(relative_path, slot_dir)
        final_tree = clone_tree(base_tree) if base_tree is not None else None
        dlc_written = 0

        for dlc_id in dlc_order:
            source_path = overlay_sources_by_dlc.get(dlc_id)
            if not source_path:
                continue

            # 按需求：目录中保留 DLC 原始文件，不写“打过补丁后的单 DLC 版本”。
            dlc_output_path = os.path.join(slot_dir, f"{normalize_dlc_name(dlc_id)}.xml")
            shutil.copy2(source_path, dlc_output_path)
            dlc_written += 1

            final_next_tree, final_result = apply_overlay_to_tree(final_tree, source_path)
            if final_next_tree is not None and final_result in {'patched', 'patched-custom'}:
                final_tree = final_next_tree

        if final_tree is None and base_tree is not None:
            final_tree = clone_tree(base_tree)

        if final_tree is not None:
            final_tree.write(final_output_path, encoding='utf-8', xml_declaration=True, pretty_print=True)
            final_written = True
        else:
            final_written = False

        return {
            'base': base_tree is not None,
            'final': final_written,
            'dlc_written': dlc_written,
            'xsd': copied_xsd,
        }

    def distill_targeted_map_xml(relative_dir, base_names):
        print(f"🗺️ [4/10] 正在蒸馏地图 XML: {relative_dir} ...")
        stats = {
            'base_written': 0,
            'final_written': 0,
            'dlc_versions_written': 0,
            'xsd_copied': 0,
        }

        base_name_set = set(base_names)

        def map_dlc_name_to_base(file_name):
            if file_name in base_name_set:
                return file_name
            for base_name in base_names:
                if file_name.endswith(f"_{base_name}"):
                    return base_name
            return None

        overlay_sources_by_target = {name: {} for name in base_names}
        for dlc_id in dlc_order:
            overlay_dir = os.path.join(src, "extensions", dlc_id, relative_dir)
            if not os.path.isdir(overlay_dir):
                continue

            selected_by_target = {}
            for path in sorted(glob.glob(os.path.join(overlay_dir, "*.xml"))):
                file_name = os.path.basename(path)
                target_name = map_dlc_name_to_base(file_name)
                if target_name is None:
                    continue
                priority = 2 if file_name == target_name else 1
                current = selected_by_target.get(target_name)
                if current is None or priority > current[0]:
                    selected_by_target[target_name] = (priority, path)

            for target_name, (_, target_path) in selected_by_target.items():
                overlay_sources_by_target[target_name][dlc_id] = target_path

        for file_name in base_names:
            relative_path = os.path.join(relative_dir, file_name)
            overlay_sources_by_dlc = overlay_sources_by_target.get(file_name, {})

            result = build_dlc_stack_xml(relative_path, overlay_sources_by_dlc)
            if result['base']:
                stats['base_written'] += 1
            if result['final']:
                stats['final_written'] += 1
            if result['xsd']:
                stats['xsd_copied'] += 1
            stats['dlc_versions_written'] += result['dlc_written']

        print(
            "   ✅ 地图 XML 蒸馏完成: "
            f"base={stats['base_written']}, "
            f"final={stats['final_written']}, "
            f"dlc_versions={stats['dlc_versions_written']}, "
            f"xsd={stats['xsd_copied']}"
        )

    # --- 步骤 1: 拷贝语言包 (t/) ---
    if os.path.exists(os.path.join(src, "t")):
        shutil.copytree(os.path.join(src, "t"), os.path.join(dest_root, "t"))
        print("✅ [1/10] 语言包已拷贝。")

    # 创建 index 输出目录
    index_dest_dir = os.path.join(dest_root, "index")
    os.makedirs(index_dest_dir, exist_ok=True)

    # --- 步骤 2: 处理 index/macros.xml ---
    print("📂 [2/10] 正在处理 index/macros.xml...")
    macros_output_path = process_index_file(src, "macros.xml", "macros", dlc_order, index_dest_dir, parser)

    # --- 步骤 3: 处理 index/components.xml ---
    print("📂 [3/10] 正在处理 index/components.xml...")
    components_output_path = process_index_file(src, "components.xml", "components", dlc_order, index_dest_dir, parser)

    distill_targeted_map_xml(
        os.path.join("maps", "xu_ep2_universe"),
        ["galaxy.xml", "clusters.xml", "sectors.xml", "zones.xml", "zonehighways.xml", "sechighways.xml"]
    )

    # --- 步骤 5: 处理库与任务脚本文件 ---
    print("📂 [5/10] 正在处理核心 XML 文件 (libraries + md)...")
    lib_dest_dir = os.path.join(dest_root, "libraries")
    os.makedirs(lib_dest_dir, exist_ok=True)

    xml_files = [
        os.path.join('libraries', 'wares.xml'),
        os.path.join('libraries', 'waregroups.xml'),
        os.path.join('libraries', 'colors.xml'),
        os.path.join('libraries', 'mapdefaults.xml'),
        os.path.join('libraries', 'god.xml'),
        os.path.join('libraries', 'factions.xml'),
        os.path.join('libraries', 'region_definitions.xml'),
        os.path.join('libraries', 'regionyields.xml'),
        os.path.join('libraries', 'regionobjectgroups.xml'),
        os.path.join('libraries', 'ships.xml'),
        os.path.join('libraries', 'shipgroups.xml'),
        os.path.join('libraries', 'loadouts.xml'),
        os.path.join('libraries', 'defaults.xml'),
        os.path.join('md', 'factionlogic.xml'),
        os.path.join('md', 'khaak_activity.xml'),
    ]

    for xml_file in xml_files:
        relative_path = os.path.normpath(xml_file)
        print(f"   🔨 处理 {relative_path} ...")
        overlay_sources_by_dlc = {}
        for dlc_id in dlc_order:
            patch_path = os.path.join(src, "extensions", dlc_id, relative_path)
            if os.path.exists(patch_path):
                print(f"      [+] 注入补丁 ({dlc_id})")
                overlay_sources_by_dlc[dlc_id] = patch_path
        result = build_dlc_stack_xml(relative_path, overlay_sources_by_dlc)
        if result['final']:
            print("      ✨ 生成: final.xml")

    # --- 步骤 6: 聚合空间站宏定义 (module_macros.xml) ---
    print("∑ [6/10] 正在聚合空间站宏定义 (module_macros.xml)...")

    # 5.1 解析引用 (Needed Macros)
    needed_macros = set()
    wares_final_path = os.path.join(lib_dest_dir, "wares", "final.xml")
    if os.path.exists(wares_final_path):
        w_tree = etree.parse(wares_final_path)
        for ware in w_tree.findall(".//ware"):
            tags = ware.get('tags', '')
            if 'module' in tags:
                comp = ware.find('component')
                if comp is not None and comp.get('ref'):
                    needed_macros.add(comp.get('ref'))
    print(f"   🎯 识别到 {len(needed_macros)} 个空间站相关宏引用。")
    needed_macros = sorted(needed_macros)

    # 5.2 从 index/macros.xml 读取路径映射
    macro_path_map = {}
    if os.path.exists(macros_output_path):
        try:
            macros_index_tree = etree.parse(macros_output_path, parser)
            for entry in macros_index_tree.findall(".//entry[@name][@value]"):
                name = entry.get('name')
                value = entry.get('value')
                if name and value:
                    macro_path_map[name] = value
        except Exception as e:
            print(f"      ⚠️ 读取 macros.xml 失败: {e}")

    # 路径解析函数
    def resolve_sources(path_value):
        rel = (path_value or "").strip().replace("\\", "/").lstrip("./")
        if not rel:
            return None
        rel_xml = rel if rel.lower().endswith(".xml") else f"{rel}.xml"
        rel_xml_os = rel_xml.replace("/", os.sep)
        full_path = os.path.join(src, rel_xml_os)
        if os.path.exists(full_path):
            return full_path
        return None

    # 通用函数：从 macro 文件中收集所有 component ref
    def collect_component_refs_from_macros(macro_xml_path, xpath=".//macro/component[@ref]"):
        component_refs = set()
        if os.path.exists(macro_xml_path):
            try:
                tree = etree.parse(macro_xml_path, parser)
                for comp in tree.findall(xpath):
                    ref = comp.get('ref')
                    if ref:
                        component_refs.add(ref)
            except Exception as e:
                print(f"      ⚠️ 读取 {os.path.basename(macro_xml_path)} 失败: {e}")
        return component_refs

    # 通用函数：根据 ID 列表导出 macro/component 文件
    # filter_fn: 过滤函数，接收节点返回是否保留，None 表示不过滤
    # transform_fn: 转换函数，在节点添加到根之前对其进行转换，None 表示不转换
    def export_ids_to_file(id_list, path_map, output_path, root_tag='macros', node_tag='macro', filter_fn=None, transform_fn=None):
        # 排序去重
        sorted_ids = sorted(set(id_list))
        print(f"   🎯 处理 {len(sorted_ids)} 个 {node_tag}。")

        root = etree.Element(root_tag)
        processed = 0

        for node_id in sorted_ids:
            path_value = path_map.get(node_id)
            if not path_value:
                continue

            file_path = resolve_sources(path_value)
            if not file_path:
                continue

            try:
                tree = etree.parse(file_path, parser)
                root_node = tree.getroot()

                # 提取目标节点
                node = root_node if root_node.tag == node_tag else root_node.find(f".//{node_tag}[@name='{node_id}']")
                if node is None:
                    continue

                # 可选过滤
                if filter_fn and not filter_fn(node):
                    continue

                # 可选转换（用于过滤 component 内部的连接点等）
                if transform_fn:
                    node = transform_fn(node)
                    if node is None:
                        continue

                root.append(node)
                processed += 1
            except Exception as e:
                print(f"      ⚠️ 处理出错 {node_id}: {e}")

        # 写入文件
        etree.ElementTree(root).write(output_path, encoding='utf-8', xml_declaration=True, pretty_print=True)
        return processed

    # 5.4 导出 module_macros
    print("∑ [6/10] 正在聚合空间站宏定义 (module_macros.xml)...")
    module_macros_path = os.path.join(lib_dest_dir, "module_macros.xml")
    processed_count = export_ids_to_file(needed_macros, macro_path_map, module_macros_path, 'macros', 'macro')
    print(f"✅ 聚合完成: 写入 {processed_count} 个宏定义到 module_macros.xml")

    # --- 步骤 6: 聚合飞船宏定义 (ship_macros.xml) ---
    print("∑ [6/10] 正在聚合飞船宏定义 (ship_macros.xml)...")

    # 6.1 从 index/macros.xml 读取所有宏路径
    ship_macro_path_map = {}
    if os.path.exists(macros_output_path):
        try:
            macros_index_tree = etree.parse(macros_output_path, parser)
            for entry in macros_index_tree.findall(".//entry[@name][@value]"):
                name = entry.get('name')
                value = entry.get('value')
                if name and value:
                    ship_macro_path_map[name] = value
        except Exception as e:
            print(f"      ⚠️ 读取 macros.xml 失败: {e}")

    # 6.2 过滤出 ship_*_macro
    ship_macro_ids = [k for k in ship_macro_path_map.keys() if k.startswith('ship_') and k.endswith('_macro')]
    print(f"   🎯 识别到 {len(ship_macro_ids)} 个飞船宏引用。")

    ship_macros_path = os.path.join(lib_dest_dir, "ship_macros.xml")
    ship_processed = export_ids_to_file(ship_macro_ids, ship_macro_path_map, ship_macros_path)
    print(f"✅ 聚合完成: 写入 {ship_processed} 个飞船宏定义到 ship_macros.xml")

    # --- 步骤 7: 聚合飞船组件连接点 (ship_components.xml) ---
    print("∑ [7/9] 正在聚合飞船组件连接点 (ship_components.xml)...")

    # 7.1 从 ship_macros.xml 收集需要的 component refs
    ship_components_needed = set()
    ship_macros_path = os.path.join(lib_dest_dir, "ship_macros.xml")
    ship_components_needed = collect_component_refs_from_macros(ship_macros_path)
    print(f"   🎯 识别到 {len(ship_components_needed)} 个飞船组件引用。")

    # 7.2 从 components.xml 读取路径映射
    component_path_map = {}
    if os.path.exists(components_output_path):
        try:
            components_index_tree = etree.parse(components_output_path, parser)
            for entry in components_index_tree.findall(".//entry[@name][@value]"):
                name = entry.get('name')
                value = entry.get('value')
                if name and value:
                    component_path_map[name] = value
        except Exception as e:
            print(f"      ⚠️ 读取 components.xml 失败: {e}")

    # 7.3 过滤连接点
    keep_tag_keywords = [
        'engine', 'shield', 'turret', 'weapon',
        'thruster', 'dockingbay', 'dock', 'storage', 'cockpit'
    ]

    def should_keep_connection(conn):
        tags = (conn.get('tags') or '').lower()
        return any(key in tags for key in keep_tag_keywords)

    def transform_ship_component(component):
        new_comp = etree.Element('component')
        for attr, value in component.attrib.items():
            new_comp.set(attr, value)
        connections = component.find('connections')
        if connections is None:
            return None
        new_connections = etree.SubElement(new_comp, 'connections')
        kept = 0
        for conn in connections.findall('connection'):
            if not should_keep_connection(conn):
                continue
            new_conn = etree.SubElement(new_connections, 'connection')
            for attr in ['name', 'group', 'tags', 'value', 'optional', 'parent', 'ref']:
                if conn.get(attr) is not None:
                    new_conn.set(attr, conn.get(attr))
            kept += 1
        return new_comp if kept > 0 else None

    connections_path = os.path.join(lib_dest_dir, "ship_components.xml")
    components_processed = export_ids_to_file(
        list(ship_components_needed),
        component_path_map,
        connections_path,
        root_tag='components',
        node_tag='component',
        transform_fn=transform_ship_component
    )
    print(f"✅ 聚合完成: 写入 {components_processed} 个组件定义到 ship_components.xml")

    # --- 步骤 8: 聚合装备宏定义 (equipment_macros.xml) ---
    print("∑ [8/9] 正在聚合装备宏定义 (equipment_macros.xml)...")

    # 8.1 从 index/macros.xml 读取所有宏路径
    equipment_macro_path_map = {}
    if os.path.exists(macros_output_path):
        try:
            macros_index_tree = etree.parse(macros_output_path, parser)
            for entry in macros_index_tree.findall(".//entry[@name][@value]"):
                name = entry.get('name')
                value = entry.get('value')
                if name and value:
                    equipment_macro_path_map[name] = value
        except Exception as e:
            print(f"      ⚠️ 读取 macros.xml 失败: {e}")

    # 8.2 从 wares_final.xml 获取所有 transport="equipment" 的 macro ref
    equipment_macro_ids = []
    if os.path.exists(wares_final_path):
        try:
            wares_tree = etree.parse(wares_final_path, parser)
            for ware in wares_tree.findall(".//ware[@transport='equipment']"):
                comp = ware.find('component')
                if comp is not None and comp.get('ref'):
                    equipment_macro_ids.append(comp.get('ref'))
        except Exception as e:
            print(f"      ⚠️ 读取 wares_final.xml 失败: {e}")
    print(f"   🎯 从 wares 中识别到 {len(equipment_macro_ids)} 个装备宏引用。")

    equipment_macros_path = os.path.join(lib_dest_dir, "equipment_macros.xml")
    equipment_processed = export_ids_to_file(equipment_macro_ids, equipment_macro_path_map, equipment_macros_path)
    print(f"✅ 聚合完成: 写入 {equipment_processed} 个装备宏定义到 equipment_macros.xml")

    # --- 步骤 9: 聚合子弹宏定义 (bullet_macros.xml) ---
    print("∑ [9/10] 正在聚合子弹宏定义 (bullet_macros.xml)...")

    # 9.1 从 wares_final.xml 收集 group="missiles" 的 missile macro 名字
    missile_macro_names = set()
    if os.path.exists(wares_final_path):
        try:
            wares_tree = etree.parse(wares_final_path, parser)
            for ware in wares_tree.findall(".//ware[@group='missiles']"):
                comp = ware.find('component')
                if comp is not None and comp.get('ref'):
                    missile_macro_names.add(comp.get('ref'))
        except Exception as e:
            print(f"      ⚠️ 读取 wares_final.xml 失败: {e}")
    print(f"   🎯 从 missile wares 识别到 {len(missile_macro_names)} 个导弹宏引用。")

    # 9.2 从 equipment_macros.xml 收集所有 bullet class 引用的 macro
    bullet_macro_refs = set()
    if os.path.exists(equipment_macros_path):
        try:
            equip_tree = etree.parse(equipment_macros_path, parser)
            for macro in equip_tree.findall(".//macro"):
                bullet = macro.find('.//bullet')
                if bullet is not None:
                    bullet_class = bullet.get('class')
                    if bullet_class:
                        bullet_macro_refs.add(bullet_class)
        except Exception as e:
            print(f"      ⚠️ 读取 equipment_macros.xml 失败: {e}")
    print(f"   🎯 从 bullet class 识别到 {len(bullet_macro_refs)} 个子弹宏引用。")

    # 9.3 从 bullet_macro_refs 中剔除 missile 宏名字
    bullet_macro_refs = bullet_macro_refs - missile_macro_names
    print(f"   🎯 剔除 missile 后剩余 {len(bullet_macro_refs)} 个子弹宏引用。")

    # 9.4 导出 bullet_macros
    bullet_macros_path = os.path.join(lib_dest_dir, "bullet_macros.xml")
    bullet_processed = export_ids_to_file(list(bullet_macro_refs), equipment_macro_path_map, bullet_macros_path)
    print(f"✅ 聚合完成: 写入 {bullet_processed} 个子弹宏定义到 bullet_macros.xml")

    # --- 步骤 10: 聚合装备组件连接点 (equipment_components.xml) ---
    print("∑ [10/10] 正在聚合装备组件连接点 (equipment_components.xml)...")

    # 10.1 直接从 equipment_macros.xml 收集所有 component ref
    all_component_refs = collect_component_refs_from_macros(equipment_macros_path, ".//macro/component[@ref]")
    print(f"   🎯 从 equipment_macros.xml 识别到 {len(all_component_refs)} 个 component ref。")

    unique_component_refs = list(all_component_refs)

    # 10.3 从已整合的 index/components.xml 构建 component_path 映射。
    component_path_map = {}
    if os.path.exists(components_output_path):
        try:
            components_index_tree = etree.parse(components_output_path, parser)
            for entry in components_index_tree.findall(".//entry[@name][@value]"):
                name = entry.get('name')
                value = entry.get('value')
                if name and value:
                    component_path_map[name] = value
        except Exception as e:
            print(f"      ⚠️ 读取 components.xml 失败: {e}")

    # 10.4 过滤连接点：仅保留 tags 含 component 的 connection
    def should_keep_component_connection(conn):
        tags = (conn.get('tags') or '').lower().split()
        return "component" in tags

    def transform_equipment_component(component):
        new_comp = etree.Element('component')
        for attr, value in component.attrib.items():
            new_comp.set(attr, value)
        connections = component.find('connections')
        if connections is None:
            return None
        new_connections = etree.SubElement(new_comp, 'connections')
        kept = 0
        for conn in connections.findall('connection'):
            if not should_keep_component_connection(conn):
                continue
            new_conn = etree.SubElement(new_connections, 'connection')
            for attr, value in conn.attrib.items():
                new_conn.set(attr, value)
            kept += 1
        return new_comp if kept > 0 else None

    equipment_components_path = os.path.join(lib_dest_dir, "equipment_components.xml")
    components_processed_out = export_ids_to_file(
        unique_component_refs,
        component_path_map,
        equipment_components_path,
        root_tag='components',
        node_tag='component',
        transform_fn=transform_equipment_component
    )
    print(f"✅ 聚合完成: 写入 {components_processed_out} 个组件定义到 equipment_components.xml")

    # --- 步骤 11: 导出飞船 connections 引用的所有 macro ---
    print("∑ [11/11] 正在导出飞船 connections 引用的 macro...")

    # 使用 dest_root 下的 ship_macros.xml
    ship_macro_path = os.path.join(lib_dest_dir, "ship_macros.xml")
    ship_connection_refs = set()

    if os.path.exists(ship_macro_path):
        try:
            tree = etree.parse(ship_macro_path, parser)
            root = tree.getroot()
            for macro in root.findall('macro'):
                connections = macro.find('connections')
                if connections is not None:
                    for conn in connections:
                        conn_macro = conn.find('macro')
                        if conn_macro is not None:
                            ref = conn_macro.get('ref')
                            if ref:
                                ship_connection_refs.add(ref)
        except Exception as e:
            print(f"   ⚠️ 读取 ship_macros.xml 失败: {e}")

    print(f"   🎯 从 ship_macros.xml 识别到 {len(ship_connection_refs)} 个 connection 引用。")

    # 读取 macros index 构建完整映射
    macro_path_map = {}
    if os.path.exists(macros_output_path):
        try:
            macros_index_tree = etree.parse(macros_output_path, parser)
            for entry in macros_index_tree.findall(".//entry[@name][@value]"):
                name = entry.get('name')
                value = entry.get('value')
                if name and value:
                    macro_path_map[name] = value
        except Exception as e:
            print(f"   ⚠️ 读取 macros.xml 失败: {e}")

    print(f"   🎯 macros.xml 索引共 {len(macro_path_map)} 个 macro。")

    # 从 ship_connection_refs 对应的文件中筛选 class="dockarea" 的 macro，获取它们的 connection 引用
    dockarea_connection_refs = set()
    # 只获取 ship_connection_refs 中涉及的文件
    ref_files = set(macro_path_map[ref] for ref in ship_connection_refs if ref in macro_path_map)

    for src_file in ref_files:
        # 使用 resolve_sources 解析文件路径（与 export_ids_to_file 一致）
        actual_file = resolve_sources(src_file)
        if not actual_file:
            # 找出哪些 id 指向这个不存在的文件
            missing_ids = [ref for ref in ship_connection_refs if macro_path_map.get(ref) == src_file]
            print(f"   ⚠️ 文件不存在: {src_file}, 缺失 ID: {missing_ids}")
            continue
        try:
            tree = etree.parse(actual_file, parser)
            root = tree.getroot()
            for macro in root.findall('macro'):
                if macro.get('class') == 'dockarea':
                    connections = macro.find('connections')
                    if connections is not None:
                        for conn in connections:
                            conn_macro = conn.find('macro')
                            if conn_macro is not None:
                                ref = conn_macro.get('ref')
                                if ref:
                                    dockarea_connection_refs.add(ref)
        except Exception as e:
            print(f"   ⚠️ 读取 {actual_file} 失败: {e}")

    print(f"   🎯 从 dockarea macros 识别到 {len(dockarea_connection_refs)} 个 connection 引用。")

    # 合并两批 refs
    all_connection_refs = ship_connection_refs | dockarea_connection_refs
    print(f"   🎯 合并后共 {len(all_connection_refs)} 个 refs。")

    # 过滤出实际存在于 index 中的
    valid_refs = [ref for ref in all_connection_refs if ref in macro_path_map]
    print(f"   🎯 其中 {len(valid_refs)} 个在 index 中有记录。")

    ship_connection_macros_path = os.path.join(lib_dest_dir, "ship_connection_macros.xml")
    connection_macros_processed = export_ids_to_file(
        valid_refs,
        macro_path_map,
        ship_connection_macros_path,
        root_tag='macros',
        node_tag='macro'
    )
    print(f"✅ 聚合完成: 写入 {connection_macros_processed} 个 macro 到 ship_connection_macros.xml")

    # --- 步骤 12: 检查未导出的 equipment wares ---
    print("∑ [12/12] 正在检查未导出的 equipment wares...")

    # 读取已导出的 equipment IDs
    exported_equipment_ids = set()
    if os.path.exists(equipment_macros_path):
        try:
            equip_tree = etree.parse(equipment_macros_path, parser)
            for macro in equip_tree.findall(".//macro[@name]"):
                exported_equipment_ids.add(macro.get('name'))
        except Exception as e:
            print(f"   ⚠️ 读取 equipment_macros.xml 失败: {e}")

    # 读取 wares_final.xml 中 transport="equipment" 的 ID
    unexported_equipment_wares = []
    if os.path.exists(wares_final_path):
        try:
            wares_tree = etree.parse(wares_final_path, parser)
            for ware in wares_tree.findall(".//ware[@transport='equipment']"):
                ware_id = ware.get('id')
                if ware_id:
                    # 检查是否有对应的 macro
                    comp = ware.find('component')
                    if comp is not None:
                        macro_ref = comp.get('ref')
                        if macro_ref and macro_ref not in exported_equipment_ids:
                            unexported_equipment_wares.append({
                                'ware_id': ware_id,
                                'macro_ref': macro_ref,
                                'tags': ware.get('tags', '')
                            })
        except Exception as e:
            print(f"   ⚠️ 读取 wares_final.xml 失败: {e}")

    if unexported_equipment_wares:
        print(f"   ⚠️ 发现 {len(unexported_equipment_wares)} 个未导出的 equipment wares:")
        # 按 tags 分组统计
        tags_count = {}
        for item in unexported_equipment_wares:
            # 提取主要类型标签
            tags = item['tags'].split()
            primary_tag = tags[0] if tags else 'unknown'
            tags_count[primary_tag] = tags_count.get(primary_tag, 0) + 1

        for tag, count in sorted(tags_count.items(), key=lambda x: -x[1]):
            print(f"      - {tag}: {count} 个")

        # 输出完整列表到文件
        unexported_list_path = os.path.join(lib_dest_dir, "unexported_equipment_wares.txt")
        with open(unexported_list_path, 'w', encoding='utf-8') as f:
            f.write(f"# 未导出的 equipment wares (共 {len(unexported_equipment_wares)} 个)\n\n")
            for item in unexported_equipment_wares:
                f.write(f"{item['ware_id']} -> {item['macro_ref']} (tags: {item['tags']})\n")
        print(f"   📄 完整列表已保存到: {os.path.basename(unexported_list_path)}")
    else:
        print(f"   ✅ 所有 equipment wares 都已导出！")

    print(f"✨ 全流程结束！资产已蒸馏至 {dest_root}")

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


