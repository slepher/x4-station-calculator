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

    # --- 步骤 2: 拷贝核心库文件到目标目录 ---
    # 先把基础的 wares.xml 拷贝过去，作为后续合并的基准
    print("📂 [2/4] 正在拷贝基础定义文件...")
    lib_dest_dir = os.path.join(dest_root, "libraries")
    os.makedirs(lib_dest_dir, exist_ok=True)
    
    base_wares_src = os.path.join(src, "libraries", "wares.xml")
    if os.path.exists(base_wares_src):
        shutil.copy2(base_wares_src, os.path.join(lib_dest_dir, "wares.xml"))
        print("   ✅ 基础 wares.xml 已就位。")

    # --- 步骤 3: 提取资产宏 (Macros) ---
    print("🔍 [3/4] 正在同步资产宏文件...")
    patterns = [
        os.path.join("assets", "structures", "**", "*.xml"),
        os.path.join("extensions", "*", "assets", "structures", "**", "*.xml"),
        os.path.join("extensions", "*", "libraries", "wares.xml")
    ]
    for p in patterns:
        for f in glob.glob(os.path.join(src, p), recursive=True):
            rel = os.path.relpath(f, src)
            # 保持目录结构，拷贝到目标目录
            target = os.path.join(dest_root, rel)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            shutil.copy2(f, target)
    print("✅ 物理拷贝完成。")

    # --- 步骤 4: 在目标目录的基础上进行 DLC 合并 ---
    print(f"\n🔗 [4/4] 正在基于目标目录文件执行 Apply_Patch 合并...")
    
    # 注意：这里的 base_wares 指向的是 DEST 里的文件
    target_wares_path = os.path.join(lib_dest_dir, "wares.xml")
    final_output_path = os.path.join(lib_dest_dir, "wares_final.xml")
    
    parser = etree.XMLParser(remove_blank_text=True)
    base_tree = etree.parse(target_wares_path, parser)
    
    dlc_order = v_config.get('dlc_order', [])
    for dlc_id in dlc_order:
        # 补丁现在从已拷贝的目标目录 DEST 中寻找
        patch_path = os.path.join(dest_root, "extensions", dlc_id, "libraries", "wares.xml")
        if os.path.exists(patch_path):
            print(f"      [+] 注入补丁层: {dlc_id}")
            patch_tree = etree.parse(patch_path, parser)
            xml_diff.Apply_Patch(base_tree.getroot(), patch_tree.getroot())

    # 将合并后的树写入 wares_final.xml
    base_tree.write(final_output_path, encoding='utf-8', xml_declaration=True, pretty_print=True)
    print(f"✨ 全流程结束！wares_final.xml 已在目标目录生成。")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n程序终止: {e}")
        sys.exit(1)