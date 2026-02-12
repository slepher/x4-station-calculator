import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateAutoFill } from '../../src/store/logic/moduleDiffCalculator';
import { StationSettings, X4Module, X4Ware, SavedModule } from '../../src/types/x4';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, '../../src/assets/x4_game_data/8.0-Diplomacy/data');

describe('Sunlight Impact Logic', () => {
  let modules: Record<string, X4Module> = {};
  let wares: Record<string, X4Ware> = {};
  let consumption: any = {};

  beforeAll(() => {
    const modulesArray = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'modules.json'), 'utf-8')) as X4Module[];
    modulesArray.forEach(m => modules[m.id] = m);

    const waresArray = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'wares.json'), 'utf-8')) as X4Ware[];
    waresArray.forEach(w => wares[w.id] = w);
    
    consumption = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'consumption.json'), 'utf-8'));
  });

  const getSettings = (sunlight: number): StationSettings => ({
    racePreference: 'argon',
    considerWorkforceForAutoFill: false,
    supplyWorkforceBonus: false,
    internalSupply: true,
    resourceBufferHours: 1,
    primaryProductBufferHours: 1,
    secondaryProductBufferHours: 1,
    workforcePercent: 100,
    sunlight: sunlight,
    useHQ: false,
    manualWorkforce: 0,
    workforceAuto: true,
    buyMultiplier: 0.5,
    sellMultiplier: 0.5,
    minersEnabled: false,
    transportShipCapacity: 10000
  });

  it('should require more solar panels when sunlight is low (Industry)', () => {
    // Find a module that requires Energy Cells (e.g., Refined Metals)
    const refinedMetalsId = Object.keys(modules).find(k => k.includes('refinedmetals') && k.includes('prod'))!;
    
    expect(refinedMetalsId).toBeDefined();

    const plannedModules: SavedModule[] = [{ id: refinedMetalsId, count: 100 }];

    const getSolarCount = (autoIndustry: SavedModule[]) => {
      return autoIndustry
        .filter(m => {
          const info = modules[m.id];
          return info && info.outputs && 'energycells' in info.outputs;
        })
        .reduce((sum, m) => sum + m.count, 0);
    };

    // 100% Sunlight
    const result100 = calculateAutoFill(plannedModules, getSettings(100), modules, wares, [], consumption, {});
    const solar100 = getSolarCount(result100.autoIndustry);
    
    console.log('AutoIndustry (100%):', JSON.stringify(result100.autoIndustry, null, 2));

    // 50% Sunlight
    const result50 = calculateAutoFill(plannedModules, getSettings(50), modules, wares, [], consumption, {});
    const solar50 = getSolarCount(result50.autoIndustry);

    // 200% Sunlight
    const result200 = calculateAutoFill(plannedModules, getSettings(200), modules, wares, [], consumption, {});
    const solar200 = getSolarCount(result200.autoIndustry);

    console.log(`Solar Panels (Industry) - 50%: ${solar50}, 100%: ${solar100}, 200%: ${solar200}`);

    expect(solar50).toBeGreaterThan(solar100);
    expect(solar100).toBeGreaterThan(solar200);
  });

  it('should accurately calculate solar panels for user reported scenario (1.43 efficiency)', () => {
    // Scenario: Demand ~36,120, Sunlight 41%, Efficiency 1.43
    // Energy Cell Producer (Argon)
    const claytronicsId = Object.keys(modules).find(k => k.includes('claytronics') && k.includes('prod'))!;
    const siliconWafersId = Object.keys(modules).find(k => k.includes('siliconwafers') && k.includes('prod'))!;
    const energyCellsId = Object.keys(modules).find(k => k.includes('energycells') && k.includes('prod_gen'))!;

    expect(claytronicsId).toBeDefined();
    expect(siliconWafersId).toBeDefined();
    expect(energyCellsId).toBeDefined();

    // 12 Claytronics = 12 * 2240 = 26,880
    // 1.28 Silicon Wafers (approx) to reach 36,120 total? 
    // Let's just manually set the planned modules to something that creates exactly 36,120 demand.
    // Actually, let's just use the real modules and see what happens.
    // 12 Claytronics + 2 Silicon Wafers = 26,880 + 14,400 = 41,280.
    // 12 Claytronics + 1 Silicon Wafers = 26,880 + 7,200 = 34,080.
    
    const plannedModules: SavedModule[] = [
      { id: claytronicsId, count: 12 },
      { id: siliconWafersId, count: 1.3 } // Using float count to simulate exact demand if possible, or just use 2
    ];

    const settings = getSettings(41);
    settings.considerWorkforceForAutoFill = true;

    const result = calculateAutoFill(plannedModules, settings, modules, wares, [], consumption, {});
    
    const solarCount = result.autoIndustry
      .filter(m => m.id === energyCellsId)
      .reduce((sum, m) => sum + m.count, 0);

    // With 1.43 efficiency: 34,080 / (10500 * 0.41 * 1.43) = 34,080 / 6156.15 = 5.53 -> 6 panels
    // With 1.25 efficiency: 34,080 / (10500 * 0.41 * 1.25) = 34,080 / 5381.25 = 6.33 -> 7 panels
    
    // Using 12 Claytronics + 1 Silicon Wafer = 34,080 demand.
    const testPlanned: SavedModule[] = [
      { id: claytronicsId, count: 12 },
      { id: siliconWafersId, count: 1 }
    ];
    
    const resultFixed = calculateAutoFill(testPlanned, settings, modules, wares, [], consumption, {});
    const solarFixed = resultFixed.autoIndustry
      .filter(m => m.id === energyCellsId)
      .reduce((sum, m) => sum + m.count, 0);

    console.log(`Solar Panels for 34,080 demand at 41% sunlight: ${solarFixed}`);
    
    // Before fix, this would be 7. After fix, it should be 6.
    expect(solarFixed).toBe(6);
  });

  it('should require more solar panels when sunlight is low (Supply)', () => {
    // Use a production module that needs workers to trigger supply chain
    const refinedMetalsId = Object.keys(modules).find(k => k.includes('refinedmetals') && k.includes('prod'))!;
    
    expect(refinedMetalsId).toBeDefined();

    const plannedModules: SavedModule[] = [{ id: refinedMetalsId, count: 100 }];

    const getSolarCount = (autoSupply: SavedModule[]) => {
      return autoSupply
        .filter(m => {
          const info = modules[m.id];
          return info && info.outputs && 'energycells' in info.outputs;
        })
        .reduce((sum, m) => sum + m.count, 0);
    };

    // Settings with workforce bonus to trigger supply chain
    const settings100 = getSettings(100);
    settings100.considerWorkforceForAutoFill = true; // 开启工人加成
    settings100.supplyWorkforceBonus = true;         // 补给区也要工人 (自给自足)

    const settings50 = getSettings(50);
    settings50.considerWorkforceForAutoFill = true;
    settings50.supplyWorkforceBonus = true;

    const result100 = calculateAutoFill(plannedModules, settings100, modules, wares, [], consumption, {});
    const solar100 = getSolarCount(result100.autoSupply);

    const result50 = calculateAutoFill(plannedModules, settings50, modules, wares, [], consumption, {});
    const solar50 = getSolarCount(result50.autoSupply);

    console.log(`Solar Panels (Supply) - 50%: ${solar50}, 100%: ${solar100}`);

    expect(solar50).toBeGreaterThan(solar100);
  });
});
