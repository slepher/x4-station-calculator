/**
 * 基础商品接口 - 对应 wares.json
 */
export interface X4Ware {
  id: string;
  nameId: string;
  name: string;
  transport: 'container' | 'solid' | 'liquid';
  price: number;      // 平均价格
  minPrice: number;   // 最低价格
  maxPrice: number;   // 最高价格
}

/**
 * 劳动力相关数据结构
 */
export interface X4Workforce {
  capacity: number;   // 居住模块提供的容量
  needed: number;     // 生产模块运行所需的最优工人数 (对应宏中的 max/amount)
  maxBonus: number;   // 工人满员时的产量加成系数 (例如 0.43 代表 +43%)
}

/**
 * 空间站模块分组接口 - 对应 module_groups.json
 */
export interface X4ModuleGroup {
  id: string;         //  ID (如 prod_gen_plasmaconductors_macro)
  type: string;     // 模块类型 (如 production, habitation 等)
  nameId: string;     // 国际化文本 ID (如 {20104,12101})
  name: string;
}

/**
 * 空间站模块接口 - 对应 modules.json
 */
export interface X4Module {
  id: string;         // 宏 ID (如 prod_gen_plasmaconductors_macro)
  wareId: string;     // 对应的商品 ID (用于关联图标和建造费)
  nameId: string;     // 国际化文本 ID (如 {20104,12101})
  name: string;
  type: 'production' | 'habitation' | 'storage' | 'dock' | 'connection' | string;
  method: 'terran' | 'closed_loop' | 'recycling' | 'default' | 'none'; // 生产方式偏好

  group: string;      // 模块分组 ID
  race: string;       // 种族归属
  buildTime: number;  // 建造所需时间 (秒)
  buildCost: Record<string, number>; // 建造所需材料及数量

  // 生产逻辑
  cycleTime: number;  // 单次生产周期 (秒)，非生产模块通常为 0
  workforce: X4Workforce;
  
  // 每小时产率 (Hourly rates)
  outputs: Record<string, number>; // key 为商品 ID, value 为每小时产量
  inputs: Record<string, number>;  // key 为商品 ID, value 为每小时消耗量
  
  // 存储逻辑 (仅限存储模块)
  capacity?: number;  // 存储容量
}

/**
 * 种族医疗消耗数据结构
 */
export interface RaceMedicalConsumption {
  [race: string]: {
    [wareId: string]: number; // 商品ID -> 每小时每人消耗量
  };
}

/**
 * 游戏数据根结构
 */
export interface X4GameData {
  modules: X4Module[];
  wares: X4Ware[];
}

// --- 核心业务实体类型 (Core Entities) ---

/**
 * 用户规划的单个模块实例
 */
export interface SavedModule {
  id: string;
  count: number;
}

/**
 * 空间站全局设置
 */
export interface StationSettings {
  sunlight: number;
  useHQ: boolean;
  manualWorkforce: number;
  workforcePercent: number;
  workforceAuto: boolean;
  considerWorkforceForAutoFill: boolean;
  supplyWorkforceBonus: boolean;
  buyMultiplier: number;
  sellMultiplier: number;
  minersEnabled: boolean;
  internalSupply: boolean;
  racePreference: string;
}

/**
 * 空间站布局配置
 */
export interface StationLayout {
  id: string;
  name: string;
  modules: SavedModule[];
  lockedWares: string[]; // 新增：锁定的资源ID列表 (如 ["energycells"])
  settings: StationSettings;
  lastUpdated: number;
}

// --- 计算结果类型 (Calculation Results) ---

/**
 * 劳动力条目（需求或容量）
 */
export interface WorkforceItem {
  id: string;
  nameId: string;
  count: number;
  value: number;
}

/**
 * 生产日志条目（用于展示详细的产出/消耗构成）
 */
export interface ProductionLogItem {
  moduleId: string;
  nameId: string;
  count: number;
  amount: number;
  bonusPercent: number;
  type: 'production' | 'consumption';
  label?: string;
}

/**
 * 单个商品的生产/消耗汇总详情
 */
export interface WareDetail {
  production: number;
  consumption: number;
  list: ProductionLogItem[];
}