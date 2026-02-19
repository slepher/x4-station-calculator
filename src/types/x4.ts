
export type TransportType = 'container' | 'solid' | 'liquid';
/**
 * 基础商品接口 - 对应 wares.json
 */
export interface X4Ware {
  id: string;
  nameId: string;
  name: string;
  transport: TransportType;
  volume: number;     // 单位体积
  price: number;      // 平均价格
  minPrice: number;   // 最低价格
  maxPrice: number;   // 最高价格
  tier: number;       // 物品层级
  group: string;      // 物品分组 (hightech, shiptech, refined, food, etc.)
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
  color: string;
  color_rgb: string;
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
  method: 'terran' | 'closed_loop' | 'recycling' | 'default' | 'teladi' | 'none'; // 生产方式偏好

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
  cargo?: {
    capacity: number;
    type: 'container' | 'solid' | 'liquid';
  };
  
  // 颜色标记
  color: string;
  color_rgb: string;
  
  // 模块层级
  tier: number;
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

export type LocalizedX4Module = X4Module & { localeName: string }
export type LocalizedX4ModuleGroup = X4ModuleGroup & { localeName: string }

export interface GroupedModuleItem extends LocalizedX4Module {
  displayLabel: string
  moduleGroup?: LocalizedX4ModuleGroup
}

export interface ModuleGroupResult {
  group: string
  displayLabel: string
  modules: GroupedModuleItem[]
}

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
  supplyWorkforceBonus?: boolean;
  buyMultiplier: number;
  sellMultiplier: number;
  minersEnabled: boolean;
  internalSupply: boolean;
  showEmpireGaps?: boolean;
  racePreference: string;
  resourceBufferHours: number; // 资源缓冲时间（小时）
  primaryProductBufferHours: number;   // 主产物缓冲时间（小时）
  secondaryProductBufferHours: number; // 副产物缓冲时间（小时）
  transportShipCapacity: number; // 运输船运量
}

/**
 * 空间站布局配置
 */
export interface StationPlan {
  id: string;
  name: string;
  type?: StationType;
  count?: number;
  modules: SavedModule[];
  settings: StationSettings;
  lastUpdated: number;
  lockedWares?: string[];
  warePriority?: Record<string, number>;
  minerals?: string[];
}

/**
 * 分站类型定义
 */
export type StationType = 'industrial' | 'supply' | 'transit' | 'shipyard';

/**
 * 帝国方案配置
 */
export interface EmpirePlan {
  id: string;
  name: string;
  stations: StationPlan[];
}

/**
 * V2 存储状态
 */
export interface V2StorageState {
  version: 2;
  activeEmpireId: string | null;
  activeStationId: string | null;
  empires: EmpirePlan[];
}

/**
 * V1 存储状态 (用于迁移)
 */
export interface V1StorageState {
  version: 1;
  activeId: string | null;
  list: StationPlan[];
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

export interface ModuleFlowAtom {
  moduleId: string;
  count: number;
  
  // 类型：决定了它是作为“输入缓冲”还是“输出缓冲”的来源
  type: 'production' | 'consumption';

  // --- 1. 数量流 (基础) ---
  amount: number;       // 贡献的数量 (个)
  bonusPercent: number;

  // --- 2. 体积流 (重点) ---
  // 这是你查看"消耗明细"时最关键的字段
  // 例如：-33,600 m³ (巨大的消耗带宽)
  volumeFlow: number;   // amount * Module
  
  // --- 3. 资金流 (参考) ---
  valueFlow: number;    // amount * unitPrice
}

export interface WareFlow {
  // --- 核心标识 ---
  wareId: string;
  orderIndex: number; // 排序索引：基于 firstAppearanceInModules 的顺序
  tier: number;
  transportType: TransportType; // 集装箱/固体/液体
  unitVolume: number;           // 单体体积

  // 数量流 (Quantity)
  production: number;      // 总产出/h
  consumption: number;     // 总消耗/h
  workforceConsumption: number; // 工人消耗/h
  netRate: number;         // 净产出

  // 体积流 (Volume) - 新增核心
  // 意义：展示该产线对此类物资的"搬运压力"
  productionVolume: number;  // 产出体积流 (totalProduction * unitVolume)
  consumptionVolume: number; // 消耗体积流 (totalConsumption * unitVolume)
  netVolume: number;         // 净体积变化

  // 规划容器占用数量 (Total Requirement)
  totalOccupiedCount: number;
  // 规划容器消耗占用数量 (Total Requirement)
  // 通常是consumption * consumptionBufferTime
  totalOccupiedConsumptionCount: number;
  // 总规划占用空间 (Total Requirement)
  // 逻辑：X4中通常是输入输出共享池子，或者取最大值覆盖，
  // 产物采取consumptionVolume * consumptionBufferTime + netVolume * transportBufferTime
  // 中间产物(不需要产品)采取(Out + NetSurplus) * consumptionBufferTime
  // 是产物还是中间产物看是plannedModule中模块产出的还是industryModules中模块产出的
  // 或者最简单的：(Production + Consumption) * buffer ? 
  // *根据你的要求：要看消耗也要看产出，通常意味着两者都要留缓冲*
  totalOccupiedVolume: number;

  unitPrice: number;
  netValue: number;        // 总利润流

  // ====================================================
  // 维度 D: 构成明细 (Drill-down)
  // ====================================================
  /**
   * 包含所有的 ModuleFlowAtom。
   * UI 上可以分为 "来源(Sources)" 和 "去向(Sinks)" 两组展示
   */
  contributions: ModuleFlowAtom[];
}

// [新增] 分组流向接口 - 用于统一管理和展示
export interface GroupedFlows {
  // 主数据：所有流向（已按orderIndex排序）
  flows: WareFlow[]; 
  
  // 按数量/经济视图分组
  rateGroups: {
    positive: WareFlow[];  // 产品/收入 (netRate > 0)
    operations: WareFlow[]; // 运营 (netRate <= 0 && transportType === 'container' && workforceConsumption === 0)
    supply: WareFlow[];    // 补给 (netRate <= 0 && workforceConsumption > 0)
    resources: WareFlow[];  // 资源 (netRate <= 0 && transportType !== 'container' && workforceConsumption === 0)
  };
  
  // 按体积视图分组
  volumeGroups: {
    solid: WareFlow[];     // 固体
    liquid: WareFlow[];    // 液体
    container: WareFlow[]; // 容器
  };
}

export interface StationFlowAtom {
  stationId: string;
  stationName: string;
  stationCount: number;
  production: number;
  consumption: number;
  workforceConsumption: number;
  netRate: number;
  netValue: number;
}

export interface EmpireWareFlow {
  wareId: string;
  orderIndex: number;
  tier: number;
  transportType: TransportType;
  unitVolume: number;
  
  production: number;
  consumption: number;
  workforceConsumption: number;
  netRate: number;
  
  unitPrice: number;
  netValue: number;
  
  contributions: StationFlowAtom[];
}

export interface EmpireGroupedFlows {
  flows: EmpireWareFlow[];
  empireGroups: {
    products: EmpireWareFlow[];
    operations: EmpireWareFlow[];
    supply: EmpireWareFlow[];
  };
}

// [新增] 人口普查结果接口
export interface WorkforceCensusItem {
  moduleId: string
  nameId: string
  residents: number
  count: number,
  race: string
}

/**
 * 逻辑组网：单个节点
 */
export interface FlowNode {
  id: string
  wareId: string
  moduleId?: string
  race: string  // 节点偏好的种族 (用于 UI 图标及回溯匹配)
  lineage: string // [新增] 血统元数据 (用于回溯导航)
  column: number // 基于 Tier (0-3)
  isIsolated: boolean // 节点隔离状态（产品占位符 vs 模块）
  isAuto: boolean // [新增] 是否为自动生成的节点
  isRoot: boolean // [新增] 是否为手动添加的根节点
  source: 'manual' | 'auto' // 节点来源
  order: number // 列内垂直排序
  isPreview?: boolean // [新增] 是否为预览节点（拖拽时显示）
}

/**
 * 逻辑组网：生产线组
 */
export interface ProductionLineGroup {
  id: string
  name: string // 用户自定义标题，为空时显示默认名称（最高 tier 的 manual 产线名称）
  category: 'industrial' | 'agricultural'
  subCategory: string // 始终代表 race (工业: default/terran/teladi, 农业: 具体种族)
  isLocked: boolean // [新增] 组是否锁定血统
  lockedLineage: string // [新增] 锁定的血统
  nodes: FlowNode[]
}

// --- 逻辑组网方案持久化类型 ---

export interface SavedFlowNode {
  id: string
  wareId: string
  moduleId?: string
  race: string
  lineage: string
  column: number
  isIsolated: boolean
  source: 'manual'
  isRoot: boolean
  order: number
}

export interface SavedFlowGroup {
  id: string
  name: string // 用户自定义标题，为空时显示默认名称
  category: 'industrial' | 'agricultural'
  subCategory: string
  isLocked: boolean
  lockedLineage: string
  nodes: SavedFlowNode[]
}

export interface LogicFlowSettings {
  isDefaultLocked: boolean
}

export interface LogicFlowPlan {
  id: string
  name: string
  groups: SavedFlowGroup[]
  settings: LogicFlowSettings
  lastUpdated: number
}

export interface SavedFlowPlansState {
  version: 1
  activeId: string | null
  list: LogicFlowPlan[]
}
