import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeWareFlow } from '../../../src/store/logic/analyzeWareFlow';
import { calculateWorkforceCensus } from '../../../src/store/logic/calculatorUtils';
import { StationSettings, X4Module, X4Ware, SavedModule, RaceMedicalConsumption } from '../../../src/types/x4';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = path.join(__dirname, '../../../src/assets/x4_game_data/8.0-Diplomacy/data');

describe('Split Supply Operations - workforceConsumption', () => {
  let modules: Record<string, X4Module> = {};
  let wares: Record<string, X4Ware> = {};
  let consumption: RaceMedicalConsumption = {};

  beforeAll(() => {
    const modulesArray = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'modules.json'), 'utf-8')) as X4Module[];
    modulesArray.forEach(m => modules[m.id] = m);

    const waresArray = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'wares.json'), 'utf-8')) as X4Ware[];
    waresArray.forEach(w => wares[w.id] = w);
    
    consumption = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'consumption.json'), 'utf-8'));
  });

  const defaultSettings: StationSettings = {
    racePreference: 'argon',
    considerWorkforceForAutoFill: false,
    supplyWorkforceBonus: false,
    internalSupply: false,
    resourceBufferHours: 1,
    primaryProductBufferHours: 1,
    secondaryProductBufferHours: 1,
    workforcePercent: 100,
    sunlight: 100,
    useHQ: false,
    manualWorkforce: 0,
    workforceAuto: true,
    buyMultiplier: 0.5,
    sellMultiplier: 0.5,
    minersEnabled: false,
    transportShipCapacity: 10000
  };

  it('测试 WareFlow 接口的 workforceConsumption 字段初始化', () => {
    const result = analyzeWareFlow(
      [],
      modules,
      wares,
      consumption,
      defaultSettings,
      0,
      1,
      defaultSettings.resourceBufferHours,
      defaultSettings.primaryProductBufferHours,
      defaultSettings.secondaryProductBufferHours,
      {},
    );

    expect(result.flows.length).toBe(0);
    expect(result.rateGroups.positive.length).toBe(0);
    expect(result.rateGroups.operations.length).toBe(0);
    expect(result.rateGroups.supply.length).toBe(0);
    expect(result.rateGroups.resources.length).toBe(0);
  });

  it('测试工人消耗正确记录到 workforceConsumption 字段', () => {
    const habModuleId = 'module_arg_hab_m_01';
    const habModule = modules[habModuleId];
    
    expect(habModule).toBeDefined();
    expect(habModule?.workforce?.capacity).toBeGreaterThan(0);
    
    const actualWorkforce = 100;
    
    const plannedModules: SavedModule[] = [
      { id: habModuleId, count: 1 }
    ];

    const census = calculateWorkforceCensus(plannedModules, modules, actualWorkforce);
    expect(census.length).toBeGreaterThan(0);
    const firstCensus = census[0];
    expect(firstCensus).toBeDefined();
    expect(firstCensus!.residents).toBe(100);

    const result = analyzeWareFlow(
      plannedModules,
      modules,
      wares,
      consumption,
      defaultSettings,
      actualWorkforce,
      1,
      defaultSettings.resourceBufferHours,
      defaultSettings.primaryProductBufferHours,
      defaultSettings.secondaryProductBufferHours,
      {},
    );

    const foodrationsFlow = result.flows.find(f => f.wareId === 'foodrations');
    const medicalsuppliesFlow = result.flows.find(f => f.wareId === 'medicalsupplies');

    expect(foodrationsFlow).toBeDefined();
    expect(medicalsuppliesFlow).toBeDefined();

    if (foodrationsFlow) {
      expect(foodrationsFlow.workforceConsumption).toBeGreaterThan(0);
      expect(foodrationsFlow.consumption).toBe(foodrationsFlow.workforceConsumption);
    }

    if (medicalsuppliesFlow) {
      expect(medicalsuppliesFlow.workforceConsumption).toBeGreaterThan(0);
      expect(medicalsuppliesFlow.consumption).toBe(medicalsuppliesFlow.workforceConsumption);
    }
  });

  it('测试分组逻辑 - 补给分组', () => {
    const habModuleId = 'module_arg_hab_m_01';
    const habModule = modules[habModuleId];
    
    expect(habModule).toBeDefined();
    
    const actualWorkforce = 100;
    
    const plannedModules: SavedModule[] = [
      { id: habModuleId, count: 1 }
    ];

    const result = analyzeWareFlow(
      plannedModules,
      modules,
      wares,
      consumption,
      defaultSettings,
      actualWorkforce,
      1,
      defaultSettings.resourceBufferHours,
      defaultSettings.primaryProductBufferHours,
      defaultSettings.secondaryProductBufferHours,
      {},
    );

    const foodrationsInSupply = result.rateGroups.supply.find(f => f.wareId === 'foodrations');
    const medicalsuppliesInSupply = result.rateGroups.supply.find(f => f.wareId === 'medicalsupplies');

    expect(foodrationsInSupply).toBeDefined();
    expect(medicalsuppliesInSupply).toBeDefined();
  });

  it('测试分组逻辑 - 运营分组', () => {
    const weaponComponentsModuleId = Object.keys(modules).find(k => 
      k.includes('weaponcomponents') && k.includes('prod')
    );
    expect(weaponComponentsModuleId).toBeDefined();
    if (!weaponComponentsModuleId) return;

    const plannedModules: SavedModule[] = [
      { id: weaponComponentsModuleId, count: 1 }
    ];

    const result = analyzeWareFlow(
      plannedModules,
      modules,
      wares,
      consumption,
      defaultSettings,
      0,
      1,
      defaultSettings.resourceBufferHours,
      defaultSettings.primaryProductBufferHours,
      defaultSettings.secondaryProductBufferHours,
      {},
    );

    const hullpartsFlow = result.flows.find(f => f.wareId === 'hullparts');
    expect(hullpartsFlow).toBeDefined();

    if (hullpartsFlow && hullpartsFlow.netRate < 0) {
      expect(hullpartsFlow.workforceConsumption).toBe(0);
      
      const hullpartsInOperations = result.rateGroups.operations.find(f => f.wareId === 'hullparts');
      expect(hullpartsInOperations).toBeDefined();
    }
  });

  it('测试分组逻辑 - 混合消耗物资归入补给分组', () => {
    const habModuleId = 'module_arg_hab_m_01';
    const weaponComponentsModuleId = Object.keys(modules).find(k => 
      k.includes('weaponcomponents')
    );
    
    expect(modules[habModuleId]).toBeDefined();
    expect(weaponComponentsModuleId).toBeDefined();
    if (!weaponComponentsModuleId) return;

    const actualWorkforce = 100;
    
    const plannedModules: SavedModule[] = [
      { id: habModuleId, count: 1 },
      { id: weaponComponentsModuleId, count: 1 }
    ];

    const result = analyzeWareFlow(
      plannedModules,
      modules,
      wares,
      consumption,
      defaultSettings,
      actualWorkforce,
      1,
      defaultSettings.resourceBufferHours,
      defaultSettings.primaryProductBufferHours,
      defaultSettings.secondaryProductBufferHours,
      {},
    );

    const foodrationsFlow = result.flows.find(f => f.wareId === 'foodrations');
    expect(foodrationsFlow).toBeDefined();

    if (foodrationsFlow && foodrationsFlow.netRate < 0) {
      expect(foodrationsFlow.workforceConsumption).toBeGreaterThan(0);
      
      const foodrationsInSupply = result.rateGroups.supply.find(f => f.wareId === 'foodrations');
      expect(foodrationsInSupply).toBeDefined();
    }
  });
});
