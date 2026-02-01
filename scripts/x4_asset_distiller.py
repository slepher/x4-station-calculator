import os
import shutil
import glob
import json
import sys
from lxml import etree

def load_all_configs():
    """加载配置文件，若缺失则报错终止"""
    config_file = 'x4config.json'
    version_file = 'x4-version.config'
    
    if not os.path.exists(config_file):
        raise FileNotFoundError(f"❌ 错误: 找不到基础配置文件 '{config_file}'")
    if not os.path.exists(version_file):
        raise FileNotFoundError(f"❌ 错误: 找不到版本配置文件 '{version_file}'")

    with open(config_file, 'r', encoding='utf-8') as f:
        m_config = json.load(f)
    with open(version_file, 'r', encoding='utf-8') as f:
        v_config = json.load(f)
        
    return m_config, v_config

def setup_customizer(m_config):
    """从 X4_PATHS 提取并注入 Customizer 环境"""
    paths = m_config.get('X4_PATHS', {})
    customizer_path = paths.get('CUSTOMIZER_PATH')
    
    if not customizer_path:
        raise KeyError("❌ 错误: x4config.json 的 'X4_PATHS' 节点下缺少 'CUSTOMIZER_PATH'")
    
    if not os.path.exists(customizer_path):
        raise NotADirectoryError(f"❌ 错误: CUSTOMIZER_PATH 路径不存在: {customizer_path}")
    
    if customizer_path not in sys.path:
        sys.path.append(customizer_path)
    
    try:
        from Framework import File_Manager
        # 返回 XML_Diff 模块
        return File_Manager.XML_Diff
    except ImportError:
        raise ImportError(f"❌ 错误: 无法加载 Customizer 框架，请检查路径。")

def merge_wares_final_step(xml_diff, src_root, dlc_order, output_path):
    """最后执行：利用 Customizer 引擎 Apply_Patch 合并 wares.xml"""
    print(f"\n🔗 [步骤 4/4] 正在调用 Customizer.Apply_Patch 执行补丁运算...")
    
    parser = etree.XMLParser(remove_blank_text=True)
    base_wares = os.path.join(src_root, "libraries", "wares.xml")
    
    if not os.path.exists(base_wares):
        raise FileNotFoundError(f"❌ 错误: 源目录找不到基础 wares.xml: {base_wares}")

    base_tree = etree.parse(base_wares, parser)
    
    # 按照人工维护的 dlc_order 顺序正序叠加
    for dlc_id in dlc_order:
        patch_path = os.path.join(src_root, "extensions", dlc_id, "libraries", "wares.xml")
        if os.path.exists(patch_path):
            print(f"      [+] 应用补丁 (Apply_Patch): {dlc_id}")
            patch_tree = etree.parse(patch_path, parser)
            
            # 使用 Apply_Patch 处理标准的 <diff> 补丁逻辑
            xml_diff.Apply_Patch(base_tree.getroot(), patch_tree.getroot())

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    base_tree.write(output_path, encoding='utf-8', xml_declaration=True, pretty_print=True)
    print(f"✅ 最终 wares_final.xml 生成成功。")

def main():
    # 1. 初始化
    m_config, v_config = load_all_configs()
    paths = m_config['X4_PATHS']
    xml_diff = setup_customizer(m_config)

    src = paths['SOURCE']
    # 此时读取 v-config 的小写 key: folder_name
    dest_root = os.path.join(paths['DEST'], v_config['folder_name'])

    print(f"🧪 开始资产蒸馏任务: {v_config['folder_name']}")
    
    if os.path.exists(dest_root):
        shutil.rmtree(dest_root)
    os.makedirs(dest_root, exist_ok=True)

    # --- 步骤 1: 语言包全量同步 ---
    src_t = os.path.join(src, "t")
    if os.path.exists(src_t):
        shutil.copytree(src_t, os.path.join(dest_root, "t"))
        print("✅ [步骤 1/4] 语言包同步完成。")

    # --- 步骤 2: 提取资产宏 (Macros) ---
    print("🔍 [步骤 2/4] 正在提取资产宏 (Macros)...")
    patterns = [
        os.path.join("assets", "structures", "**", "macros", "*.xml"),
        os.path.join("extensions", "*", "assets", "structures", "**", "macros", "*.xml")
    ]
    
    count = 0
    for p in patterns:
        for f in glob.glob(os.path.join(src, p), recursive=True):
            rel = os.path.relpath(f, src)
            target = os.path.join(dest_root, rel)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            shutil.copy2(f, target)
            count += 1
    print(f"✅ 提取完成，共处理 {count} 个资产文件。")

    # --- 步骤 3: 目录准备 ---
    os.makedirs(os.path.join(dest_root, "libraries"), exist_ok=True)

    # --- 步骤 4: 执行 wares.xml 合并 (使用 Apply_Patch) ---
    final_wares_path = os.path.join(dest_root, "libraries", "wares_final.xml")
    # 读取小写 key: dlc_order
    dlc_order = v_config.get('dlc_order', [])
    merge_wares_final_step(xml_diff, src, dlc_order, final_wares_path)

    print(f"\n✨ 蒸馏与补丁全流程结束！输出至: {dest_root}")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n程序终止: {e}")
        sys.exit(1)