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
    print("∑ [5/10] 正在聚合空间站宏定义 (module_macros.xml)...")
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
    if os.path.exists(ship_macros_path):
        try:
            ship_macros_tree = etree.parse(ship_macros_path, parser)
            for comp in ship_macros_tree.findall(".//macro/component[@ref]"):
                ship_components_needed.add(comp.get('ref'))
        except Exception as e:
            print(f"      ⚠️ 读取 ship_macros.xml 失败: {e}")
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

    # 8.2 过滤出 equipment 相关的宏（engine, thruster, shield, weapon, turret）
    equipment_keywords = ['engine', 'thruster', 'shield', 'weapon', 'turret']
    equipment_macro_ids = [
        k for k in equipment_macro_path_map.keys()
        if any(kw in k.lower() for kw in equipment_keywords) and k.endswith('_macro')
    ]
    print(f"   🎯 识别到 {len(equipment_macro_ids)} 个装备宏引用。")

    equipment_macros_path = os.path.join(lib_dest_dir, "equipment_macros.xml")
    equipment_processed = export_ids_to_file(equipment_macro_ids, equipment_macro_path_map, equipment_macros_path)
    print(f"✅ 聚合完成: 写入 {equipment_processed} 个装备宏定义到 equipment_macros.xml")

    # --- 步骤 9: 聚合子弹/导弹宏定义 (bullet_macros.xml) ---
    print("∑ [9/10] 正在聚合子弹/导弹宏定义 (bullet_macros.xml)...")

    # 9.1 从 wares_final.xml 收集 group="missiles" 的 missile ware
    missile_macro_refs = set()
    if os.path.exists(wares_final_path):
        try:
            wares_tree = etree.parse(wares_final_path, parser)
            for ware in wares_tree.findall(".//ware[@group='missiles']"):
                comp = ware.find('component')
                if comp is not None and comp.get('ref'):
                    missile_macro_refs.add(comp.get('ref'))
        except Exception as e:
            print(f"      ⚠️ 读取 wares_final.xml 失败: {e}")
    print(f"   🎯 从 missile wares 识别到 {len(missile_macro_refs)} 个导弹宏引用。")

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

    # 9.3 合并去重
    all_bullet_macro_ids = list(missile_macro_refs.union(bullet_macro_refs))
    print(f"   🎯 合并后共 {len(all_bullet_macro_ids)} 个子弹/导弹宏。")

    # 9.4 导出 bullet_macros
    bullet_macros_path = os.path.join(lib_dest_dir, "bullet_macros.xml")
    bullet_processed = export_ids_to_file(all_bullet_macro_ids, equipment_macro_path_map, bullet_macros_path)
    print(f"✅ 聚合完成: 写入 {bullet_processed} 个子弹/导弹宏定义到 bullet_macros.xml")

    # --- 步骤 10: 聚合装备组件连接点 (equipment_components.xml) ---
    print("∑ [10/10] 正在聚合装备组件连接点 (equipment_components.xml)...")

    # 10.1 从 equipment_macros.xml + wares_final.xml 收集 equipment -> component ref 映射。
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

    # 10.2 提取唯一的 component refs（去重）
    unique_component_refs = list(set(equipment_to_component_ref.values()))
    print(f"   🎯 去重后共 {len(unique_component_refs)} 个唯一组件。")

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

    print(f"✨ 全流程结束！资产已蒸馏至 {dest_root}")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n程序终止: {e}")
        sys.exit(1)
