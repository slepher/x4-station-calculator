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

X4_LANG_CONFIG = {
    '044': {'iso': 'en',    'name': 'English'},
    '086': {'iso': 'zh-CN', 'name': '简体中文'},
    '088': {'iso': 'zh-TW', 'name': '繁體中文'},
    '049': {'iso': 'de',    'name': 'Deutsch'},
    '033': {'iso': 'fr',    'name': 'Français'},
    '039': {'iso': 'it',    'name': 'Italiano'},
    '034': {'iso': 'es',    'name': 'Español'},
    '007': {'iso': 'ru',    'name': 'Русский'},
    '081': {'iso': 'ja',    'name': '日本語'},
    '082': {'iso': 'ko',    'name': '한국어'},
    '055': {'iso': 'pt-BR', 'name': 'Português (Brasil)'},
    '048': {'iso': 'pl',    'name': 'Polski'}
}

# =============================================================================

class X4PrecisionLoader:
    def __init__(self, raw_data_path, output_root):
        self.raw_path = raw_data_path
        self.output_root = output_root
        self.valid_macros = {}       
        self.all_modules = []        
        self.wares_data = []         
        self.i18n_data = {}         
        self.recipes = {} 
        
        if not os.path.exists(self.raw_path):
            print(f"❌ 错误: 找不到解包目录: {self.raw_path}")
            sys.exit(1)

    def build_database(self):
        print(f"📖 [1/4] 解析 wares.xml 并记录生产周期...")
        wares_path = os.path.join(self.raw_path, "libraries", "wares.xml")
        try:
            tree = ET.parse(wares_path)
            root = tree.getroot()
            for ware in root.findall('ware'):
                w_id = ware.get('id')
                tags = ware.get('tags', '')
                transport = ware.get('transport')
                
                # 提取生产配方、效率加成以及原始生产周期
                for prod in ware.findall('production'):
                    method = prod.get('method', 'default')
                    bonus = 0.0
                    eff_node = prod.find("./effects/effect[@type='work']")
                    if eff_node is not None:
                        bonus = float(eff_node.get('product', 0))

                    recipe = {
                        "time": float(prod.get('time', 1)), # 原始生产周期 (秒)
                        "amount": float(prod.get('amount', 1)),
                        "bonus": bonus,
                        "inputs": {r.get('ware'): float(r.get('amount')) for r in prod.findall('primary/ware')}
                    }
                    self.recipes.setdefault(w_id, {})[method] = recipe

                # 保存细化价格
                if transport in {'container', 'solid', 'liquid'} and 'module' not in tags:
                    p_node = ware.find('price')
                    if p_node is not None:
                        self.wares_data.append({
                            "id": w_id, "nameId": ware.get('name'), "transport": transport,
                            "price": int(p_node.get('average') or 0),
                            "minPrice": int(p_node.get('min') or 0),
                            "maxPrice": int(p_node.get('max') or 0)
                        })

                if 'module' in tags:
                    comp = ware.find('component')
                    if comp is not None and comp.get('ref'):
                        ref = comp.get('ref')
                        m_prod = ware.find("./production[@method='default']")
                        self.valid_macros[ref] = {
                            "module_ware_id": w_id, "name_id": ware.get('name'), 
                            "build_cost": {r.get('ware'): int(r.get('amount')) for r in m_prod.findall('primary/ware')} if m_prod is not None else {},
                            "build_time": float(m_prod.get('time', 0)) if m_prod is not None else 0
                        }
        except Exception as e: print(f"XML Error: {e}")

    def scan_assets(self):
        print(f"🔍 [2/4] 扫描资产并注入 cycleTime...")
        files = glob.glob(os.path.join(self.raw_path, "assets", "structures", "**", "*.xml"), recursive=True)
        for f in files:
            fname = os.path.splitext(os.path.basename(f))[0]
            if fname in self.valid_macros:
                try:
                    tree = ET.parse(f)
                    root = tree.getroot()
                    macro = root if root.tag=='macro' else root.find(f".//macro[@name='{fname}']")
                    if macro is None: continue
                    
                    m_class = macro.get('class')
                    info = self.valid_macros[fname]
                    
                    wf_node = macro.find('properties/workforce')
                    wf_val = int(wf_node.get('max') or wf_node.get('amount') or 0) if wf_node is not None else 0
                    wf_cap = int(wf_node.get('capacity') or 0) if wf_node is not None else 0

                    module_data = {
                        "id": fname, "wareId": info['module_ware_id'], "nameId": info['name_id'],
                        "type": m_class, "race": "generic",
                        "buildTime": info['build_time'], "buildCost": info['build_cost'],
                        "cycleTime": 0, # 新增字段：单次生产周期 (秒)
                        "workforce": { "capacity": wf_cap, "needed": wf_val, "maxBonus": 0 },
                        "outputs": {}, "inputs": {}
                    }

                    if m_class == 'production':
                        prod_tag = macro.find('properties/production')
                        if prod_tag is not None:
                            p_id = prod_tag.get('wares')
                            recipe = self.recipes.get(p_id, {}).get('default')
                            if recipe:
                                factor = 3600 / recipe['time']
                                module_data["cycleTime"] = recipe['time'] # 注入生产周期
                                module_data["outputs"] = { p_id: round(recipe['amount'] * factor, 2) }
                                module_data["inputs"] = { k: round(v * factor, 2) for k, v in recipe['inputs'].items() }
                                module_data["workforce"]["maxBonus"] = recipe['bonus']
                    
                    if m_class == 'storage':
                        cargo = macro.find('properties/cargo')
                        if cargo is not None: module_data['capacity'] = int(cargo.get('max', 0))

                    self.all_modules.append(module_data)
                except: pass

    def extract_languages(self):
        print(f"\n🌍 [3/4] 语言提取状态:")
        t_path = os.path.join(self.raw_path, "t")
        all_data_str = json.dumps(self.wares_data) + json.dumps(self.all_modules)
        required_keys = {f"{{{p},{t}}}" for p, t in re.findall(r"\{(\d+),\s*(\d+)\}", all_data_str)}
        required_keys.add("{20102,2011}")  # 保留占位符
        for x4_id, conf in X4_LANG_CONFIG.items():
            iso = conf['iso']
            self.i18n_data[iso] = {}
            # 完全回滚逻辑：不加 if 判断
            target_name = f"0001-L{x4_id}.xml" 
            t_file = os.path.join(t_path, target_name)
            
            if os.path.exists(t_file):
                try:
                    tree = ET.parse(t_file)
                    root = tree.getroot()
                    loaded = 0
                    for page in root.findall('page'):
                        p_id = page.get('id')
                        for t in page.findall('t'):
                            key = f"{{{p_id},{t.get('id')}}}"
                            if key in required_keys: 
                                self.i18n_data[iso][key] = "".join(t.itertext())
                                loaded += 1
                    print(f"  ✅ [Found] {iso:6} ({x4_id}) -> 已加载 {loaded} 条")
                except: pass
            else:
                print(f"  🚫 [Miss]  {iso:6} ({x4_id}) -> 找不到文件: {t_file}")

    def save(self):
        print(f"\n💾 [4/4] 保存结果...")
        data_dir = os.path.join(self.output_root, "data")
        locales_dir = os.path.join(self.output_root, "locales")
        os.makedirs(data_dir, exist_ok=True); os.makedirs(locales_dir, exist_ok=True)

        with open(os.path.join(data_dir, "modules.json"), 'w', encoding='utf-8') as f:
            json.dump(self.all_modules, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "wares.json"), 'w', encoding='utf-8') as f:
            json.dump(self.wares_data, f, indent=2, ensure_ascii=False)

        available_languages = []
        for x4_id, conf in X4_LANG_CONFIG.items():
            iso = conf['iso']
            if iso in self.i18n_data and len(self.i18n_data[iso]) > 0:
                with open(os.path.join(locales_dir, f"{iso}.json"), 'w', encoding='utf-8') as f:
                    json.dump(dict(sorted(self.i18n_data[iso].items())), f, indent=2, ensure_ascii=False)
                available_languages.append({"code": iso, "name": conf['name'], "x4_id": x4_id})

        with open(os.path.join(data_dir, "languages.json"), 'w', encoding='utf-8') as f:
            json.dump(available_languages, f, indent=2, ensure_ascii=False)
        print("🎉 任务完成！")

if __name__ == "__main__":
    loader = X4PrecisionLoader(X4_UNPACKED_DATA_PATH, OUTPUT_VERSION_DIR)
    loader.build_database(); loader.scan_assets(); loader.extract_languages(); loader.save()