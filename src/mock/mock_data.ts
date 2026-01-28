// 定义存档结构接口
export interface SavedModule {
  id: string;
  count: number;
}

// 示例数据：一个简单的闭环工厂
// 包含：能量电池、船体部件、居住舱
export const demoSaveData: SavedModule[] = [
  // 生产模块
  { id: 'prod_gen_energycells_macro', count: 2 },     // 太阳能电厂 x2
  { id: 'prod_gen_hullparts_macro', count: 4 },       // 船体部件工厂 x4
  { id: 'prod_gen_refinedmetals_macro', count: 2 },   // 精炼金属 x2
  { id: 'prod_gen_graphene_macro', count: 1 },        // 石墨烯 x1
  
  // 居住模块
  { id: 'hab_arg_l_01_macro', count: 2 },            // Argon L 居住舱 x2
  
  // 存储模块 (假设 ID 是这些，具体看你的 other_modules.json)
  { id: 'storage_arg_l_container_01', count: 1 }      // L 集装箱存储
]