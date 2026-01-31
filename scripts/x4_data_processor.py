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
        self.race_consumption = {}  # 种群消耗速率 (每人每秒)
        
        # 收集需要翻译的原始名称 (Raw Key)
        self.needed_raw_names = set()

        if not os.path.exists(self.raw_path):
            print(f"❌ 错误: 找不到解包目录: {self.raw_path}")
            sys.exit(1)

    # =======================================================
    # 1. 构建数据库 (Wares)
    # =======================================================
    def build_database(self):
        print(f"📖 [1/5] 解析 wares.xml...")
        wares_path = os.path.join(self.raw_path, "libraries", "wares_final.xml")
        try:
            tree = ET.parse(wares_path)
            root = tree.getroot()
            count = 0
            
            for ware in root.findall('ware'):
                w_id = ware.get('id')
                tags = ware.get('tags', '')
                transport = ware.get('transport')
                raw_name = ware.get('name', '')
                
                # 提取配方
                for prod in ware.findall('production'):
                    method = prod.get('method', 'default')
                    bonus = 0.0
                    eff_node = prod.find("./effects/effect[@type='work']")
                    if eff_node is not None:
                        bonus = float(eff_node.get('product', 0))

                    recipe = {
                        "time": float(prod.get('time', 1)),
                        "amount": float(prod.get('amount', 1)),
                        "bonus": bonus,
                        "inputs": {r.get('ware'): float(r.get('amount')) for r in prod.findall('primary/ware')}
                    }
                    self.recipes.setdefault(w_id, {})[method] = recipe

                # 筛选逻辑
                is_valid = False
                
                # C. 工人消耗 (Food/Medical)
                if transport == 'workunit' and w_id == 'workunit_busy':
                    for prod in ware.findall('production'):
                        method = prod.get('method', 'default')
                        p_time = float(prod.get('time', 600))
                        p_amount = float(prod.get('amount', 200))
                        consumables = {}
                        for r in prod.findall('primary/ware'):
                            c_ware = r.get('ware')
                            c_amount = float(r.get('amount'))
                            # 计算每人每秒消耗量
                            consumables[c_ware] = c_amount / (p_amount * p_time)
                        self.race_consumption[method] = consumables

                # A. 商品
                if transport in {'container', 'solid', 'liquid'} and 'module' not in tags:
                    p_node = ware.find('price')
                    if p_node is not None:
                        is_valid = True
                        self.wares_data.append({
                            "id": w_id, 
                            "nameId": raw_name, # 原始引用 Key
                            "name": raw_name,   # ⚠️ 占位，稍后注入英文
                            "transport": transport,
                            "price": int(p_node.get('average') or 0),
                            "minPrice": int(p_node.get('min') or 0),
                            "maxPrice": int(p_node.get('max') or 0)
                        })

                # B. 模块
                if 'module' in tags:
                    comp = ware.find('component')
                    if comp is not None and comp.get('ref'):
                        ref = comp.get('ref')
                        m_prod = ware.find("./production[@method='default']")
                        is_valid = True
                        self.valid_macros[ref] = {
                            "module_ware_id": w_id, 
                            "name_id": raw_name, 
                            "build_cost": {r.get('ware'): int(r.get('amount')) for r in m_prod.findall('primary/ware')} if m_prod is not None else {},
                            "build_time": float(m_prod.get('time', 0)) if m_prod is not None else 0
                        }

                if is_valid and raw_name:
                    self.needed_raw_names.add(raw_name)
                    count += 1
                    
            self.needed_raw_names.add("{20102,2011}")
            print(f"   ✅ 从 {count} 个物品中收集到 {len(self.needed_raw_names)} 个原始 Key。")

        except Exception as e: print(f"   ❌ XML Error: {e}")

    # =======================================================
    # 2. 扫描资产 (Assets)
    # =======================================================
    def scan_assets(self):
        print(f"🔍 [2/5] 扫描资产并注入 cycleTime (含 DLC)...")
        # 基础游戏资产
        files = glob.glob(os.path.join(self.raw_path, "assets", "structures", "**", "*.xml"), recursive=True)
        # 增加对 DLC (extensions) 的支持
        files.extend(glob.glob(os.path.join(self.raw_path, "extensions", "*", "assets", "structures", "**", "*.xml"), recursive=True))
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

                    # 提取建筑种族属性 (主要用于 Habitation)
                    module_race = "generic"
                    if wf_node is not None and wf_node.get('race'):
                        module_race = wf_node.get('race')

                    module_data = {
                        "id": fname, "wareId": info['module_ware_id'], 
                        "nameId": info['name_id'], 
                        "name": info['name_id'], 
                        "type": m_class, "race": module_race,
                        "buildTime": info['build_time'], "buildCost": info['build_cost'],
                        "cycleTime": 0,
                        "workforce": { "capacity": wf_cap, "needed": wf_val, "maxBonus": 0 },
                        "outputs": {}, "inputs": {}
                    }
                    # 临时记录来源用于日志，不存入最终对象
                    module_data['_tmp_src'] = f

                    if m_class == 'production':
                        prod_tag = macro.find('properties/production')
                        if prod_tag is not None:
                            p_id = prod_tag.get('wares')
                            recipe = self.recipes.get(p_id, {}).get('default')
                            if recipe:
                                factor = 3600 / recipe['time']
                                module_data["cycleTime"] = recipe['time']
                                module_data["outputs"] = { p_id: round(recipe['amount'] * factor, 2) }
                                module_data["inputs"] = { k: round(v * factor, 2) for k, v in recipe['inputs'].items() }
                                module_data["workforce"]["maxBonus"] = recipe['bonus']
                    
                    if m_class == 'storage':
                        cargo = macro.find('properties/cargo')
                        if cargo is not None: module_data['capacity'] = int(cargo.get('max', 0))

                    self.all_modules.append(module_data)
                except: pass

        # 统计各文件贡献数量并清理临时字段
        source_stats = {}
        for mod in self.all_modules:
            src_path = mod.pop('_tmp_src', 'unknown')
            src_rel = os.path.relpath(src_path, self.raw_path)
            source_stats[src_rel] = source_stats.get(src_rel, 0) + 1
        
        print(f"   ✅ 扫描完成: 覆盖 {len(source_stats)} 个资产文件")
        for src, count in sorted(source_stats.items(), key=lambda x: x[1], reverse=True):
            print(f"     └─ {src}: {count} 个模块")

    # =======================================================
    # 3. 语言提取 (Backend Translation)
    # =======================================================
    def extract_and_resolve_languages(self):
        print(f"\n🌍 [3/5] 构建翻译数据库...")
        t_path = os.path.join(self.raw_path, "t")
        
        for x4_id, conf in X4_LANG_CONFIG.items():
            iso = conf['iso']
            self.i18n_data[iso] = {}
            target_name = f"0001-L{x4_id}.xml" 
            t_file = os.path.join(t_path, target_name)
            
            # A. 加载查找表
            current_lang_db = {}
            def load_xml(path):
                if os.path.exists(path):
                    try:
                        tree = ET.parse(path)
                        root = tree.getroot()
                        for page in root.findall('page'):
                            p_id = page.get('id')
                            if not p_id: continue
                            if p_id not in current_lang_db: current_lang_db[p_id] = {}
                            for t in page.findall('t'):
                                current_lang_db[p_id][t.get('id')] = "".join(t.itertext())
                        return True
                    except: return False
                return False

            has_file = load_xml(t_file)
            if not has_file and x4_id == '044':
                load_xml(os.path.join(t_path, "0001.xml"))

            if not current_lang_db: continue

            # B. 递归清洗
            resolved_count = 0
            for raw_name in self.needed_raw_names:
                final_text = self._resolve_name(raw_name, current_lang_db)
                if final_text:
                    self.i18n_data[iso][raw_name] = final_text
                    resolved_count += 1
            
            print(f"  ✅ [Done]  {iso:6} ({x4_id}) -> {resolved_count} 条")

    def _resolve_name(self, raw_name, lang_db, depth=0):
        if not raw_name or depth > 5: return raw_name
        text = re.sub(r"\([^)]*\)", "", raw_name)
        def replace_callback(match):
            page, tid = match.group(1), match.group(2)
            if page in lang_db and tid in lang_db[page]:
                return self._resolve_name(lang_db[page][tid], lang_db, depth + 1)
            return match.group(0)
        text = re.sub(r"\{\s*(\d+)\s*,\s*(\d+)\s*\}", replace_callback, text)
        return re.sub(r"\s+", " ", text).strip()

    # =======================================================
    # 🆕 4. 注入英文名称到数据对象
    # =======================================================
    def inject_english_names(self):
        print(f"\n💉 [4/5] 将英文结果注入 name 字段...")
        
        # 获取英文数据，如果没生成则为空
        en_map = self.i18n_data.get('en', {})
        
        if not en_map:
            print("   ⚠️ 警告: 未找到 'en' 语言包，name 字段将保持原始ID。")
            return

        # 更新商品数据
        count_wares = 0
        for item in self.wares_data:
            raw_key = item['nameId']
            if raw_key in en_map:
                item['name'] = en_map[raw_key]
                count_wares += 1
        
        # 更新模块数据
        count_mods = 0
        for item in self.all_modules:
            raw_key = item['nameId']
            if raw_key in en_map:
                item['name'] = en_map[raw_key]
                count_mods += 1

        print(f"   ✅ 更新了 {count_wares} 个商品和 {count_mods} 个模块的英文名称。")

    # =======================================================
    # 5. 保存结果
    # =======================================================
    def save(self):
        print(f"\n💾 [5/5] 保存结果...")
        data_dir = os.path.join(self.output_root, "data")
        locales_dir = os.path.join(self.output_root, "locales")
        
        if not os.path.exists(data_dir): os.makedirs(data_dir)
        if not os.path.exists(locales_dir): os.makedirs(locales_dir)

        # 保存数据 (此时 data 对象里已经有了正确的 name 字段)
        with open(os.path.join(data_dir, "modules.json"), 'w', encoding='utf-8') as f:
            json.dump(self.all_modules, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "wares.json"), 'w', encoding='utf-8') as f:
            json.dump(self.wares_data, f, indent=2, ensure_ascii=False)
        with open(os.path.join(data_dir, "consumption.json"), 'w', encoding='utf-8') as f:
            json.dump(self.race_consumption, f, indent=2, ensure_ascii=False)

        # 保存语言包
        available_languages = []
        for x4_id, conf in X4_LANG_CONFIG.items():
            iso = conf['iso']
            if iso in self.i18n_data and len(self.i18n_data[iso]) > 0:
                with open(os.path.join(locales_dir, f"{iso}.json"), 'w', encoding='utf-8') as f:
                    json.dump(dict(sorted(self.i18n_data[iso].items())), f, indent=2, ensure_ascii=False)
                available_languages.append({"code": iso, "name": conf['name'], "x4_id": x4_id})

        with open(os.path.join(data_dir, "languages.json"), 'w', encoding='utf-8') as f:
            json.dump(available_languages, f, indent=2, ensure_ascii=False)
            
        print("🎉 全部完成！")

if __name__ == "__main__":
    loader = X4PrecisionLoader(X4_UNPACKED_DATA_PATH, OUTPUT_VERSION_DIR)
    loader.build_database()
    loader.scan_assets()
    loader.extract_and_resolve_languages()
    loader.inject_english_names() # 新增步骤
    loader.save()