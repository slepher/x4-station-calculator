import os
import sys
from lxml import etree

# 1. 配置路径 (请根据你的实际情况修改)
CUSTOMIZER_PATH = r'D:\Documents\project\X4_Customizer'  # X4 Customizer 源码所在目录
DATA_ROOT = r'D:\Documents\project\x4tools\x4data'        # 你解压后的数据根目录
OUTPUT_FILE = r'D:\Documents\project\x4tools\x4data\libraries\wares_final.xml'

# 将 Customizer 加入 Python 路径以便导入其模块
if CUSTOMIZER_PATH not in sys.path:
    sys.path.append(CUSTOMIZER_PATH)
    
from Framework import File_Manager
XML_Diff = File_Manager.XML_Diff

def safe_merge_wares(data_root, output_path):
    # 1. 强制使用清理空白的解析器，防止 pretty_print 失败
    parser = etree.XMLParser(remove_blank_text=True)
    
    # 加载本体
    base_path = os.path.join(data_root, 'libraries', 'wares.xml')
    if not os.path.exists(base_path):
        raise FileNotFoundError(f"Base wares.xml not found at {base_path}")

    print(f"Loading base: {base_path}")
    base_tree = etree.parse(base_path, parser)
    
    # 定义必须按顺序合并的 DLC
    # 顺序：Split -> Terran -> Pirates -> Boron -> Timelines
    dlc_list = ['ego_dlc_split', 'ego_dlc_terran', 'ego_dlc_pirate', 'ego_dlc_boron', 'ego_dlc_timelines', 'ego_dlc_mini_01', 'ego_dlc_mini_02']
    
    for dlc in dlc_list:
        patch_path = os.path.join(data_root, 'extensions', dlc, 'libraries', 'wares.xml')
        if os.path.exists(patch_path):
            print(f"Applying patch from {dlc}...")
            patch_tree = etree.parse(patch_path, parser)
            # 直接调用底层的 Apply，避免 Framework 环境干扰
            XML_Diff.Apply_Patch(base_tree.getroot(), patch_tree.getroot())

    
    # 2. 最后统一缩进
    etree.indent(base_tree, space="  ")
    
    # 3. 写入文件
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    base_tree.write(output_path, encoding='utf-8', xml_declaration=True, pretty_print=True)
    print(f"Success! Saved to {output_path}")

# 执行
safe_merge_wares(DATA_ROOT, OUTPUT_FILE)