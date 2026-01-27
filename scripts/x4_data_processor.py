import os
import xml.etree.ElementTree as ET
import json
import glob
import sys
import re

# =============================================================================
# ⚙️ 项目配置
# =============================================================================
X4_UNPACKED_DATA_PATH = r"D:\Documents\project\x4tools\x4data"
OUTPUT_VERSION_DIR = r"D:\Documents\project\x4-station-calculator\src\assets\game_data\Timelines (7.10)"

# 升级：包含显示名称的语言配置
# ISO代码将作为前端文件名，Name用于UI显示
X4_LANG_CONFIG = {
    '044': {'iso': 'en',    'name': 'English'},
    '049': {'iso': 'de',    'name': 'Deutsch'},
    '033': {'iso': 'fr',    'name': 'Français'},
    '039': {'iso': 'it',    'name': 'Italiano'},
    '034': {'iso': 'es',    'name': 'Español'},
    '007': {'iso': 'ru',    'name': 'Русский'},
    '081': {'iso': 'ja',    'name': '日本語'},
    '082': {'iso': 'ko',    'name': '한국어'},
    '086': {'iso': 'zh-CN', 'name': '简体中文'},
    '088': {'iso': 'zh-TW', 'name': '繁體中文'},
    '055': {'iso': 'pt-BR', 'name': 'Português (Brasil)'},
    '048': {'iso': 'pl',    'name': 'Polski'}
}

# =============================================================================

class X4PrecisionLoader:
    def __init__(self, raw_data_path, output_root):
        self.raw_path = raw_data_path
        self.output_root = output_root
        
        # 数据容器
        self.valid_macros = {}       
        self.production_modules = [] 
        self.other_modules = []      
        self.wares_data = []         
        self.i18n_data = {}         
        
        # 路径检查
        if not os.path.exists(self.raw_path):
            print(f"❌ 错误: 找不到解包目录: {self.raw_path}")
            sys.exit(1)
        if not os.path.exists(self.output_root):
            os.makedirs(self.output_root)

    def _ensure_dir(self, file_path):
        os.makedirs(os.path.dirname(file_path), exist_ok=True)

    def _guess_race(self, macro_id):
        if "_ter_" in macro_id: return "terran"
        if "_bor_" in macro_id: return "boron"
        if "_tel_" in macro_id: return "teladi"
        if "_par_" in macro_id: return "paranid"
        if "_spl_" in macro_id: return "split"
        if "_arg_" in macro_id: return "argon"
        if "_xen_" in macro_id: return "xenon"
        if "_kha_" in macro_id: return "khaak"
        if "_pir_" in macro_id: return "pirate"
        return "generic"

    # =======================================================
    # 1. 建立白名单 (Wares)
    # =======================================================
    def build_whitelist(self):
        print(f"📖 [1/4] 读取 wares.xml...")
        wares_path = os.path.join(self.raw_path, "libraries", "wares.xml")
        try:
            tree = ET.parse(wares_path)
            root = tree.getroot()
            valid_transports = {'container', 'solid', 'liquid'}
            
            for ware in root.findall('ware'):
                w_id = ware.get('id')
                tags = ware.get('tags', '')
                transport = ware.get('transport')
                name_ref = ware.get('name', '')

                # 商品
                if transport in valid_transports:
                    price_node = ware.find('price')
                    self.wares_data.append({
                        "id": w_id, "name_id": name_ref, "transport": transport,
                        "volume": int(ware.get('volume', 1)),
                        "price_avg": int(price_node.get('average')) if price_node is not None else 0
                    })

                # 模块
                if 'module' in tags:
                    comp = ware.find('component')
                    if comp is not None:
                        ref = comp.get('ref')
                        if ref:
                            cost = []
                            time = 0
                            prod = ware.find("./production[@method='default']")
                            if prod is not None:
                                time = float(prod.get('time', 0))
                                p = prod.find('primary')
                                if p is not None:
                                    for r in p.findall('ware'):
                                        cost.append({"ware": r.get('ware'), "amount": int(r.get('amount'))})
                            
                            self.valid_macros[ref] = {
                                "module_ware_id": w_id, "name_id": name_ref, 
                                "build_cost": cost, "build_time": time
                            }
        except Exception as e:
            print(f"XML Error: {e}")

    # =======================================================
    # 2. 扫描模块 (Assets)
    # =======================================================
    def scan_assets(self):
        print(f"🔍 [2/4] 扫描 assets...")
        files = glob.glob(os.path.join(self.raw_path, "assets", "structures", "**", "*.xml"), recursive=True)
        for f in files:
            fname = os.path.splitext(os.path.basename(f))[0]
            if fname not in self.valid_macros: continue
            
            try:
                tree = ET.parse(f)
                root = tree.getroot()
                macro = root if root.tag=='macro' and root.get('name')==fname else root.find(f".//macro[@name='{fname}']")
                if macro is None: continue
                
                m_class = macro.get('class')
                wl = self.valid_macros[fname]
                base = {
                    "id": fname, "ware_id": wl['module_ware_id'], "name_id": wl['name_id'],
                    "type": m_class, "race": self._guess_race(fname),
                    "build_cost": wl['build_cost'], "build_time": wl['build_time']
                }
                
                if m_class == 'production':
                    prod = macro.find('properties/production')
                    if prod:
                        item = prod.find('queue/item')
                        t = float(item.get('time', 3600)) if item is not None else 3600
                        a = float(item.get('amount', 1)) if item is not None else 0
                        base.update({
                            "produces": prod.get('wares'), "cycle_time": t, "cycle_amount": a, 
                            "hourly_yield": round((3600/t)*a, 2) if t>0 else 0,
                            "workforce_needed": self._extract_workforce(macro)
                        })
                        self.production_modules.append(base)
                elif m_class in ['storage', 'habitation', 'dockingbay', 'pier', 'defencemodule']:
                    if m_class == 'storage' and macro.find('properties/cargo') is not None:
                        base['capacity'] = int(macro.find('properties/cargo').get('max', 0))
                        base['tags'] = macro.find('properties/cargo').get('tags')
                    elif m_class == 'habitation':
                        base['workforce_capacity'] = self._extract_workforce(macro)
                    self.other_modules.append(base)
            except: pass

    def _extract_workforce(self, node):
        wf = node.find('properties/workforce')
        if wf is not None:
            return int(wf.get('amount') or wf.get('capacity') or wf.get('id') or 0)
        return 0

    # =======================================================
    # 3. 语言提取 (Languages)
    # =======================================================
    def extract_filtered_languages(self):
        print(f"🌍 [3/4] 扫描语言文件...")
        t_path = os.path.join(self.raw_path, "t")
        
        if not os.path.exists(t_path):
            print(f"❌ 错误: 找不到 {t_path}")
            return

        # 1. 确定需要的 Key
        all_data_str = json.dumps(self.wares_data) + json.dumps(self.production_modules) + json.dumps(self.other_modules)
        found_keys = re.findall(r"\{(\d+),\s*(\d+)\}", all_data_str)
        required_keys = {f"{{{p},{t}}}" for p, t in found_keys}
        print(f"  -> 需提取 {len(required_keys)} 条文本。")

        # 2. 扫描文件
        files = glob.glob(os.path.join(t_path, "*.xml"))
        for f_path in files:
            fname = os.path.basename(f_path)
            # 匹配 0001-L044.xml 中的 044
            match = re.search(r"-L(\d+)", fname, re.IGNORECASE)
            # 兼容 0001.xml 为英文
            x4_id = "044" if fname == "0001.xml" else (match.group(1) if match else None)
            
            if not x4_id: continue

            # 查找配置
            lang_conf = X4_LANG_CONFIG.get(x4_id)
            if not lang_conf:
                # 如果不在配置表里，跳过 (或者你可以选择 generic 处理)
                continue
            
            iso_code = lang_conf['iso']
            if iso_code not in self.i18n_data: self.i18n_data[iso_code] = {}

            try:
                tree = ET.parse(f_path)
                root = tree.getroot()
                count = 0
                for page in root.findall('page'):
                    page_id = page.get('id')
                    if not page_id: continue
                    for t in page.findall('t'):
                        key = f"{{{page_id},{t.get('id')}}}"
                        if key in required_keys:
                            self.i18n_data[iso_code][key] = "".join(t.itertext())
                            count += 1
                if count > 0:
                    print(f"  -> {lang_conf['name']:<10} ({iso_code}): {count} 条")
            except: pass

    # =======================================================
    # 4. 保存结果 & 生成 languages.json
    # =======================================================
    def save(self):
        print(f"\n💾 [4/4] 保存结果...")
        data_dir = os.path.join(self.output_root, "data")
        locales_dir = os.path.join(self.output_root, "locales")
        self._ensure_dir(os.path.join(data_dir, "ph"))
        self._ensure_dir(os.path.join(locales_dir, "ph"))

        # 1. 保存实体数据
        with open(os.path.join(data_dir, "production_modules.json"), 'w', encoding='utf-8') as f:
            json.dump(self.production_modules, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "other_modules.json"), 'w', encoding='utf-8') as f:
            json.dump(self.other_modules, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "wares.json"), 'w', encoding='utf-8') as f:
            json.dump(self.wares_data, f, indent=2, ensure_ascii=False)

        # 2. 保存语言包 & 生成 languages.json
        available_languages = []
        
        # 遍历配置表，确保顺序 (例如英语在前)
        for x4_id, conf in X4_LANG_CONFIG.items():
            iso_code = conf['iso']
            
            # 只有当成功提取到数据时，才加入列表
            if iso_code in self.i18n_data and len(self.i18n_data[iso_code]) > 0:
                # 保存语言文件
                with open(os.path.join(locales_dir, f"{iso_code}.json"), 'w', encoding='utf-8') as f:
                    # 排序Key
                    json.dump(dict(sorted(self.i18n_data[iso_code].items())), f, indent=2, ensure_ascii=False)
                
                # 添加到可用列表
                available_languages.append({
                    "code": iso_code,
                    "name": conf['name'],
                    "x4_id": x4_id
                })

        # 3. 保存 languages.json
        with open(os.path.join(data_dir, "languages.json"), 'w', encoding='utf-8') as f:
            json.dump(available_languages, f, indent=2, ensure_ascii=False)
            
        print(f"  -> 数据文件保存完毕。")
        print(f"  -> languages.json 已生成 (包含 {len(available_languages)} 种语言)。")
        print("🎉 全部完成！")

if __name__ == "__main__":
    loader = X4PrecisionLoader(raw_data_path=X4_UNPACKED_DATA_PATH, output_root=OUTPUT_VERSION_DIR)
    loader.build_whitelist()
    loader.scan_assets()
    loader.extract_filtered_languages()
    loader.save()