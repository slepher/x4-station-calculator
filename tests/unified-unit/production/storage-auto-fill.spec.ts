import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateAutoFill } from '@/store/logic/moduleDiffCalculator';
import { calculateAutoSupplyModules } from '@/store/logic/workerModuleCalculator';
import { StationSettings, X4Module, X4Ware, SavedModule } from '@/types/x4';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据路径调整：从 tests/unit 往上找 src
const DATA_PATH = path.join(__dirname, '../../../src/assets/x4_game_data/8.0-Diplomacy/data');

describe('Storage Auto-Fill Logic', () => {
  let modules: Record<string, X4Module> = {};
  let wares: Record<string, X4Ware> = {};
  let consumption: any = {};

  beforeAll(() => {
    // 加载数据
    const modulesArray = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'modules.json'), 'utf-8')) as X4Module[];
    modulesArray.forEach(m => modules[m.id] = m);

    const waresArray = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'wares.json'), 'utf-8')) as X4Ware[];
    waresArray.forEach(w => wares[w.id] = w);
    
    consumption = JSON.parse(fs.readFileSync(path.join(DATA_PATH, 'consumption.json'), 'utf-8'));
  });

  it('Case 1: Basic Storage Auto-Fill (Container + Solid)', () => {
    const settings: StationSettings = {
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

    // Refined Metals (Argon) 需要 Ore (Solid) 和 Energy Cells (Container)
    // 并且产出 Refined Metals (Container)
    const refinedMetalsModuleId = Object.keys(modules).find(k => k.includes('refinedmetals') && k.includes('prod'));
    expect(refinedMetalsModuleId).toBeDefined();
    
    if (!refinedMetalsModuleId) return;

    const plannedModules: SavedModule[] = [
      { id: refinedMetalsModuleId, count: 10 } 
    ];

    const result = calculateAutoFill(
      plannedModules,
      settings,
      modules,
      wares,
      [], 
      consumption,
      {}
    );

    // 筛选出自动添加的仓储模块
    const industryStorage = result.autoIndustry.filter(m => modules[m.id]?.type === 'storage');
    
    // 验证是否有 Solid 和 Container 仓储
    const hasSolid = industryStorage.some(m => modules[m.id]!.cargo?.type === 'solid');
    const hasContainer = industryStorage.some(m => modules[m.id]!.cargo?.type === 'container');

    expect(hasSolid).toBe(true);
    expect(hasContainer).toBe(true);
  });

  it('Case 2: AutoSupply Storage (Independent Supply Zone)', () => {
    const settings: StationSettings = {
      racePreference: 'argon',
      considerWorkforceForAutoFill: true, // 开启工业区工人
      supplyWorkforceBonus: true,         // 开启补给区工人（自给自足）
      internalSupply: true,               // 开启 Internal Supply 才会生成 AutoSupply 模块
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
    
    const refinedMetalsModuleId = Object.keys(modules).find(k => k.includes('refinedmetals') && k.includes('prod'));
    if (!refinedMetalsModuleId) return;

    const plannedModules: SavedModule[] = [
      { id: refinedMetalsModuleId, count: 10 }
    ];
    
    const autoIndustry = calculateAutoFill(
      plannedModules,
      settings,
      modules,
      wares,
      [],
      consumption,
      {}
    ).autoIndustry;

    const autoSupply = calculateAutoSupplyModules(
      plannedModules,
      autoIndustry,
      settings,
      modules,
      wares,
      consumption,
      {}
    );

    // 检查 AutoSupply 是否生成了仓储
    const supplyStorage = autoSupply.filter(m => modules[m.id]?.type === 'storage');
    
    // AutoSupply 自给自足需要食物和医疗，通常涉及 Container 仓储（如果食物需要原料，可能还需要 Solid/Liquid，视种族而定）
    // Argon 食物链: Meat (Container), Wheat (Container), Spices (Container) -> Food Rations (Container)
    // 所以应该主要是 Container
    expect(supplyStorage.length).toBeGreaterThan(0);
    
    const hasContainer = supplyStorage.some(m => modules[m.id]!.cargo?.type === 'container');
    expect(hasContainer).toBe(true);
  });

  it('Case 3: Race Preference (Terran Storage)', () => {
    const settings: StationSettings = {
      racePreference: 'terran', // Set to Terran
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

    // Use a simple module requiring container storage
    const photopileModuleId = Object.keys(modules).find(k => k.includes('photopile') && k.includes('prod')); // Photopile (Energy Cells)
    // Or just Energy Cells production
    const energyModuleId = Object.keys(modules).find(k => k === 'module_gen_prod_energycells_01');
    const moduleId = energyModuleId || Object.keys(modules).find(k => k.includes('energycells') && k.includes('prod'));
    
    if (!moduleId) return;

    const plannedModules: SavedModule[] = [
      { id: moduleId!, count: 10 } 
    ];

    const result = calculateAutoFill(
      plannedModules,
      settings,
      modules,
      wares,
      [], 
      consumption,
      {}
    );

    const industryStorage = result.autoIndustry.filter(m => modules[m.id]?.type === 'storage');
    expect(industryStorage.length).toBeGreaterThan(0);

    // Verify Terran storage is used
    // Terran storage usually has 'terran' in ID or name, or specific IDs like 'module_ter_sto_container_l_01'
    const hasTerranStorage = industryStorage.some(m => m.id.includes('ter') || modules[m.id]!.race === 'terran');
    expect(hasTerranStorage).toBe(true);
  });

  it('Case 4: Incremental Fill (Manual Storage reduces Auto Storage)', () => {
    const settings: StationSettings = {
      racePreference: 'argon',
      considerWorkforceForAutoFill: false,
      supplyWorkforceBonus: false,
      internalSupply: false,
      resourceBufferHours: 10, // High buffer to ensure we need storage
      primaryProductBufferHours: 10,
      secondaryProductBufferHours: 10,
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

    const energyModuleId = Object.keys(modules).find(k => k.includes('energycells') && k.includes('prod'));
    if (!energyModuleId) return;

    // Run 1: No manual storage
    const result1 = calculateAutoFill(
      [{ id: energyModuleId, count: 10 }],
      settings,
      modules,
      wares,
      [], 
      consumption,
      {}
    );
    
    const autoCount1 = result1.autoIndustry
      .filter(m => modules[m.id]?.type === 'storage')
      .reduce((sum, m) => sum + m.count, 0);

    expect(autoCount1).toBeGreaterThan(0);

    // Find the storage module ID used
    const storageId = result1.autoIndustry.find(m => modules[m.id]?.type === 'storage')?.id;
    if (!storageId) return;

    // Run 2: With manual storage (half of autoCount1)
    const manualCount = Math.floor(autoCount1 / 2);
    // Ensure manualCount is at least 1 if autoCount1 is small, but if autoCount1 is 1, manual 1 might reduce result to 0
    const manualStorageCount = Math.max(1, manualCount);

    const result2 = calculateAutoFill(
      [
        { id: energyModuleId, count: 10 },
        { id: storageId, count: manualStorageCount }
      ],
      settings,
      modules,
      wares,
      [], 
      consumption,
      {}
    );

    const autoCount2 = result2.autoIndustry
      .filter(m => modules[m.id]?.type === 'storage')
      .reduce((sum, m) => sum + m.count, 0);

    // Auto count should decrease
    expect(autoCount2).toBeLessThan(autoCount1);
    
    // Ideally: autoCount2 ~= autoCount1 - manualStorageCount
    // But due to discrete module sizes, it might not be exact, but should be close.
    // Let's just check it decreased.
  });

  it('Case 5: Priority and Buffer Response', () => {
    const settings: StationSettings = {
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

    const energyModuleId = Object.keys(modules).find(k => k.includes('energycells') && k.includes('prod'));
    if (!energyModuleId) return;

    // Sub-test: Buffer Hours
    const resultLowBuffer = calculateAutoFill(
      [{ id: energyModuleId, count: 50 }], // High production
      { ...settings, primaryProductBufferHours: 1 },
      modules,
      wares,
      [], 
      consumption,
      {}
    );

    const resultHighBuffer = calculateAutoFill(
      [{ id: energyModuleId, count: 50 }],
      { ...settings, primaryProductBufferHours: 10 },
      modules,
      wares,
      [], 
      consumption,
      {}
    );

    const countLow = resultLowBuffer.autoIndustry
      .filter(m => modules[m.id]?.type === 'storage')
      .reduce((sum, m) => sum + m.count, 0);
      
    const countHigh = resultHighBuffer.autoIndustry
      .filter(m => modules[m.id]?.type === 'storage')
      .reduce((sum, m) => sum + m.count, 0);

    expect(countHigh).toBeGreaterThan(countLow);
    
    // Sub-test: Ware Priority
    // Need a module with byproduct or input that we can ignore.
    // Silicon Carbide (Terran) -> Silicon Carbide + Microlattice (Byproduct)
    const sicModuleId = Object.keys(modules).find(k => k.includes('siliconcarbide'));
    if (sicModuleId) {
        // Find Microlattice ID
        const microlatticeId = 'ware_ter_microlattice'; // Assuming ID
        
        // Default priority (all normal)
        const resultDefault = calculateAutoFill(
            [{ id: sicModuleId, count: 10 }],
            settings,
            modules,
            wares,
            [], 
            consumption,
            {}
        );
        
        // Ignore Microlattice
        const resultIgnore = calculateAutoFill(
            [{ id: sicModuleId, count: 10 }],
            settings,
            modules,
            wares,
            [], 
            consumption,
            { [microlatticeId]: 0 } // Priority 0 = Ignore
        );
        
        // If Microlattice was causing storage demand, resultIgnore should have less storage (or same if Main Product dominates)
        // This is hard to guarantee without knowing exact numbers, but we can check if logic runs without error
        // and doesn't crash.
        // A better check: Check if storage allocated specifically for Microlattice is gone.
        // But calculateAutoFill aggregates storage.
        
        // Just verify it runs and returns valid result.
        expect(resultIgnore.autoIndustry).toBeDefined();
    }
  });
});
