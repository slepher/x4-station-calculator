import type { ModuleData } from '@/store/useStationStore'

// ==========================================
// 1. 商品数据库 (价格 + 名称)
// ==========================================
export const waresDb: Record<string, { price: number, name: string }> = {
  // --- 基础资源 ---
  energycells: { price: 16, name: '能量电池' },
  ore: { price: 50, name: '矿石' },
  silicon: { price: 130, name: '硅' },
  methane: { price: 48, name: '甲烷' },
  helium: { price: 44, name: '氦' },
  hydrogen: { price: 55, name: '氢' },
  ice: { price: 40, name: '冰' },
  
  // --- 中间产品 ---
  refinedmetals: { price: 165, name: '精炼金属' },
  graphene: { price: 160, name: '石墨烯' },
  superfluidcoolant: { price: 152, name: '超流体冷却剂' },
  siliconwafers: { price: 298, name: '硅片' },
  antimattercells: { price: 202, name: '反物质电池' },
  water: { price: 56, name: '水' },

  // --- 高级产品 / 建造材料 ---
  hullparts: { price: 220, name: '船体部件' }, // 核心建造材料
  claytronics: { price: 1648, name: '纳米计算机' }, // 核心建造材料
  quantumtubes: { price: 322, name: '量子管' },
  plasmaconductors: { price: 928, name: '等离子导体' },
  advancedcomposites: { price: 540, name: '高级复合材料' },
  microchips: { price: 980, name: '微晶片' },
  advancedelectronics: { price: 1100, name: '高级电子设备' },

  // --- 消耗品 ---
  foodrations: { price: 32, name: '食品配给' },
  medicalsupplies: { price: 42, name: '医疗物资' },
  meat: { price: 40, name: '肉类' },
  wheat: { price: 35, name: '小麦' },
  spices: { price: 30, name: '香料' },
}

// ==========================================
// 2. 模块列表 (生产 + 居住 + 建造消耗)
// ==========================================
export const mockModules: ModuleData[] = [
  // ----------------------------------------------------------------
  // 居住模块 (提供人力, 消耗食物/医疗)
  // ----------------------------------------------------------------
  { 
    id: 'module_arg_hab_l_01', 
    name: '大型居住舱 (Argon)', 
    race: 'Argon', 
    type: 'habitat',
    cost: 8673088, // 现金造价
    workforce: { capacity: 1000, needed: 0 }, // 提供1000人
    inputs: { energycells: 100, foodrations: 450, medicalsupplies: 270 }, // 维持消耗
    // 建造这个模块需要的材料
    buildCost: { claytronics: 284, hullparts: 1135, energycells: 2270 } 
  },
  { 
    id: 'module_arg_hab_m_01', 
    name: '中型居住舱 (Argon)', 
    race: 'Argon', 
    type: 'habitat',
    cost: 3250000,
    workforce: { capacity: 500, needed: 0 },
    inputs: { energycells: 50, foodrations: 225, medicalsupplies: 135 },
    buildCost: { claytronics: 110, hullparts: 450, energycells: 900 }
  },

  // ----------------------------------------------------------------
  // 基础电力
  // ----------------------------------------------------------------
  { 
    id: 'module_gen_prod_energycells_01', 
    name: '能量电池生产模块', 
    race: 'Generic', 
    type: 'production',
    cost: 2949916,
    workforce: { capacity: 0, needed: 60 },
    outputs: { energycells: 14500 }, // 阳光加成逻辑在 Store 里
    inputs: {}, // 太阳能不需要输入
    buildCost: { claytronics: 64, hullparts: 258, energycells: 510 }
  },

  // ----------------------------------------------------------------
  // 基础精炼 (矿 -> 锭)
  // ----------------------------------------------------------------
  { 
    id: 'module_gen_prod_refinedmetals_01', 
    name: '精炼金属生产模块', 
    race: 'Generic', 
    type: 'production',
    cost: 925407,
    workforce: { capacity: 0, needed: 90 },
    outputs: { refinedmetals: 1200 },
    inputs: { ore: 2400, energycells: 540 },
    buildCost: { claytronics: 25, hullparts: 102, energycells: 190 }
  },
  { 
    id: 'module_gen_prod_graphene_01', 
    name: '石墨烯生产模块', 
    race: 'Generic', 
    type: 'production',
    cost: 638144,
    workforce: { capacity: 0, needed: 60 },
    outputs: { graphene: 1850 },
    inputs: { methane: 2400, energycells: 600 },
    buildCost: { claytronics: 20, hullparts: 75, energycells: 140 }
  },
  { 
    id: 'module_gen_prod_superfluidcoolant_01', 
    name: '超流体冷却剂生产模块', 
    race: 'Generic', 
    type: 'production',
    cost: 285848,
    workforce: { capacity: 0, needed: 80 },
    outputs: { superfluidcoolant: 1800 },
    inputs: { helium: 2200, energycells: 300 },
    buildCost: { claytronics: 18, hullparts: 52, energycells: 90 }
  },
  { 
    id: 'module_gen_prod_siliconwafers_01', 
    name: '硅片生产模块', 
    race: 'Generic', 
    type: 'production',
    cost: 750000,
    workforce: { capacity: 0, needed: 70 },
    outputs: { siliconwafers: 1100 },
    inputs: { silicon: 2000, energycells: 400 },
    buildCost: { claytronics: 22, hullparts: 80, energycells: 160 }
  },

  // ----------------------------------------------------------------
  // 进阶制造 (核心建材)
  // ----------------------------------------------------------------
  { 
    id: 'module_gen_prod_hullparts_01', 
    name: '船体部件生产模块', 
    race: 'Generic', 
    type: 'production',
    cost: 1680000,
    workforce: { capacity: 0, needed: 120 },
    outputs: { hullparts: 980 },
    inputs: { refinedmetals: 1120, graphene: 280, energycells: 320 },
    buildCost: { claytronics: 45, hullparts: 180, energycells: 360 }
  },
  { 
    id: 'module_gen_prod_claytronics_01', 
    name: '纳米计算机生产模块', 
    race: 'Generic', 
    type: 'production',
    cost: 12500000, // 这是一个很贵的工厂
    workforce: { capacity: 0, needed: 300 },
    outputs: { claytronics: 220 },
    inputs: { microchips: 400, quantumtubes: 200, antimattercells: 100, energycells: 800 },
    buildCost: { claytronics: 380, hullparts: 1420, energycells: 2800 }
  },

  // ----------------------------------------------------------------
  // 高科技组件
  // ----------------------------------------------------------------
  { 
    id: 'module_gen_prod_quantumtubes_01', 
    name: '量子管生产模块', 
    race: 'Generic', 
    type: 'production',
    cost: 1050000,
    workforce: { capacity: 0, needed: 150 },
    outputs: { quantumtubes: 550 },
    inputs: { graphene: 580, refinedmetals: 200, energycells: 400 },
    buildCost: { claytronics: 32, hullparts: 128, energycells: 250 }
  },
  { 
    id: 'module_gen_prod_plasmaconductors_01', 
    name: '等离子导体生产模块', 
    race: 'Generic', 
    type: 'production',
    cost: 1420000,
    workforce: { capacity: 0, needed: 180 },
    outputs: { plasmaconductors: 220 },
    inputs: { superfluidcoolant: 580, graphene: 960, energycells: 600 },
    buildCost: { claytronics: 42, hullparts: 165, energycells: 310 }
  },
  { 
    id: 'module_gen_prod_advancedcomposites_01', 
    name: '高级复合材料生产模块', 
    race: 'Generic', 
    type: 'production',
    cost: 1850000,
    workforce: { capacity: 0, needed: 110 },
    outputs: { advancedcomposites: 360 },
    inputs: { refinedmetals: 640, energycells: 450, graphene: 300 },
    buildCost: { claytronics: 38, hullparts: 150, energycells: 290 }
  },

  // ----------------------------------------------------------------
  // 食物与医疗 (Argon)
  // ----------------------------------------------------------------
  { 
    id: 'module_arg_prod_foodrations_01', 
    name: '食品配给工厂 (Argon)', 
    race: 'Argon', 
    type: 'production',
    cost: 550000,
    workforce: { capacity: 0, needed: 40 },
    outputs: { foodrations: 2800 },
    inputs: { wheat: 1000, meat: 800, spices: 400, energycells: 300 }, // 简化输入
    buildCost: { claytronics: 15, hullparts: 60, energycells: 120 }
  },
  { 
    id: 'module_arg_prod_medicalsupplies_01', 
    name: '医疗物资工厂 (Argon)', 
    race: 'Argon', 
    type: 'production',
    cost: 850000,
    workforce: { capacity: 0, needed: 60 },
    outputs: { medicalsupplies: 1200 },
    inputs: { spices: 600, wheat: 400, energycells: 280 }, // 简化输入
    buildCost: { claytronics: 25, hullparts: 95, energycells: 180 }
  },
]