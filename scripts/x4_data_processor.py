import os
import xml.etree.ElementTree as ET
import json
import glob
import sys
import re
from collections import defaultdict

# =============================================================================
# ⚙️ 项目配置
# =============================================================================
config_file = 'x4-station-calculator.config.json'
if not os.path.exists(config_file):
    print("" + "!" * 60)
    print(f"❌ 错误: 找不到配置文件 '{config_file}'")
    print("!" * 60 + "")
    sys.exit(1)

with open(config_file, 'r', encoding='utf-8') as f:
    _config = json.load(f)

# 考虑 distiller 生成的版本号子目录
X4_UNPACKED_DATA_PATH = os.path.join(_config['raw_assets_dir'], _config['folder_name'])
OUTPUT_VERSION_DIR = os.path.join(_config['processed_assets_dir'], _config['folder_name'])

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

SPECIAL_TYPE_MAPPING = {
    'moduletypes_processing': 'processingmodule',
    'moduletypes_venture': 'ventureplatform'
}

# =============================================================================

class X4PrecisionLoader:
    def __init__(self, raw_data_path, output_root, config):
        self.raw_path = raw_data_path
        self.output_root = output_root
        self.config = config
        
        self.valid_macros = {}       
        self.all_modules = []        
        self.wares_data = []         
        self.i18n_data = {}         
        self.recipes = {} 
        self.race_consumption = {}  # 种群消耗速率 (每人每秒)
        self.module_groups_result = []  # 模块分组结果 (合并 types 和 waregroups)
        self.ware_tier_map = {}     # 缓存物品层级映射
        self.all_methods = set()
        self.colors_db = {}
        self.mappings_db = {}
        
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
        # 从配置中提取模块类型原始 Key
        for raw_key in self.config.get('module_types', {}).values():
            self.needed_raw_names.add(raw_key)
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
                group = ware.get('group', '')
                
                # 手动修正: BoGas 在游戏数据中被归类为 refined，但实际属于 agricultural
                if w_id == 'bogas':
                    group = 'agricultural'
                
                # 提取配方
                for prod in ware.findall('production'):
                    method = prod.get('method', 'default')
                    self.all_methods.add(method)
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
                    volume = int(ware.get('volume') or 0)
                    if p_node is not None:
                        is_valid = True
                        self.wares_data.append({
                            "id": w_id, 
                            "nameId": raw_name, # 原始引用 Key
                            "group": group,
                            "name": raw_name,   # ⚠️ 占位，稍后注入英文
                            "transport": transport,
                            "price": int(p_node.get('average') or 0),
                            "volume": volume,
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
            
            # 计算 Tier 层级 
            self._calculate_tiers()
            # 注入 Tier 到 wares_data 
            for item in self.wares_data:
                item['tier'] = self.ware_tier_map.get(item['id'], 0)
                
            print(f"   ℹ️  发现生产方式: {sorted(list(self.all_methods))}")

        except Exception as e: print(f"   ❌ XML Error: {e}")

    # =======================================================
    # 1.1 计算物品生产层级 (Tier)
    # =======================================================
    def _calculate_tiers(self):
        def get_tier(ware_id, visited=None):
            if visited is None: visited = set()
            if ware_id in self.ware_tier_map: return self.ware_tier_map[ware_id]
            if ware_id in visited: return 0  # 防止循环引用
            
            recipe_group = self.recipes.get(ware_id)
            if not recipe_group:
                self.ware_tier_map[ware_id] = 0
                return 0
            
            visited.add(ware_id)
            max_input_tier = -1
            for method, recipe in recipe_group.items():
                for input_id in recipe['inputs']:
                    max_input_tier = max(max_input_tier, get_tier(input_id, visited))
            
            tier = max_input_tier + 1 if max_input_tier >= 0 else 0
            self.ware_tier_map[ware_id] = tier
            return tier

        for ware in self.wares_data:
            get_tier(ware['id'])

    # =======================================================
    # 1.2 加载颜色库
    # =======================================================
    def load_colors(self):
        print(f"🎨 [1.2/5] 解析 colors_final.xml...")
        colors_path = os.path.join(self.raw_path, "libraries", "colors_final.xml")
        if not os.path.exists(colors_path):
            print(f"   ⚠️ 警告: 找不到颜色定义文件: {colors_path}")
            return 

        try:
            tree = ET.parse(colors_path)
            root = tree.getroot()
            
            # 1. 解析基础颜色定义 (RGBA -> Hex) 
            color_defs = {}
            for c in root.findall(".//colors/color"):
                c_id = c.get('id')
                r, g, b = int(c.get('r', 0)), int(c.get('g', 0)), int(c.get('b', 0))
                color_defs[c_id] = f"#{r:02X}{g:02X}{b:02X}"
            
            self.colors_db = color_defs
            # 2. 解析 Mapping 映射 
            self.mappings_db = {m.get('id'): m.get('ref') for m in root.findall(".//mappings/mapping")}
            print(f"   ✅ 加载了 {len(color_defs)} 个颜色定义和 {len(self.mappings_db)} 个映射。")
        except Exception as e:
            print(f"   ❌ Colors XML Error: {e}")

    def _get_module_colors(self, m_type, m_group=None):
        # 优先处理远征组逻辑 
        if m_group and 'venture' in m_group.lower(): 
            # 特殊映射处理 
            if 'dock' in m_type.lower(): m_type = 'venturedock' 
            elif 'connection' in m_type.lower(): m_type = 'ventureconnection' 
            else: m_type = 'ventureplatform' 

        # 内部映射逻辑: 模块类型 -> Holomap Mapping ID 
        type_to_mapping = {
            'production': 'holomap_component_production',
            'storage': 'holomap_component_storage',
            'habitation': 'holomap_component_habitation',
            'defencemodule': 'holomap_component_defence',
            'defense': 'holomap_component_defence',
            'dockarea': 'holomap_component_dockingbay',
            'pier': 'holomap_component_pier',
            'connectionmodule': 'holomap_component_connection',
            'processingmodule': 'holomap_component_processing',
            'ventureplatform': 'holomap_component_ventureplatform',
            'welfaremodule': 'holomap_component_welfare',
            'buildmodule': 'holomap_component_build',
            'radar': 'holomap_component_radar'
        }
        mapping_id = type_to_mapping.get(m_type, f"holomap_component_{m_type}")
        color_id = self.mappings_db.get(mapping_id, self.mappings_db.get('holomap_component_base', 'grey_160'))
        hex_color = self.colors_db.get(color_id, "#A0A0A0")
        return color_id, hex_color

    # =======================================================
    # 1.5 处理模块分组 (Module Groups - 合并 Waregroups 和 ModuleTypes)
    # =======================================================
    def process_module_groups(self):
        print(f"📦 [1.5/5] 解析 waregroups_final.xml 并合并配置...")
        wg_path = os.path.join(self.raw_path, "libraries", "waregroups_final.xml")
        
        # 1. 解析 XML 中的 Waregroups
        if os.path.exists(wg_path):
            try:
                tree = ET.parse(wg_path)
                root = tree.getroot()
                count = 0
                for group in root.findall('group'):
                    g_id = group.get('id')
                    g_name = group.get('name', '')
                    color_id, hex_color = self._get_module_colors("production", g_id)
                    # 忽略 icon, 只保留 id 和 name
                    self.module_groups_result.append({
                        "id": g_id,
                        "nameId": g_name,
                        "type": "production",
                        "name": g_name, # 占位
                        "color": color_id,
                        "color_rgb": hex_color
                    })
                    if g_name: self.needed_raw_names.add(g_name)
                    count += 1
                print(f"   ✅ 解析了 {count} 个商品组。")
            except Exception as e:
                print(f"   ❌ Waregroups XML Error: {e}")

        # 2. 合并配置文件中的 Module Types
        count_types = 0
        for m_type, raw_key in self.config.get('module_types', {}).items():
            color_id, hex_color = self._get_module_colors(m_type, m_type)
            # 避免重复 (如果配置里的 key 和 group id 冲突，优先保留 xml 的? 或者 append 即可，这里简单 append)
            self.module_groups_result.append({
                "id": m_type,
                "nameId": raw_key,
                "type": m_type,
                "name": raw_key, # 占位
                "color": color_id,
                "color_rgb": hex_color
            })
            if raw_key: self.needed_raw_names.add(raw_key)
            count_types += 1
        print(f"   ✅ 合并了 {count_types} 个基础模块类型配置。")


    # =======================================================
    # 2. 扫描资产 (Assets) -> 改为读取聚合库
    # =======================================================
    def scan_assets(self):
        print(f"🔍 [2/5] 从 macros_final.xml 读取宏定义...")
        macro_race_set = set()
        macro_method_set = set()
        unmapped_types = defaultdict(list)
        macros_path = os.path.join(self.raw_path, "libraries", "macros_final.xml")
        
        if not os.path.exists(macros_path):
            print(f"❌ 错误: 找不到宏定义文件: {macros_path}")
            sys.exit(1)

        try:
            tree = ET.parse(macros_path)
            root = tree.getroot()
            
            # Distiller 生成的 macros_final.xml 根节点为 <macros>，子节点为 <macro>
            # 不再需要 glob 扫描文件，直接遍历 XML 树
            
            count = 0
            # 遍历所有 macro 节点
            for macro in root.findall('macro'):
                fname = macro.get('name')
                
                # 过滤：只处理我们在 wares.xml 中识别到的模块
                if fname not in self.valid_macros:
                    continue
                    
                m_class = macro.get('class')
                info = self.valid_macros[fname]
                
                # Check build availability
                build_node = macro.find('properties/build')
                is_player_bp = (build_node is not None)
                
                wf_node = macro.find('properties/workforce')
                wf_val = int(wf_node.get('max') or wf_node.get('amount') or 0) if wf_node is not None else 0
                wf_cap = int(wf_node.get('capacity') or 0) if wf_node is not None else 0

                module_data = {
                    "id": fname, 
                    "wareId": info['module_ware_id'], 
                    "nameId": info['name_id'], 
                    "name": info['name_id'], 
                    "type": m_class, 
                    "group": m_class, 
                    "method": "none",
                    "race": "default",
                    "isPlayerBlueprint": is_player_bp,
                    "buildTime": info['build_time'], 
                    "buildCost": info['build_cost'],
                    "tier": 0,
                    "cycleTime": 0,
                    "workforce": { "capacity": wf_cap, "needed": wf_val, "maxBonus": 0 },
                    "outputs": {}, 
                    "inputs": {}
                }
                
                # 初始颜色分配 
                module_data['color'], module_data['color_rgb'] = self._get_module_colors(m_class)

                # Fix: Check identification tag for specific module types
                ident = macro.find('properties/identification')
                if ident is not None:
                    # 提取真实制造商种族
                    maker_race = ident.get('makerrace')
                    if maker_race:
                        macro_race_set.add(maker_race)
                        module_data['race'] = maker_race

                    # 标记不可建造种族
                    non_player_races = {'xenon', 'khaak', 'unknown'}
                    module_data['isPlayerBlueprint'] = is_player_bp and (module_data['race'] not in non_player_races)
                    raw_type = ident.get('type')
                    if raw_type:
                        if raw_type in SPECIAL_TYPE_MAPPING:
                            module_data['group'] = SPECIAL_TYPE_MAPPING[raw_type]
                        else:
                            unmapped_types[raw_type].append(fname)
                        module_data['color'], module_data['color_rgb'] = self._get_module_colors(raw_type, module_data.get('group'))

                if m_class == 'production':
                    prod_tag = macro.find('properties/production')
                    if prod_tag is not None:
                        # Fix: Handle multiple outputs via <queue> tags (e.g. Scrap Recycler)
                        production_configs = []
                        queue_tag = prod_tag.find('queue')
                        
                        # Strategy 1: <queue><item ware="..."/></queue>
                        if queue_tag is not None and len(queue_tag.findall('item')) > 0:
                            for item in queue_tag.findall('item'):
                                production_configs.append((item.get('ware'), item.get('method', 'default')))
                        
                        # Strategy 2: <queue ware="..." method="..."/>
                        elif queue_tag is not None and queue_tag.get('ware'):
                            production_configs.append((queue_tag.get('ware'), queue_tag.get('method', 'default')))
                        
                        # Strategy 3: <production wares="..." method="..."/> (Fallback)
                        else:
                            p_wares = prod_tag.get('wares')
                            if p_wares:
                                production_configs.append((p_wares, prod_tag.get('method', 'default')))
                        
                        for p_id, p_method in production_configs:
                            macro_method_set.add(p_method)
                            module_data['method'] = p_method
                            # Update Group info based on first valid ware
                            if 'group' not in module_data or module_data['group'] == module_data['type']:
                                target_ware = next((w for w in self.wares_data if w['id'] == p_id), None)
                                if target_ware and target_ware.get('group'):
                                    module_data["group"] = target_ware['group']
                            
                            recipe = self.recipes.get(p_id, {}).get(p_method)
                            if not recipe:
                                recipe = self.recipes.get(p_id, {}).get('default')
                            if recipe:
                                factor = 3600 / recipe['time']
                                module_data["cycleTime"] = recipe['time']
                                module_data["outputs"][p_id] = module_data["outputs"].get(p_id, 0) + round(recipe['amount'] * factor, 2)
                                for k, v in recipe['inputs'].items():
                                    module_data["inputs"][k] = module_data["inputs"].get(k, 0) + round(v * factor, 2)
                                module_data["workforce"]["maxBonus"] = max(module_data["workforce"]["maxBonus"], recipe['bonus'])
                        
                        # 计算模块 Tier: 取所有产物中最高的 Tier 
                        module_data['tier'] = max([self.ware_tier_map.get(p_id, 0) for p_id, _ in production_configs] or [0])
                    
                if m_class == 'storage':
                    cargo = macro.find('properties/cargo')
                    if cargo is not None: 
                        # cargo max 可能是 tags="container" max="10000" 这种形式
                        # [Modified] Extract both max (capacity) and tags (type)
                        cap = int(cargo.get('max', 0))
                        tags = cargo.get('tags', '')
                        
                        # Simple mapping for primary tag
                        c_type = 'container'
                        if 'liquid' in tags: c_type = 'liquid'
                        elif 'solid' in tags: c_type = 'solid'
                        
                        module_data['cargo'] = {
                            "capacity": cap,
                            "type": c_type
                        }

                self.all_modules.append(module_data)
                count += 1
            

            if unmapped_types:
                print("⚠️  [警告] 发现未映射的模块类型 (Identification Type):")
                for u_type, macros in unmapped_types.items():
                    sample = ", ".join(macros[:5])
                    if len(macros) > 5: sample += f" ... (+{len(macros)-5} more)"
                    print(f"   - {u_type}: Found in {len(macros)} macros ({sample})")
            print(f"   ℹ️  Macros中使用的种族生产方式: {sorted(list(macro_race_set))}")
            print(f"   ℹ️  Macros中使用的生产方式: {sorted(list(macro_method_set))}")
            print(f"   ✅ 解析完成: 从聚合库中提取 {count} 个模块数据。")

        except Exception as e: 
            print(f"   ❌ Macro Parse Error: {e}")

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

        # 更新商品组数据
        count_wg = 0
        for item in self.module_groups_result:
            raw_key = item['nameId']
            if raw_key in en_map:
                item['name'] = en_map[raw_key]
                count_wg += 1
        
        print(f"   ✅ 更新了 {count_wares} 个商品, {count_mods} 个模块, {count_wg} 个模块分组的英文名称。")

    # =======================================================
    # 🆕 4.1. 模块类型分析
    # =======================================================
    def analyze_module_types(self):
        print(f"📊 [4.1/5] 分析模块类型配置...")
        config_types = self.config.get('module_types', {})
        
        # 统计实际类型及其 Page ID
        actual_types = defaultdict(lambda: defaultdict(int))
        for module in self.all_modules:
            m_type = module.get("type", "unknown")
            name_id = module.get("nameId", "")
            match = re.search(r'\{(\d+),', name_id)
            page_id = match.group(1) if match else "Other"
            actual_types[m_type][page_id] += 1

        config_keys = set(config_types.keys())
        json_keys = set(actual_types.keys())

        # 打印对比结果
        print(f"-" * 85)
        print(f"{'Module Type':<20} | {'Page ID 分布':<15} | {'状态':<10} | {'现有配置 Key'}")
        print(f"-" * 85)

        all_keys = sorted(json_keys | config_keys)
        missing_in_config = []

        for k in all_keys:
            status = "✅ 已配置" if k in config_keys else "❌ 缺失"
            pages = ", ".join([f"{p}({c})" for p, c in actual_types.get(k, {}).items()]) or "N/A"
            config_val = config_types.get(k, "---")
            
            if k in json_keys and k not in config_keys:
                missing_in_config.append(k)

            print(f"{k:<20} | {pages:<15} | {status:<10} | {config_val}")

        if missing_in_config:
            print(f"⚠️  配置文件中缺失的项 (建议添加):")
            for m in missing_in_config:
                print(f"  - \"{m}\": \"{{待定ID}}\"")
        else:
            print(f"   ✅ 所有模块类型均已配置。")

    # =======================================================
    # 4.2 生成 res.json
    # =======================================================
    def generate_res_data(self):
        print(f"\n🏷️ [4.2/5] 生成 res.json (T0资源)...")
        data_dir = os.path.join(self.output_root, "data")
        if not os.path.exists(data_dir): os.makedirs(data_dir)

        # 1. Filter T0 wares
        t0_wares = [w for w in self.wares_data if w.get('tier') == 0]
        print(f"   ℹ️  Found {len(t0_wares)} Tier 0 wares.")

        res_list = []
        
        for ware in t0_wares:
            w_id = ware['id']
            # Default English name
            en_name = ware.get('name', w_id)
            
            # Construct res.json entry
            # Base entry
            entry = {
                "id": w_id
            }

            # Process all available languages
            for iso, lang_map in self.i18n_data.items():
                # Resolve full name first
                raw_key = ware.get('nameId')
                full_name = lang_map.get(raw_key, en_name)
                
                # Assign to res.json field
                # Use name_{iso} for all languages, no abbreviations
                entry[f"name_{iso}"] = full_name
            
            res_list.append(entry)

        # Write res.json
        res_path = os.path.join(data_dir, "res.json")
        with open(res_path, 'w', encoding='utf-8') as f:
            json.dump(res_list, f, indent=2, ensure_ascii=False)
        print(f"   ✅ Written res.json with {len(res_list)} items.")

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
        with open(os.path.join(data_dir, "module_groups.json"), 'w', encoding='utf-8') as f:
            json.dump(self.module_groups_result, f, indent=2, ensure_ascii=False)
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
    loader = X4PrecisionLoader(X4_UNPACKED_DATA_PATH, OUTPUT_VERSION_DIR, _config)
    loader.build_database()
    loader.load_colors()  # 加载颜色定义
    loader.process_module_groups()
    loader.scan_assets()
    loader.extract_and_resolve_languages()
    loader.inject_english_names() # 新增步骤
    loader.analyze_module_types()
    loader.generate_res_data() # 新增步骤: 生成资源元数据及缩写
    loader.save()