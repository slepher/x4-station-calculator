import os
import shutil
import glob
import json
import sys
from copy import deepcopy
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

def setup_customizer(m_config):
    paths = m_config.get('X4_PATHS', {})
    customizer_path = paths.get('CUSTOMIZER_PATH')
    if not customizer_path or not os.path.exists(customizer_path):
        raise NotADirectoryError(f"❌ 错误: CUSTOMIZER_PATH 无效: {customizer_path}")
    if customizer_path not in sys.path:
        sys.path.append(customizer_path)
    try:
        from Framework import File_Manager # type: ignore
        return File_Manager.XML_Diff
    except ImportError:
        raise ImportError("❌ 错误: 无法加载 Customizer 框架逻辑。")

def main():
    # 1. 加载配置与初始化
    m_config, v_config, config_dir = load_all_configs()
    xml_diff = setup_customizer(m_config)

    paths = m_config['X4_PATHS']
    src = os.path.normpath(os.path.join(config_dir, paths['SOURCE']))
    dest_root = os.path.normpath(os.path.join(config_dir, v_config['raw_assets_dir'], v_config['folder_name']))

    print(f"🧪 开始资产蒸馏流: {v_config['folder_name']}")
    print(f"   📁 SOURCE: {src}")
    print(f"   📁 DEST:   {dest_root}")

    if os.path.exists(dest_root):
        shutil.rmtree(dest_root)
    os.makedirs(dest_root, exist_ok=True)

    parser = etree.XMLParser(remove_blank_text=True)
    dlc_order = v_config.get('dlc_order', [])

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

        # 记录每个 entry 的来源: name -> [(source, value), ...]
        entry_sources = {}

        tree = None
        if os.path.exists(base_path):
            tree = etree.parse(base_path, parser)
        else:
            print(f"      ⚠️ Base 文件不存在: {base_path}")
            tree = etree.ElementTree(etree.Element(root_element_name))

        root = tree.getroot()
        for dlc_id in dlc_order:
            patch_path = os.path.join(src, "extensions", dlc_id, "index", index_name)
            if not os.path.exists(patch_path):
                continue
            print(f"      [+] 叠加节点 ({dlc_id})")
            try:
                patch_tree = etree.parse(patch_path, parser)
                patch_root = patch_tree.getroot()
                for node in patch_root:
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

        # 规范化后构建 entry_sources（使用规范化后的 value）
        entry_sources = {}
        for node in root:
            name = node.get("name")
            value = node.get("value") or ""
            if name:
                if name not in entry_sources:
                    entry_sources[name] = []
                entry_sources[name].append(('base', value))

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
            # 获取保留节点的 value
            remaining_value = entries[-1].get("value") or ""
            # 从 entry_sources 中找到与保留节点 value 匹配的来源
            sources = entry_sources.get(name, [])
            kept_sources = []
            for src, val in sources:
                # 比较时考虑规范化
                if val == remaining_value or val.replace("\\\\", "\\") == remaining_value.replace("\\\\", "\\"):
                    kept_sources.append((src, val))
            # 如果精确匹配没找到，取最后一个来源
            if not kept_sources and sources:
                kept_sources = [sources[-1]]

            for old_node in entries[:-1]:
                root.remove(old_node)
            # 记录重复信息用于表格输出
            dup_entries.append((name, kept_sources))

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
                print(f"      {' ' * name_width} | {' ' * src_width} | (保留最后一条)")

        # 写出文件
        tree.write(output_path, encoding='utf-8', xml_declaration=True, pretty_print=True)

        # 最终统计
        final_names = [node.get("name") for node in root if node.get("name")]
        print(f"   ✨ 生成: index/{index_name}")
        print(f"   ✅ {root_element_name} 处理完成，共 {len(final_names)} 个具名元素。")

        return output_path

    # --- 步骤 1: 拷贝语言包 (t/) ---
    if os.path.exists(os.path.join(src, "t")):
        shutil.copytree(os.path.join(src, "t"), os.path.join(dest_root, "t"))
        print("✅ [1/9] 语言包已拷贝。")

    # 创建 index 输出目录
    index_dest_dir = os.path.join(dest_root, "index")
    os.makedirs(index_dest_dir, exist_ok=True)

    # --- 步骤 2: 处理 index/macros.xml ---
    print("📂 [2/9] 正在处理 index/macros.xml...")
    macros_output_path = process_index_file(src, "macros.xml", "macros", dlc_order, index_dest_dir, parser)

    # --- 步骤 3: 处理 index/components.xml ---
    print("📂 [3/9] 正在处理 index/components.xml...")
    components_output_path = process_index_file(src, "components.xml", "components", dlc_order, index_dest_dir, parser)

    # --- 步骤 4: 处理核心库文件 (wares/waregroups/colors/ships/shipgroups/loadouts) ---
    print("📂 [4/9] 正在处理核心库文件 (Wares/Waregroups/Colors/Ships/Shipgroups/Loadouts)...")
    lib_dest_dir = os.path.join(dest_root, "libraries")
    os.makedirs(lib_dest_dir, exist_ok=True)

    lib_files = [
        { 'name': 'wares.xml', 'final': 'wares_final.xml' },
        { 'name': 'waregroups.xml', 'final': 'waregroups_final.xml' },
        { 'name': 'colors.xml', 'final': 'colors_final.xml' },
        { 'name': 'ships.xml', 'final': 'ships_final.xml' },
        { 'name': 'shipgroups.xml', 'final': 'shipgroups_final.xml' },
        # loadouts 需要叠加 DLC
        { 'name': 'loadouts.xml', 'final': 'loadouts_final.xml' },
    ]

    for lib_file in lib_files:
        lib_name = lib_file['name']
        final_name = lib_file['final']
        print(f"   🔨 处理 {lib_name} ...")
        # 1. 拷贝 Base
        base_src = os.path.join(src, "libraries", lib_name)
        target_path = os.path.join(lib_dest_dir, lib_name)
        
        if os.path.exists(base_src):
            shutil.copy2(base_src, target_path)
        else:
            print(f"      ⚠️ Base 文件不存在: {base_src}")
            continue

        # 2. 合并 DLC Patch
        base_tree = etree.parse(target_path, parser)
        for dlc_id in dlc_order:
            # Patch 位于 SOURCE 目录的 extensions 中
            patch_path = os.path.join(src, "extensions", dlc_id, "libraries", lib_name)
            if os.path.exists(patch_path):
                print(f"      [+] 注入补丁 ({dlc_id})")
                try:
                    patch_tree = etree.parse(patch_path, parser)
                    xml_diff.Apply_Patch(base_tree.getroot(), patch_tree.getroot())
                except Exception as e:
                    print(f"      ⚠️ 警告: 补丁失败 {dlc_id}: {e}")
        
        # 3. 写入 Final
        final_output_path = os.path.join(lib_dest_dir, final_name)
        base_tree.write(final_output_path, encoding='utf-8', xml_declaration=True, pretty_print=True)
        print(f"      ✨ 生成: {os.path.basename(final_output_path)}")

    # --- 步骤 5: 聚合空间站宏定义 (module_macros.xml) ---
    print("∑ [5/9] 正在聚合空间站宏定义 (module_macros.xml)...")

    # 5.1 解析引用 (Needed Macros)
    needed_macros = set()
    wares_final_path = os.path.join(lib_dest_dir, "wares_final.xml")
    if os.path.exists(wares_final_path):
        w_tree = etree.parse(wares_final_path)
        for ware in w_tree.findall(".//ware"):
            tags = ware.get('tags', '')
            if 'module' in tags:
                comp = ware.find('component')
                if comp is not None and comp.get('ref'):
                    needed_macros.add(comp.get('ref'))
    print(f"   🎯 识别到 {len(needed_macros)} 个空间站相关宏引用。")

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

    # 5.3 路径解析函数
    def resolve_macro_sources(path_value):
        rel = (path_value or "").strip().replace("\\", "/").lstrip("./")
        if not rel:
            return {}
        rel_xml = rel if rel.lower().endswith(".xml") else f"{rel}.xml"
        rel_xml_os = rel_xml.replace("/", os.sep)

        sources = {}
        # 路径可能包含 extensions/dlc_name/ 前缀
        if rel_xml.lower().startswith("extensions/"):
            # DLC 路径: extensions/dlc_name/assets/...
            parts = rel_xml.split("/", 2)  # ['extensions', 'dlc_name', 'assets/...']
            if len(parts) >= 3:
                dlc_name = parts[1]
                rest_path = parts[2].replace("/", os.sep)
                full_path = os.path.join(src, "extensions", dlc_name, rest_path)
                if os.path.exists(full_path):
                    sources[dlc_name] = full_path
        else:
            # Base 路径
            base_path = os.path.join(src, rel_xml_os)
            if os.path.exists(base_path):
                sources['base'] = base_path
        return sources

    # 5.4 聚合与熔断检查
    macros_root = etree.Element('macros')
    processed_count = 0

    for macro_id in needed_macros:
        if macro_id not in macro_path_map:
            continue

        path_value = macro_path_map[macro_id]
        sources = resolve_macro_sources(path_value)
        if not sources:
            continue

        # 加载 Base
        current_tree = None
        if 'base' in sources:
            try:
                current_tree = etree.parse(sources['base'], parser)
            except:
                pass

        # 按顺序应用 DLC
        for dlc_id in dlc_order:
            if dlc_id in sources:
                f_path = sources[dlc_id]
                try:
                    # 🚨 安全熔断检查 🚨
                    dlc_tree = etree.parse(f_path, parser)
                    dlc_root = dlc_tree.getroot()

                    # 检查所有 add, replace, remove 节点
                    for node in dlc_root.xpath("//*[self::add or self::replace or self::remove]"):
                        sel = node.get('sel', '')
                        # 检查 sel 是否指向 /wares (即修改全局配方)
                        if sel and (sel.strip().startswith('/wares') or '/wares/' in sel):
                            print(f"\n❌ 严重违规: DLC ({dlc_id}) 文件试图修改全局 wares 配方!")
                            print(f"   文件: {f_path}")
                            print(f"   节点: <{node.tag} sel='{sel}'>")
                            raise RuntimeError("🛡️ 安全熔断触发: 检测到非法的全局配方修改操作。")

                    # 合并逻辑
                    if dlc_root.tag == 'diff':
                        if current_tree:
                            xml_diff.Apply_Patch(current_tree.getroot(), dlc_root)
                    else:
                        current_tree = dlc_tree

                except Exception as e:
                    if "安全熔断" in str(e): raise
                    print(f"      ⚠️ 处理出错 {macro_id} ({dlc_id}): {e}")

        # 添加到聚合根
        if current_tree:
            root_node = current_tree.getroot()
            macro_node = root_node if root_node.tag == 'macro' else root_node.find(f".//macro[@name='{macro_id}']")
            if macro_node is not None:
                macros_root.append(macro_node)
                processed_count += 1

    # 5.5 保存
    macros_final_path = os.path.join(lib_dest_dir, "module_macros.xml")
    etree.ElementTree(macros_root).write(macros_final_path, encoding='utf-8', xml_declaration=True, pretty_print=True)
    print(f"✅ 聚合完成: 写入 {processed_count} 个宏定义到 module_macros.xml")

    # --- 步骤 6: 聚合飞船宏定义 (ship_macros.xml) ---
    print("∑ [6/9] 正在聚合飞船宏定义 (ship_macros.xml)...")

    ship_macro_index = {}

    def scan_macros_to_index(root_path, source_key, pattern):
        for f in glob.glob(pattern, recursive=True):
            fname = os.path.splitext(os.path.basename(f))[0]
            if fname not in ship_macro_index:
                ship_macro_index[fname] = {}
            ship_macro_index[fname][source_key] = f

    scan_macros_to_index(src, 'base', os.path.join(src, "assets", "**", "macros", "ship_*_macro.xml"))
    for dlc_id in dlc_order:
        p = os.path.join(src, "extensions", dlc_id)
        if os.path.exists(p):
            scan_macros_to_index(p, dlc_id, os.path.join(p, "assets", "**", "macros", "ship_*_macro.xml"))

    ship_macros_root = etree.Element('macros')
    ship_processed = 0

    for macro_id, sources in ship_macro_index.items():
        current_tree = None
        if 'base' in sources:
            try:
                current_tree = etree.parse(sources['base'], parser)
            except:
                pass

        for dlc_id in dlc_order:
            if dlc_id in sources:
                f_path = sources[dlc_id]
                try:
                    dlc_tree = etree.parse(f_path, parser)
                    dlc_root = dlc_tree.getroot()
                    if dlc_root.tag == 'diff':
                        if current_tree:
                            xml_diff.Apply_Patch(current_tree.getroot(), dlc_root)
                    else:
                        current_tree = dlc_tree
                except Exception as e:
                    print(f"      ⚠️ 处理出错 {macro_id} ({dlc_id}): {e}")

        if current_tree:
            root_node = current_tree.getroot()
            macro_node = root_node if root_node.tag == 'macro' else root_node.find(f".//macro[@name='{macro_id}']")
            if macro_node is not None:
                ship_macros_root.append(macro_node)
                ship_processed += 1

    ship_macros_path = os.path.join(lib_dest_dir, "ship_macros.xml")
    etree.ElementTree(ship_macros_root).write(ship_macros_path, encoding='utf-8', xml_declaration=True, pretty_print=True)
    print(f"✅ 聚合完成: 写入 {ship_processed} 个飞船宏定义到 ship_macros.xml")

    # --- 步骤 7: 聚合飞船组件连接点 (ship_connections.xml) ---
    print("∑ [7/9] 正在聚合飞船组件连接点 (ship_connections.xml)...")

    # 5.1 从 ship_macros.xml 收集需要的 component refs
    ship_components_needed = set()
    ship_macros_path = os.path.join(lib_dest_dir, "ship_macros.xml")
    if os.path.exists(ship_macros_path):
        try:
            ship_macros_tree = etree.parse(ship_macros_path, parser)
            for comp in ship_macros_tree.findall(".//macro/component[@ref]"):
                ship_components_needed.add(comp.get('ref'))
        except Exception as e:
            print(f"      ⚠️ 读取 ship_macros.xml 失败: {e}")
    print(f"   🎯 识别到 {len(ship_components_needed)} 个飞船组件引用。")

    # 5.2 建立索引 (只针对 ship_*.xml)
    ship_component_index = {}

    def scan_components_to_index(root_path, source_key, pattern):
        for f in glob.glob(pattern, recursive=True):
            fname = os.path.splitext(os.path.basename(f))[0]
            if fname not in ship_component_index:
                ship_component_index[fname] = {}
            ship_component_index[fname][source_key] = f

    scan_components_to_index(src, 'base', os.path.join(src, "assets", "units", "**", "ship_*.xml"))
    for dlc_id in dlc_order:
        p = os.path.join(src, "extensions", dlc_id)
        if os.path.exists(p):
            scan_components_to_index(p, dlc_id, os.path.join(p, "assets", "units", "**", "ship_*.xml"))

    # 5.3 仅聚合被引用的组件，并按 tags 过滤连接点
    keep_tag_keywords = [
        'engine', 'shield', 'turret', 'weapon',
        'thruster', 'dockingbay', 'dock', 'storage', 'cockpit'
    ]

    def should_keep_connection(conn):
        tags = (conn.get('tags') or '').lower()
        return any(key in tags for key in keep_tag_keywords)

    def clone_component_with_filtered_connections(component):
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

    components_root = etree.Element('components')
    components_processed = 0

    for comp_id in ship_components_needed:
        if comp_id not in ship_component_index:
            continue
        sources = ship_component_index[comp_id]
        current_tree = None
        if 'base' in sources:
            try:
                current_tree = etree.parse(sources['base'], parser)
            except:
                pass

        for dlc_id in dlc_order:
            if dlc_id in sources:
                f_path = sources[dlc_id]
                try:
                    dlc_tree = etree.parse(f_path, parser)
                    dlc_root = dlc_tree.getroot()
                    if dlc_root.tag == 'diff':
                        if current_tree:
                            xml_diff.Apply_Patch(current_tree.getroot(), dlc_root)
                    else:
                        current_tree = dlc_tree
                except Exception as e:
                    print(f"      ⚠️ 处理出错 {comp_id} ({dlc_id}): {e}")

        if current_tree:
            root_node = current_tree.getroot()
            if root_node.tag == 'component':
                filtered = clone_component_with_filtered_connections(root_node)
                if filtered is not None:
                    components_root.append(filtered)
                    components_processed += 1
            elif root_node.tag == 'components':
                for node in root_node.findall('component'):
                    filtered = clone_component_with_filtered_connections(node)
                    if filtered is not None:
                        components_root.append(filtered)
                        components_processed += 1

    connections_path = os.path.join(lib_dest_dir, "ship_connections.xml")
    etree.ElementTree(components_root).write(connections_path, encoding='utf-8', xml_declaration=True, pretty_print=True)
    print(f"✅ 聚合完成: 写入 {components_processed} 个组件定义到 ship_connections.xml")

    # --- 步骤 8: 聚合装备宏定义 (equipment_macros.xml) ---
    print("∑ [8/9] 正在聚合装备宏定义 (equipment_macros.xml)...")

    equipment_macro_index = {}

    def scan_equipment_to_index(root_path, source_key, pattern):
        for f in glob.glob(pattern, recursive=True):
            fname = os.path.splitext(os.path.basename(f))[0]
            if fname not in equipment_macro_index:
                equipment_macro_index[fname] = {}
            equipment_macro_index[fname][source_key] = f

    equipment_patterns = [
        os.path.join("assets", "props", "**", "macros", "*engine*_macro.xml"),
        os.path.join("assets", "props", "**", "macros", "*thruster*_macro.xml"),
        os.path.join("assets", "props", "**", "macros", "*shield*_macro.xml"),
        os.path.join("assets", "props", "**", "macros", "*weapon*_macro.xml"),
        os.path.join("assets", "props", "**", "macros", "*turret*_macro.xml"),
    ]

    for pattern in equipment_patterns:
        scan_equipment_to_index(src, 'base', os.path.join(src, pattern))
    for dlc_id in dlc_order:
        p = os.path.join(src, "extensions", dlc_id)
        if os.path.exists(p):
            for pattern in equipment_patterns:
                scan_equipment_to_index(p, dlc_id, os.path.join(p, pattern))

    equipment_macros_root = etree.Element('macros')
    equipment_processed = 0

    for macro_id, sources in equipment_macro_index.items():
        current_tree = None
        if 'base' in sources:
            try:
                current_tree = etree.parse(sources['base'], parser)
            except:
                pass

        for dlc_id in dlc_order:
            if dlc_id in sources:
                f_path = sources[dlc_id]
                try:
                    dlc_tree = etree.parse(f_path, parser)
                    dlc_root = dlc_tree.getroot()
                    if dlc_root.tag == 'diff':
                        if current_tree:
                            xml_diff.Apply_Patch(current_tree.getroot(), dlc_root)
                    else:
                        current_tree = dlc_tree
                except Exception as e:
                    print(f"      ⚠️ 处理出错 {macro_id} ({dlc_id}): {e}")

        if current_tree:
            root_node = current_tree.getroot()
            macro_node = root_node if root_node.tag == 'macro' else root_node.find(f".//macro[@name='{macro_id}']")
            if macro_node is not None:
                equipment_macros_root.append(macro_node)
                equipment_processed += 1

    equipment_macros_path = os.path.join(lib_dest_dir, "equipment_macros.xml")
    etree.ElementTree(equipment_macros_root).write(equipment_macros_path, encoding='utf-8', xml_declaration=True, pretty_print=True)
    print(f"✅ 聚合完成: 写入 {equipment_processed} 个装备宏定义到 equipment_macros.xml")

    # --- 步骤 9: 聚合装备组件连接点 (equipment_components.xml) ---
    print("∑ [9/9] 正在聚合装备组件连接点 (equipment_components.xml)...")

    # 8.1 从 equipment_macros.xml + wares_final.xml 收集 equipment -> component ref 映射。
    # 映射链路: equipment(ware id) -> ware.component(ref=macro) -> equipment_macro.component(ref=component)
    equipment_to_component_ref = {}
    macro_to_component_ref = {}
    if os.path.exists(equipment_macros_path):
        try:
            equipment_macros_tree = etree.parse(equipment_macros_path, parser)
            for macro in equipment_macros_tree.findall(".//macro[@name]"):
                macro_name = macro.get('name')
                comp = macro.find('component')
                comp_ref = comp.get('ref') if comp is not None else None
                if macro_name and comp_ref:
                    macro_to_component_ref[macro_name] = comp_ref
        except Exception as e:
            print(f"      ⚠️ 读取 equipment_macros.xml 失败: {e}")
    if os.path.exists(wares_final_path):
        try:
            wares_tree = etree.parse(wares_final_path, parser)
            for ware in wares_tree.findall(".//ware[@id]"):
                ware_id = ware.get('id')
                comp = ware.find('component')
                comp_ref = comp.get('ref') if comp is not None else None
                if not ware_id or not comp_ref:
                    continue
                component_ref = macro_to_component_ref.get(comp_ref)
                if component_ref:
                    equipment_to_component_ref[ware_id] = component_ref
        except Exception as e:
            print(f"      ⚠️ 读取 wares_final.xml 失败: {e}")
    print(f"   🎯 识别到 {len(equipment_to_component_ref)} 条 equipment -> component 映射。")

    # 8.2 从已整合的 index/components.xml 构建 equipment_id -> component_path 映射。
    component_path_by_equipment_id = {}
    if os.path.exists(components_output_path):
        try:
            components_index_tree = etree.parse(components_output_path, parser)
            for entry in components_index_tree.findall(".//entry[@name][@value]"):
                name = entry.get('name')
                value = entry.get('value')
                if name and value and name not in component_path_by_equipment_id:
                    component_path_by_equipment_id[name] = value
        except Exception as e:
            print(f"      ⚠️ 读取 components.xml 失败: {e}")

    # 8.3 仅保留 tags 含 component 的 connection（逻辑保持与之前一致）。
    def should_keep_component_connection(conn):
        tags = (conn.get('tags') or '').lower().split()
        return "component" in tags

    def clone_component_with_filtered_connections(component):
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

    def resolve_component_sources(path_value):
        rel = (path_value or "").strip().replace("\\", "/").lstrip("./")
        if not rel:
            return {}
        rel_xml = rel if rel.lower().endswith(".xml") else f"{rel}.xml"
        rel_xml_os = rel_xml.replace("/", os.sep)

        sources = {}
        # 仅使用 components.xml 提供的路径（其本身可包含 DLC 前缀）。
        root_path = os.path.join(src, rel_xml_os)
        if os.path.exists(root_path):
            sources['base'] = root_path
        return sources

    components_root_out = etree.Element('components')
    components_processed_out = 0

    processed_component_refs = set()
    for equipment_id, component_ref in equipment_to_component_ref.items():
        if component_ref in processed_component_refs:
            continue
        path_value = component_path_by_equipment_id.get(component_ref)
        if not path_value:
            continue
        sources = resolve_component_sources(path_value)
        if not sources:
            continue

        current_tree = None
        if 'base' in sources:
            try:
                current_tree = etree.parse(sources['base'], parser)
            except:
                pass

        for dlc_id in dlc_order:
            if dlc_id in sources:
                f_path = sources[dlc_id]
                try:
                    dlc_tree = etree.parse(f_path, parser)
                    dlc_root = dlc_tree.getroot()
                    if dlc_root.tag == 'diff':
                        if current_tree:
                            xml_diff.Apply_Patch(current_tree.getroot(), dlc_root)
                    else:
                        current_tree = dlc_tree
                except Exception as e:
                    print(f"      ⚠️ 处理出错 {equipment_id} ({dlc_id}): {e}")

        if current_tree:
            root_node = current_tree.getroot()
            if root_node.tag == 'component':
                filtered = clone_component_with_filtered_connections(root_node)
                if filtered is not None:
                    components_root_out.append(filtered)
                    components_processed_out += 1
                    processed_component_refs.add(component_ref)
            elif root_node.tag == 'components':
                for node in root_node.findall('component'):
                    filtered = clone_component_with_filtered_connections(node)
                    if filtered is not None:
                        components_root_out.append(filtered)
                        components_processed_out += 1
                        processed_component_refs.add(component_ref)

    equipment_components_path = os.path.join(lib_dest_dir, "equipment_components.xml")
    etree.ElementTree(components_root_out).write(
        equipment_components_path,
        encoding='utf-8',
        xml_declaration=True,
        pretty_print=True
    )
    print(f"✅ 聚合完成: 写入 {components_processed_out} 个组件定义到 equipment_components.xml")

    print(f"✨ 全流程结束！资产已蒸馏至 {dest_root}")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n程序终止: {e}")
        sys.exit(1)
