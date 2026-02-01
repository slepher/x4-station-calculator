import os
import shutil
import glob
import json
import sys
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
        from Framework import File_Manager
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
        print("✅ [1/4] 语言包已拷贝。")

    # --- 步骤 2: 处理核心库文件 (wares & waregroups) ---
    print("📂 [2/4] 正在处理核心库文件 (Wares & Waregroups)...")
    lib_dest_dir = os.path.join(dest_root, "libraries")
    os.makedirs(lib_dest_dir, exist_ok=True)

    lib_files = ['wares.xml', 'waregroups.xml']
    parser = etree.XMLParser(remove_blank_text=True)
    dlc_order = v_config.get('dlc_order', [])

    for lib_file in lib_files:
        print(f"   🔨 处理 {lib_file} ...")
        # 1. 拷贝 Base
        base_src = os.path.join(src, "libraries", lib_file)
        target_path = os.path.join(lib_dest_dir, lib_file)
        
        if os.path.exists(base_src):
            shutil.copy2(base_src, target_path)
        else:
            print(f"      ⚠️ Base 文件不存在: {base_src}")
            continue

        # 2. 合并 DLC Patch
        base_tree = etree.parse(target_path, parser)
        for dlc_id in dlc_order:
            # Patch 位于 SOURCE 目录的 extensions 中
            patch_path = os.path.join(src, "extensions", dlc_id, "libraries", lib_file)
            if os.path.exists(patch_path):
                print(f"      [+] 注入补丁 ({dlc_id})")
                try:
                    patch_tree = etree.parse(patch_path, parser)
                    xml_diff.Apply_Patch(base_tree.getroot(), patch_tree.getroot())
                except Exception as e:
                    print(f"      ⚠️ 警告: 补丁失败 {dlc_id}: {e}")
        
        # 3. 写入 Final
        final_output_path = os.path.join(lib_dest_dir, lib_file.replace('.xml', '_final.xml'))
        base_tree.write(final_output_path, encoding='utf-8', xml_declaration=True, pretty_print=True)
        print(f"      ✨ 生成: {os.path.basename(final_output_path)}")

    # --- 步骤 3: 聚合宏定义 (Macros) ---
    print("∑ [3/4] 正在聚合空间站宏定义 (macros_final.xml)...")
    
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
    macros_final_path = os.path.join(lib_dest_dir, "macros_final.xml")
    etree.ElementTree(macros_root).write(macros_final_path, encoding='utf-8', xml_declaration=True, pretty_print=True)
    print(f"✅ 聚合完成: 写入 {processed_count} 个宏定义到 macros_final.xml")

    print(f"✨ 全流程结束！资产已蒸馏至 {dest_root}")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n程序终止: {e}")
        sys.exit(1)