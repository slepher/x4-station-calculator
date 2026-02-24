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
    if not os.path.exists(config_file) or not os.path.exists(version_file):
        raise FileNotFoundError("❌ 错误: 配置文件 x4-game.config.json 或 x4-station-calculator.config.json 缺失。")
    with open(config_file, 'r', encoding='utf-8') as f:
        m_config = json.load(f)
    with open(version_file, 'r', encoding='utf-8') as f:
        v_config = json.load(f)
    return m_config, v_config

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
    m_config, v_config = load_all_configs()
    xml_diff = setup_customizer(m_config)
    
    paths = m_config['X4_PATHS']
    src = paths['SOURCE']
    dest_root = os.path.join(v_config['raw_assets_dir'], v_config['folder_name'])

    print(f"🧪 开始资产蒸馏流: {v_config['folder_name']}")
    
    if os.path.exists(dest_root):
        shutil.rmtree(dest_root)
    os.makedirs(dest_root, exist_ok=True)

    # --- 步骤 1: 拷贝语言包 (t/) ---
    if os.path.exists(os.path.join(src, "t")):
        shutil.copytree(os.path.join(src, "t"), os.path.join(dest_root, "t"))
        print("✅ [1/8] 语言包已拷贝。")

    # --- 步骤 2: 迁移并叠加 index/components.xml ---
    print("📂 [2/7] 正在迁移 index/components.xml...")
    index_dest_dir = os.path.join(dest_root, "index")
    os.makedirs(index_dest_dir, exist_ok=True)

    components_base_path = os.path.join(src, "index", "components.xml")
    components_output_path = os.path.join(index_dest_dir, "components.xml")
    parser = etree.XMLParser(remove_blank_text=True)
    dlc_order = v_config.get('dlc_order', [])

    components_tree = None
    if os.path.exists(components_base_path):
        components_tree = etree.parse(components_base_path, parser)
    else:
        print(f"      ⚠️ Base 文件不存在: {components_base_path}")
        components_tree = etree.ElementTree(etree.Element("components"))

    components_root = components_tree.getroot()
    for dlc_id in dlc_order:
        patch_path = os.path.join(src, "extensions", dlc_id, "index", "components.xml")
        if not os.path.exists(patch_path):
            continue
        print(f"      [+] 叠加节点 ({dlc_id})")
        try:
            patch_tree = etree.parse(patch_path, parser)
            patch_root = patch_tree.getroot()
            for node in patch_root:
                components_root.append(deepcopy(node))
        except Exception as e:
            print(f"      ⚠️ 警告: 叠加失败 {dlc_id}: {e}")

    # 过滤 value 路径包含 assets/test 的 entry 元素（兼容 / 与 \）。
    removed_test_entries = 0
    for entry in list(components_root.findall(".//entry[@value]")):
        value = (entry.get("value") or "").lower().replace("\\", "/")
        if "assets/test" in value:
            parent = entry.getparent()
            if parent is not None:
                parent.remove(entry)
                removed_test_entries += 1
    if removed_test_entries:
        print(f"   🧹 已移除 {removed_test_entries} 个 assets/test entry。")

    # 规范 value 中的双反斜杠，避免路径格式差异导致去重失败。
    normalized_double_slash = 0
    for entry in components_root.findall(".//entry[@value]"):
        value = entry.get("value") or ""
        normalized = value
        while "\\\\" in normalized:
            normalized = normalized.replace("\\\\", "\\")
        if normalized != value:
            entry.set("value", normalized)
            normalized_double_slash += 1
    if normalized_double_slash:
        print(f"   🔧 已规范 {normalized_double_slash} 个 entry.value 双反斜杠。")

    def node_signature(node):
        # 忽略纯空白 text/tail，避免 <entry></entry> 与 <entry/> 被视为不同。
        attrs = tuple(sorted((k, v) for k, v in node.attrib.items()))
        text = (node.text or '').strip()
        children = tuple(node_signature(child) for child in list(node))
        return (node.tag, attrs, text, children)

    # name 相同且内容完全一致的节点自动去重合并。
    merged_same_content = 0
    seen_name_and_content = set()
    for node in list(components_root):
        name = node.get("name")
        if not name:
            continue
        signature = node_signature(node)
        key = (name, signature)
        if key in seen_name_and_content:
            components_root.remove(node)
            merged_same_content += 1
        else:
            seen_name_and_content.add(key)
    if merged_same_content:
        print(f"   ♻️ 已合并 {merged_same_content} 个同名同内容节点。")

    # 先写出文件，便于人工检查内容；随后再做重复校验并决定是否终止。
    components_tree.write(components_output_path, encoding='utf-8', xml_declaration=True, pretty_print=True)
    print(f"   ✨ 生成: index/components.xml")

    # 校验直接子节点中 name 属性是否重复。
    names = [node.get("name") for node in components_root if node.get("name")]
    name_counts = {}
    for name in names:
        name_counts[name] = name_counts.get(name, 0) + 1
    dup_names = sorted([name for name, count in name_counts.items() if count > 1])
    if dup_names:
        sample = ", ".join(dup_names[:10])
        more = f" ... (+{len(dup_names)-10} more)" if len(dup_names) > 10 else ""
        raise RuntimeError(
            f"❌ index/components.xml 已写出，但存在重复 name: {sample}{more}"
        )
    print(f"   ✅ name 去重校验通过，共 {len(names)} 个具名元素。")

    # --- 步骤 3: 处理核心库文件 (wares/waregroups/colors/ships/shipgroups/loadouts) ---
    print("📂 [3/8] 正在处理核心库文件 (Wares/Waregroups/Colors/Ships/Shipgroups/Loadouts)...")
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
    parser = etree.XMLParser(remove_blank_text=True)
    dlc_order = v_config.get('dlc_order', [])

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

    # --- 步骤 4: 聚合空间站宏定义 (module_macros.xml) ---
    print("∑ [4/8] 正在聚合空间站宏定义 (module_macros.xml)...")
    
    # 3.1 解析引用 (Needed Macros)
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

    # 3.2 建立索引 (Find files)
    # macro_id -> { 'base': path, 'dlc_id': path, ... }
    macro_index = {}
    
    def scan_to_index(root_path, source_key):
        pattern = os.path.join(root_path, "assets", "structures", "**", "*.xml")
        for f in glob.glob(pattern, recursive=True):
            fname = os.path.splitext(os.path.basename(f))[0]
            if fname not in macro_index: macro_index[fname] = {}
            macro_index[fname][source_key] = f

    # 扫描
    scan_to_index(src, 'base')
    for dlc_id in dlc_order:
        p = os.path.join(src, "extensions", dlc_id)
        if os.path.exists(p): scan_to_index(p, dlc_id)

    # 3.3 聚合与熔断检查
    macros_root = etree.Element('macros')
    processed_count = 0

    for macro_id in needed_macros:
        if macro_id not in macro_index: continue
        sources = macro_index[macro_id]
        
        # 加载 Base (如果存在)
        current_tree = None
        if 'base' in sources:
            try:
                current_tree = etree.parse(sources['base'], parser)
            except: pass
        
        # 按顺序应用 DLC
        for dlc_id in dlc_order:
            if dlc_id in sources:
                f_path = sources[dlc_id]
                try:
                    # 🚨 安全熔断检查 🚨
                    # 读取并解析以检查非法 patch
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
                            # Apply patch
                            xml_diff.Apply_Patch(current_tree.getroot(), dlc_root)
                        else:
                            # 只有 diff 没有 base? 跳过
                            pass
                    else:
                        # Full replacement (macro definition)
                        current_tree = dlc_tree
                
                except Exception as e:
                    if "安全熔断" in str(e): raise # 抛出熔断
                    print(f"      ⚠️ 处理出错 {macro_id} ({dlc_id}): {e}")

        # 添加到聚合根
        if current_tree:
            root_node = current_tree.getroot()
            # 找到 macro 节点 (可能是 root，也可能在里面)
            macro_node = root_node if root_node.tag == 'macro' else root_node.find(f".//macro[@name='{macro_id}']")
            
            if macro_node is not None:
                macros_root.append(macro_node)
                processed_count += 1

    # 3.4 保存
    macros_final_path = os.path.join(lib_dest_dir, "module_macros.xml")
    etree.ElementTree(macros_root).write(macros_final_path, encoding='utf-8', xml_declaration=True, pretty_print=True)
    print(f"✅ 聚合完成: 写入 {processed_count} 个宏定义到 macros_final.xml")

    # --- 步骤 5: 聚合飞船宏定义 (ship_macros.xml) ---
    print("∑ [5/8] 正在聚合飞船宏定义 (ship_macros.xml)...")

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

    # --- 步骤 6: 聚合飞船组件连接点 (ship_connections.xml) ---
    print("∑ [6/8] 正在聚合飞船组件连接点 (ship_connections.xml)...")

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

    # --- 步骤 7: 聚合装备宏定义 (equipment_macros.xml) ---
    print("∑ [7/8] 正在聚合装备宏定义 (equipment_macros.xml)...")

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

    # --- 步骤 8: 聚合装备 SurfaceElements 连接点 (equipment_surface.xml) ---
    print("∑ [8/8] 正在聚合装备 SurfaceElements 连接点 (equipment_surface.xml)...")

    # 7.1 从 equipment_macros.xml + wares_final.xml 收集需要的 equipment id。
    # 匹配键仅使用 equipment id（ware id），不使用 macro 名称。
    equipment_ids_needed = set()
    equipment_macro_names = set()
    if os.path.exists(equipment_macros_path):
        try:
            equipment_macros_tree = etree.parse(equipment_macros_path, parser)
            for macro in equipment_macros_tree.findall(".//macro[@name]"):
                macro_name = macro.get('name')
                if macro_name:
                    equipment_macro_names.add(macro_name)
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
                if comp_ref in equipment_macro_names:
                    equipment_ids_needed.add(ware_id)
        except Exception as e:
            print(f"      ⚠️ 读取 wares_final.xml 失败: {e}")
    print(f"   🎯 识别到 {len(equipment_ids_needed)} 个 equipment id 候选。")

    # 7.2 建立 SurfaceElements 索引
    surface_component_index = {}

    def scan_surface_to_index(root_path, source_key, pattern):
        for f in glob.glob(pattern, recursive=True):
            fname = os.path.splitext(os.path.basename(f))[0]
            if fname not in surface_component_index:
                surface_component_index[fname] = {}
            surface_component_index[fname][source_key] = f

    # 仅扫描精确目录，不递归子目录。
    surface_patterns = [
        os.path.join("assets", "props", "SurfaceElements", "*.xml"),
        os.path.join("assets", "props", "surfaceelements", "*.xml"),
    ]
    for pattern in surface_patterns:
        scan_surface_to_index(src, 'base', os.path.join(src, pattern))
    for dlc_id in dlc_order:
        p = os.path.join(src, "extensions", dlc_id)
        if os.path.exists(p):
            for pattern in surface_patterns:
                scan_surface_to_index(p, dlc_id, os.path.join(p, pattern))

    # 7.3 仅保留 tags 含 component 的 connection
    def should_keep_surface_connection(conn):
        tags = (conn.get('tags') or '').lower().split()
        return "component" in tags

    def clone_surface_component_with_filtered_connections(component):
        new_comp = etree.Element('component')
        for attr, value in component.attrib.items():
            new_comp.set(attr, value)
        connections = component.find('connections')
        if connections is None:
            return None
        new_connections = etree.SubElement(new_comp, 'connections')
        kept = 0
        for conn in connections.findall('connection'):
            if not should_keep_surface_connection(conn):
                continue
            new_conn = etree.SubElement(new_connections, 'connection')
            for attr, value in conn.attrib.items():
                new_conn.set(attr, value)
            kept += 1
        return new_comp if kept > 0 else None

    surface_root = etree.Element('components')
    surface_processed = 0

    for equipment_id in equipment_ids_needed:
        if equipment_id not in surface_component_index:
            continue
        sources = surface_component_index[equipment_id]
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
                filtered = clone_surface_component_with_filtered_connections(root_node)
                if filtered is not None:
                    surface_root.append(filtered)
                    surface_processed += 1
            elif root_node.tag == 'components':
                for node in root_node.findall('component'):
                    filtered = clone_surface_component_with_filtered_connections(node)
                    if filtered is not None:
                        surface_root.append(filtered)
                        surface_processed += 1

    equipment_surface_path = os.path.join(lib_dest_dir, "equipment_surface.xml")
    etree.ElementTree(surface_root).write(
        equipment_surface_path,
        encoding='utf-8',
        xml_declaration=True,
        pretty_print=True
    )
    print(f"✅ 聚合完成: 写入 {surface_processed} 个组件定义到 equipment_surface.xml")

    print(f"✨ 全流程结束！资产已蒸馏至 {dest_root}")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n程序终止: {e}")
        sys.exit(1)
